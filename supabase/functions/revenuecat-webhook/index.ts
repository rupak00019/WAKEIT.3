import { corsHeaders } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabaseClient.ts";

Deno.serve(async (req) => {
  // We handle OPTIONS requests first
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Validate RevenueCat Webhook Secret
  const authHeader = req.headers.get("Authorization");
  const webhookSecret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
  
  if (!webhookSecret) {
    console.error("RevenueCat webhook warning: REVENUECAT_WEBHOOK_SECRET is not configured");
  } else if (!authHeader || (authHeader !== webhookSecret && authHeader !== `Bearer ${webhookSecret}`)) {
    console.error("RevenueCat webhook: Unauthorized access attempt", { authHeader });
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const serviceClient = getServiceClient();
    const body = await req.json();
    
    // RevenueCat event payload structure: { event: { type, app_user_id, entitlement_id, product_id, ... } }
    const event = body.event;
    if (!event) {
      return new Response(JSON.stringify({ error: "Invalid payload: event is missing" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { 
      type: eventType, 
      app_user_id: userId, 
      entitlement_id: entitlementId, 
      product_id: productId,
      purchased_at_ms: purchasedAtMs,
      expiration_at_ms: expirationAtMs
    } = event;

    if (!userId) {
      return new Response(JSON.stringify({ error: "Invalid payload: app_user_id is missing" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processing RevenueCat event ${eventType} for user ${userId}`);

    // Map entitlement ID to local database plan_type ('member' or 'admin')
    let planType: "member" | "admin" = "member";
    if (entitlementId === "wakeit_admin" || productId === "wakeit_admin_annual") {
      planType = "admin";
    }

    const startedAt = purchasedAtMs ? new Date(purchasedAtMs).toISOString() : new Date().toISOString();
    const expiresAt = expirationAtMs ? new Date(expirationAtMs).toISOString() : null;

    switch (eventType) {
      case "INITIAL_PURCHASE":
      case "RENEWAL": {
        // 1. Insert or update user_subscriptions record
        const { error: subError } = await serviceClient
          .from("user_subscriptions")
          .insert({
            user_id: userId,
            plan_type: planType,
            status: "active",
            started_at: startedAt,
            expires_at: expiresAt,
            revenuecat_product_id: productId,
            updated_at: new Date().toISOString()
          });

        if (subError) {
          console.error("Error creating/updating subscription record:", subError);
        }

        // 2. Update users.plan_type to reflect active plan
        const { error: userUpdateError } = await serviceClient
          .from("users")
          .update({
            plan_type: planType,
            revenuecat_user_id: event.original_app_user_id || userId,
            updated_at: new Date().toISOString()
          })
          .eq("id", userId);

        if (userUpdateError) {
          console.error("Error updating user plan_type:", userUpdateError);
        }
        break;
      }

      case "CANCELLATION": {
        // Update subscription history status to cancelled, do NOT revoke users.plan_type yet (user retains access until expiration)
        const { error: subError } = await serviceClient
          .from("user_subscriptions")
          .update({
            status: "cancelled",
            updated_at: new Date().toISOString()
          })
          .eq("user_id", userId)
          .eq("status", "active");

        if (subError) {
          console.error("Error updating subscription to cancelled:", subError);
        }
        break;
      }

      case "EXPIRATION": {
        // 1. Update subscription history to expired
        const { error: subError } = await serviceClient
          .from("user_subscriptions")
          .update({
            status: "expired",
            updated_at: new Date().toISOString()
          })
          .eq("user_id", userId)
          .eq("status", "active");

        if (subError) {
          console.error("Error updating subscription to expired:", subError);
        }

        // 2. Revoke user plan type by reverting to free_trial
        const { error: userUpdateError } = await serviceClient
          .from("users")
          .update({
            plan_type: "free_trial",
            updated_at: new Date().toISOString()
          })
          .eq("id", userId);

        if (userUpdateError) {
          console.error("Error revoking user plan_type:", userUpdateError);
        }
        break;
      }

      default:
        console.log(`RevenueCat event type ${eventType} is unhandled, returning 200.`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("RevenueCat Webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
