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
    const { alarm_id, status, completed_at, attempts } = await req.json();

    if (!alarm_id || !status) {
      return new Response(JSON.stringify({ error: "Alarm ID and status are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (status !== "completed" && status !== "missed") {
      return new Response(JSON.stringify({ error: "Invalid status. Must be completed or missed." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the alarm completion row
    const { data: completion, error: completionError } = await serviceClient
      .from("alarm_completions")
      .select("*, alarms(difficulty, title, alarm_time)")
      .eq("alarm_id", alarm_id)
      .eq("user_id", userId)
      .eq("status", "pending")
      .single();

    if (completionError || !completion) {
      return new Response(JSON.stringify({ error: "Pending alarm completion not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const alarmDifficulty = completion.alarms.difficulty;
    const alarmTitle = completion.alarms.title;
    const alarmTimeUtc = completion.alarms.alarm_time;
    const groupId = completion.group_id;

    // Update the completion row
    const { error: updateCompletionError } = await serviceClient
      .from("alarm_completions")
      .update({
        status: status,
        completed_at: status === "completed" ? (completed_at || new Date().toISOString()) : null,
        attempts: attempts || 0,
        challenge_difficulty: alarmDifficulty
      })
      .eq("id", completion.id);

    if (updateCompletionError) {
      return new Response(JSON.stringify({ error: "Failed to update alarm completion: " + updateCompletionError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch user details for the notifications
    const { data: user } = await serviceClient
      .from("users")
      .select("full_name")
      .eq("id", userId)
      .single();

    const userName = user?.full_name || "A member";

    // Retrieve group member record to update stats
    const { data: memberStats, error: statsError } = await serviceClient
      .from("group_members")
      .select("*")
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .single();

    if (statsError || !memberStats) {
      return new Response(JSON.stringify({ error: "Group member stats not found" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Recalculate stats
    const isCompleted = status === "completed";
    const totalCompleted = memberStats.total_completed + (isCompleted ? 1 : 0);
    const totalAlarmsReceived = memberStats.total_alarms_received + 1;
    const wakeScore = Math.round((totalCompleted / totalAlarmsReceived) * 100);

    let currentStreak = memberStats.current_streak;
    
    if (isCompleted) {
      // Find the last completed alarm in the group for this user before the current alarm time
      const { data: prevCompletions } = await serviceClient
        .from("alarm_completions")
        .select("*, alarms(alarm_time)")
        .eq("group_id", groupId)
        .eq("user_id", userId)
        .neq("alarm_id", alarm_id)
        .order("completed_at", { ascending: false })
        .limit(1);

      if (prevCompletions && prevCompletions.length > 0) {
        const lastCompletion = prevCompletions[0];
        const lastAlarmTime = new Date(lastCompletion.alarms.alarm_time);
        const thisAlarmTime = new Date(alarmTimeUtc);
        const diffHours = (thisAlarmTime.getTime() - lastAlarmTime.getTime()) / (1000 * 60 * 60);
        
        // If the last alarm was within 28 hours and it was completed, increment streak, else start fresh at 1
        if (lastCompletion.status === "completed" && diffHours <= 28) {
          currentStreak += 1;
        } else {
          currentStreak = 1;
        }
      } else {
        currentStreak = 1;
      }
    } else {
      // Missed resets streak to 0
      currentStreak = 0;
    }

    const longestStreak = Math.max(memberStats.longest_streak, currentStreak);

    // Update group_members stats
    const { error: updateStatsError } = await serviceClient
      .from("group_members")
      .update({
        total_completed: totalCompleted,
        total_alarms_received: totalAlarmsReceived,
        wake_score: wakeScore,
        current_streak: currentStreak,
        longest_streak: longestStreak
      })
      .eq("id", memberStats.id);

    if (updateStatsError) {
      console.error("Failed to update member stats:", updateStatsError);
    }

    // Fetch group details to get group admin_id and name
    const { data: group } = await serviceClient
      .from("groups")
      .select("admin_id, name")
      .eq("id", groupId)
      .single();

    if (group && isCompleted && group.admin_id !== userId) {
      // Send FCM notification to Admin (only if the user who completed is NOT the admin)
      const { data: adminTokenData } = await serviceClient
        .from("device_tokens")
        .select("fcm_token")
        .eq("user_id", group.admin_id)
        .eq("is_active", true);

      if (adminTokenData && adminTokenData.length > 0) {
        const adminTokens = adminTokenData.map(t => t.fcm_token);
        const fcmData = {
          type: "challenge_complete",
          member_name: userName,
          alarm_title: alarmTitle,
          completed_at: completed_at || new Date().toISOString(),
          group_id: groupId
        };

        await sendFCMToTokens(adminTokens, {
          title: "Alarm Solved!",
          body: `${userName} successfully solved the math challenge for "${alarmTitle}".`,
          data: fcmData
        });
      }

      // Log notification in the database for group Admin
      await serviceClient.from("notifications").insert({
        user_id: group.admin_id,
        type: "challenge_complete",
        title: "Alarm Solved!",
        body: `${userName} successfully solved the math challenge for "${alarmTitle}".`,
        data: {
          alarm_id: alarm_id,
          group_id: groupId,
          type: "challenge_complete"
        }
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      wake_score: wakeScore, 
      current_streak: currentStreak 
    }), {
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
