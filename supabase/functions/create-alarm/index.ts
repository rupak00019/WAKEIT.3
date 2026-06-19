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
    const { 
      group_id, 
      title, 
      alarm_time, 
      difficulty, 
      sound_url, 
      is_recurring, 
      recurrence_days, 
      recurrence_end_date 
    } = await req.json();

    if (!group_id || !title || !alarm_time || !difficulty) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user is the admin of the group
    const { data: group, error: groupError } = await serviceClient
      .from("groups")
      .select("id, name, admin_id, is_active")
      .eq("id", group_id)
      .single();

    if (groupError || !group || !group.is_active) {
      return new Response(JSON.stringify({ error: "Group not found or is inactive" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (group.admin_id !== userId) {
      return new Response(JSON.stringify({ error: "You must be the group admin to create alarms" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate alarm time is in the future
    const alarmDate = new Date(alarm_time);
    if (alarmDate <= new Date()) {
      return new Response(JSON.stringify({ error: "Alarm time must be in the future" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the admin's plan type
    const { data: adminUser, error: adminError } = await serviceClient
      .from("users")
      .select("plan_type, trial_ends_at")
      .eq("id", group.admin_id)
      .single();

    if (adminError || !adminUser) {
      return new Response(JSON.stringify({ error: "Admin account info not found" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { plan_type, trial_ends_at } = adminUser;
    const isTrialActive = plan_type === "free_trial" && new Date(trial_ends_at) > new Date();
    
    if (plan_type !== "admin" && !isTrialActive) {
      return new Response(JSON.stringify({ error: "You need an Admin plan or active Free Trial to schedule alarms" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Count active alarms for this group
    const { count, error: alarmCountError } = await serviceClient
      .from("alarms")
      .select("*", { count: "exact", head: true })
      .eq("group_id", group_id)
      .in("status", ["scheduled", "active"]);

    if (alarmCountError) {
      return new Response(JSON.stringify({ error: "Failed to verify alarm limits" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const maxAlarms = (plan_type === "admin") ? 20 : 5; // Trial: 5, Admin: 20
    if ((count || 0) >= maxAlarms) {
      return new Response(JSON.stringify({ error: `You've reached the alarm limit of ${maxAlarms} for this group` }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert alarm row
    const { data: alarm, error: insertError } = await serviceClient
      .from("alarms")
      .insert({
        group_id,
        created_by: userId,
        title,
        alarm_time,
        difficulty,
        sound_url: sound_url || null,
        is_recurring: is_recurring || false,
        recurrence_days: recurrence_days || null,
        recurrence_end_date: recurrence_end_date || null,
        status: "scheduled"
      })
      .select()
      .single();

    if (insertError || !alarm) {
      return new Response(JSON.stringify({ error: "Failed to insert alarm: " + insertError?.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch active members of the group
    const { data: members, error: membersError } = await serviceClient
      .from("group_members")
      .select("user_id")
      .eq("group_id", group_id)
      .eq("is_active", true);

    if (membersError || !members) {
      return new Response(JSON.stringify({ error: "Failed to retrieve group members" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const memberIds = members.map(m => m.user_id);

    // Create alarm completions rows
    const completionsData = memberIds.map(memberId => ({
      alarm_id: alarm.id,
      user_id: memberId,
      group_id: group_id,
      status: "pending",
      challenge_difficulty: difficulty
    }));

    const { error: completionsError } = await serviceClient
      .from("alarm_completions")
      .insert(completionsData);

    if (completionsError) {
      // Clean up alarm if completions creation fails
      await serviceClient.from("alarms").delete().eq("id", alarm.id);
      return new Response(JSON.stringify({ error: "Failed to create alarm completions: " + completionsError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch FCM tokens of all active members
    const { data: tokensData, error: tokensError } = await serviceClient
      .from("device_tokens")
      .select("fcm_token")
      .in("user_id", memberIds)
      .eq("is_active", true);

    if (!tokensError && tokensData && tokensData.length > 0) {
      const tokens = tokensData.map(t => t.fcm_token);
      
      // Send silent FCM message
      const fcmData = {
        type: "alarm_sync",
        alarm_id: alarm.id,
        alarm_time_utc: alarm.alarm_time,
        difficulty: alarm.difficulty,
        sound_url: alarm.sound_url || "",
        group_id: alarm.group_id,
        group_name: group.name,
        alarm_title: alarm.title,
        is_recurring: String(alarm.is_recurring),
        recurrence_days: alarm.recurrence_days ? JSON.stringify(alarm.recurrence_days) : "",
        recurrence_end_date: alarm.recurrence_end_date || ""
      };

      // Background FCM task
      edgeSendFCM(tokens, fcmData);
    }

    // Create notifications and insert log records
    const notificationsData = memberIds.map(memberId => ({
      user_id: memberId,
      type: "alarm_created",
      title: "New Alarm Scheduled",
      body: `A new alarm "${title}" has been scheduled in "${group.name}".`,
      data: { alarm_id: alarm.id, group_id: group_id, type: "alarm_created" }
    }));

    await serviceClient.from("notifications").insert(notificationsData);

    return new Response(JSON.stringify({ success: true, alarm_id: alarm.id }), {
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

// Helper to sign JWT using Web Crypto API and retrieve OAuth2 token for FCM
async function getAccessToken(serviceAccount: any): Promise<string> {
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  let privateKeyPem = serviceAccount.private_key || "";
  
  const pem = privateKeyPem
    .replace(pemHeader, "")
    .replace(pemFooter, "")
    .replace(/\s/g, "");
  
  // Decode base64 PEM to binary ArrayBuffer
  const binaryString = atob(pem);
  const binaryDer = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    binaryDer[i] = binaryString.charCodeAt(i);
  }
  
  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );
  
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };
  
  const textEncoder = new TextEncoder();
  
  // Helper for base64url encoding
  const base64UrlEncode = (str: string) => {
    return btoa(str)
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  };
  
  const base64UrlHeader = base64UrlEncode(JSON.stringify(header));
  const base64UrlPayload = base64UrlEncode(JSON.stringify(payload));
  
  const unsignedToken = `${base64UrlHeader}.${base64UrlPayload}`;
  const signatureBuffer = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    textEncoder.encode(unsignedToken)
  );
  
  const signatureArray = new Uint8Array(signatureBuffer);
  // Base64URL encode the signature
  let signatureBinary = "";
  for (let i = 0; i < signatureArray.byteLength; i++) {
    signatureBinary += String.fromCharCode(signatureArray[i]);
  }
  const base64UrlSignature = btoa(signatureBinary)
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  
  const signedJwt = `${unsignedToken}.${base64UrlSignature}`;
  
  // Exchange JWT for access token
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signedJwt,
    }),
  });
  
  const data = await response.json();
  if (data.error) {
    throw new Error(`Failed to exchange token: ${data.error_description || data.error}`);
  }
  return data.access_token;
}

export async function sendFCMToTokens(
  tokens: string[],
  payload: {
    title?: string;
    body?: string;
    data?: Record<string, string>;
  }
) {
  if (tokens.length === 0) return;
  
  const serviceAccountString = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
  if (!serviceAccountString) {
    console.log("FCM Warning: FIREBASE_SERVICE_ACCOUNT secret not configured. Logging notification details:");
    console.log("Tokens count:", tokens.length);
    console.log("Tokens:", tokens);
    console.log("Payload:", payload);
    return;
  }
  
  try {
    const serviceAccount = JSON.parse(serviceAccountString);
    const accessToken = await getAccessToken(serviceAccount);
    const projectId = serviceAccount.project_id;
    
    // Send to each token
    for (const token of tokens) {
      const messageBody: any = {
        message: {
          token,
          data: payload.data || {},
        }
      };
      
      if (payload.title || payload.body) {
        messageBody.message.notification = {
          title: payload.title,
          body: payload.body,
        };
      }
      
      const response = await fetch(
        `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(messageBody),
        }
      );
      
      const result = await response.json();
      if (!response.ok) {
        console.error(`FCM error sending to token ${token}:`, result);
      } else {
        console.log(`FCM success sending to token ${token}`);
      }
    }
  } catch (error) {
    console.error("FCM Send error:", error);
  }
}

// Non-blocking fire and forget helper for FCM delivery
async function edgeSendFCM(tokens: string[], data: Record<string, string>) {
  try {
    await sendFCMToTokens(tokens, { data });
  } catch (err) {
    console.error("Async FCM send failed:", err);
  }
}
