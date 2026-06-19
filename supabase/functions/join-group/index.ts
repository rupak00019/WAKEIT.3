import { corsHeaders } from "../_shared/cors.ts";
import { getServiceClient, getUserIdFromToken } from "../_shared/supabaseClient.ts";
import { sendFCMToTokens } from "../_shared/fcm.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const serviceClient = getServiceClient();
    const userId = await getUserIdFromToken(req);
    
    // Parse request body
    const { invite_code } = await req.json();

    if (!invite_code) {
      return new Response(JSON.stringify({ error: "Invite code is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up group by invite code (case-insensitive)
    const upperInviteCode = invite_code.trim().toUpperCase();
    const { data: group, error: groupError } = await serviceClient
      .from("groups")
      .select("id, name, admin_id, is_active")
      .eq("invite_code", upperInviteCode)
      .eq("is_active", true)
      .maybeSingle();

    if (groupError || !group) {
      return new Response(JSON.stringify({ error: "Invalid invite code" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user has a valid active plan
    const { data: joiningUser, error: userError } = await serviceClient
      .from("users")
      .select("plan_type, trial_ends_at, full_name")
      .eq("id", userId)
      .single();

    if (userError || !joiningUser) {
      return new Response(JSON.stringify({ error: "User profile not found" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { plan_type, trial_ends_at, full_name: userName } = joiningUser;
    const isTrialActive = plan_type === "free_trial" && new Date(trial_ends_at) > new Date();
    
    if (plan_type !== "member" && plan_type !== "admin" && !isTrialActive) {
      return new Response(JSON.stringify({ error: "You need an active plan or free trial to join groups" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is already an active member of this group
    const { data: existingMember } = await serviceClient
      .from("group_members")
      .select("id, is_active")
      .eq("group_id", group.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (existingMember && existingMember.is_active) {
      return new Response(JSON.stringify({ error: "You're already in this group" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the group admin's plan type to enforce limits
    const { data: adminUser, error: adminError } = await serviceClient
      .from("users")
      .select("plan_type, trial_ends_at")
      .eq("id", group.admin_id)
      .single();

    if (adminError || !adminUser) {
      return new Response(JSON.stringify({ error: "Group owner profile not found" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isAdminTrialActive = adminUser.plan_type === "free_trial" && new Date(adminUser.trial_ends_at) > new Date();
    const maxGroupMembers = (adminUser.plan_type === "admin") ? 20 : 10; // Admin: 20, Trial: 10

    // Count active members in the group
    const { count: activeCount, error: countError } = await serviceClient
      .from("group_members")
      .select("*", { count: "exact", head: true })
      .eq("group_id", group.id)
      .eq("is_active", true);

    if (countError) {
      return new Response(JSON.stringify({ error: "Failed to verify group occupancy" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if ((activeCount || 0) >= maxGroupMembers) {
      return new Response(JSON.stringify({ error: "This group is full" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert or reactivate group membership
    if (existingMember) {
      const { error: reactivateError } = await serviceClient
        .from("group_members")
        .update({ is_active: true, joined_at: new Date().toISOString() })
        .eq("id", existingMember.id);

      if (reactivateError) {
        throw new Error("Failed to rejoin group: " + reactivateError.message);
      }
    } else {
      const { error: insertError } = await serviceClient
        .from("group_members")
        .insert({
          group_id: group.id,
          user_id: userId,
          is_active: true,
          wake_score: 0,
          total_alarms_received: 0,
          total_completed: 0,
          current_streak: 0,
          longest_streak: 0
        });

      if (insertError) {
        throw new Error("Failed to join group: " + insertError.message);
      }
    }

    // Send FCM notification to group admin (only if joining user is NOT the admin itself)
    if (group.admin_id !== userId) {
      const { data: adminTokenData } = await serviceClient
        .from("device_tokens")
        .select("fcm_token")
        .eq("user_id", group.admin_id)
        .eq("is_active", true);

      if (adminTokenData && adminTokenData.length > 0) {
        const adminTokens = adminTokenData.map(t => t.fcm_token);
        await sendFCMToTokens(adminTokens, {
          title: "New Member Joined!",
          body: `${userName || "A new member"} joined "${group.name}".`,
          data: {
            type: "member_joined",
            group_id: group.id,
            user_id: userId
          }
        });
      }

      // Log notification in the database for the Admin
      await serviceClient.from("notifications").insert({
        user_id: group.admin_id,
        type: "member_joined",
        title: "New Member Joined!",
        body: `${userName || "A new member"} joined "${group.name}".`,
        data: {
          group_id: group.id,
          user_id: userId,
          type: "member_joined"
        }
      });
    }

    return new Response(JSON.stringify({ success: true, group_id: group.id, group_name: group.name }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
