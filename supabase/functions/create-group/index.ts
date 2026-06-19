import { corsHeaders } from "../_shared/cors.ts";
import { getServiceClient, getUserIdFromToken } from "../_shared/supabaseClient.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const serviceClient = getServiceClient();
    const userId = await getUserIdFromToken(req);
    
    // Parse request body
    const { name, description, default_sound_url } = await req.json();
    
    // Validation: Group name cannot be empty
    if (!name || name.trim() === "") {
      return new Response(JSON.stringify({ error: "Group name is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validation: Group name max 30 characters
    if (name.length > 30) {
      return new Response(JSON.stringify({ error: "Group name cannot exceed 30 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validation: Group name has no special characters except spaces and hyphens
    const nameRegex = /^[a-zA-Z0-9\s-]+$/;
    if (!nameRegex.test(name)) {
      return new Response(JSON.stringify({ error: "Group name can only contain letters, numbers, spaces, and hyphens" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validation: Description max 100 characters
    if (description && description.length > 100) {
      return new Response(JSON.stringify({ error: "Description cannot exceed 100 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch user plan and limits
    const { data: user, error: userError } = await serviceClient
      .from("users")
      .select("plan_type, trial_ends_at")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "User not found or database error" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { plan_type, trial_ends_at } = user;
    const isTrialActive = plan_type === "free_trial" && new Date(trial_ends_at) > new Date();
    
    if (plan_type !== "admin" && !isTrialActive) {
      return new Response(JSON.stringify({ error: "You need an Admin plan or active Free Trial to create a group" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Count existing active groups for this admin
    const { count, error: countError } = await serviceClient
      .from("groups")
      .select("*", { count: "exact", head: true })
      .eq("admin_id", userId)
      .eq("is_active", true);

    if (countError) {
      return new Response(JSON.stringify({ error: "Failed to verify group limits" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const currentGroupCount = count || 0;
    const maxGroups = plan_type === "admin" ? 5 : 2; // admin=5, free_trial=2
    if (currentGroupCount >= maxGroups) {
      return new Response(JSON.stringify({ error: `You have reached the maximum group limit of ${maxGroups} for your plan` }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate unique 6-character alphanumeric invite code
    let inviteCode = "";
    let isUnique = false;
    let attempts = 0;
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    while (!isUnique && attempts < 10) {
      inviteCode = "";
      for (let i = 0; i < 6; i++) {
        inviteCode += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      
      const { data: codeCheck } = await serviceClient
        .from("groups")
        .select("id")
        .eq("invite_code", inviteCode)
        .maybeSingle();
        
      if (!codeCheck) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      throw new Error("Could not generate a unique invite code");
    }

    // Insert group
    const { data: group, error: insertError } = await serviceClient
      .from("groups")
      .insert({
        name,
        description: description || null,
        admin_id: userId,
        invite_code: inviteCode,
        default_sound_url: default_sound_url || null,
        member_count: 0 // Will be incremented by trigger when member is added
      })
      .select("id, invite_code")
      .single();

    if (insertError || !group) {
      return new Response(JSON.stringify({ error: "Failed to create group: " + insertError?.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Add Admin as the first group member (Trigger B will update member_count to 1)
    const { error: memberError } = await serviceClient
      .from("group_members")
      .insert({
        group_id: group.id,
        user_id: userId,
        is_active: true
      });

    if (memberError) {
      // Clean up group if member creation fails
      await serviceClient.from("groups").delete().eq("id", group.id);
      return new Response(JSON.stringify({ error: "Failed to register creator as group member: " + memberError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, group_id: group.id, invite_code: group.invite_code }), {
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
