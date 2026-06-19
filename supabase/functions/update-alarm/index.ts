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
      alarm_id,
      title, 
      alarm_time, 
      difficulty, 
      sound_url, 
      is_recurring, 
      recurrence_days, 
      recurrence_end_date 
    } = await req.json();

    if (!alarm_id) {
      return new Response(JSON.stringify({ error: "Alarm ID is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch existing alarm
    const { data: alarm, error: alarmError } = await serviceClient
      .from("alarms")
      .select("*")
      .eq("id", alarm_id)
      .single();

    if (alarmError || !alarm) {
      return new Response(JSON.stringify({ error: "Alarm not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (alarm.status !== "scheduled") {
      return new Response(JSON.stringify({ error: "Only scheduled alarms can be updated" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch group details to check admin authorization
    const { data: group, error: groupError } = await serviceClient
      .from("groups")
      .select("admin_id, name")
      .eq("id", alarm.group_id)
      .single();

    if (groupError || !group) {
      return new Response(JSON.stringify({ error: "Associated group not found" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (group.admin_id !== userId) {
      return new Response(JSON.stringify({ error: "You must be the group admin to update alarms" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify alarm rings in more than 1 minute
    const currentAlarmTime = new Date(alarm.alarm_time);
    const newAlarmTime = alarm_time ? new Date(alarm_time) : currentAlarmTime;
    const now = new Date();
    
    if (newAlarmTime.getTime() - now.getTime() < 60000) {
      return new Response(JSON.stringify({ error: "Alarm rings too soon to edit (must be > 1 minute in future)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prepare update data
    const updateData: any = { updated_at: new Date().toISOString() };
    if (title !== undefined) updateData.title = title;
    if (alarm_time !== undefined) updateData.alarm_time = alarm_time;
    if (difficulty !== undefined) updateData.difficulty = difficulty;
    if (sound_url !== undefined) updateData.sound_url = sound_url;
    if (is_recurring !== undefined) updateData.is_recurring = is_recurring;
    if (recurrence_days !== undefined) updateData.recurrence_days = recurrence_days;
    if (recurrence_end_date !== undefined) updateData.recurrence_end_date = recurrence_end_date;

    const { data: updatedAlarm, error: updateError } = await serviceClient
      .from("alarms")
      .update(updateData)
      .eq("id", alarm_id)
      .select()
      .single();

    if (updateError || !updatedAlarm) {
      return new Response(JSON.stringify({ error: "Failed to update alarm: " + updateError?.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch active member ids in group
    const { data: members, error: membersError } = await serviceClient
      .from("group_members")
      .select("user_id")
      .eq("group_id", alarm.group_id)
      .eq("is_active", true);

    if (members && members.length > 0) {
      const memberIds = members.map(m => m.user_id);

      // Fetch active device tokens
      const { data: tokensData, error: tokensError } = await serviceClient
        .from("device_tokens")
        .select("fcm_token")
        .in("user_id", memberIds)
        .eq("is_active", true);

      if (!tokensError && tokensData && tokensData.length > 0) {
        const tokens = tokensData.map(t => t.fcm_token);
        
        // Build FCM payload
        const fcmData = {
          type: "alarm_update",
          alarm_id: alarm_id,
          alarm_time_utc: updatedAlarm.alarm_time,
          difficulty: updatedAlarm.difficulty,
          sound_url: updatedAlarm.sound_url || "",
          alarm_title: updatedAlarm.title
        };

        edgeSendFCM(tokens, fcmData);
      }

      // Create notification logs
      const notificationsData = memberIds.map(memberId => ({
        user_id: memberId,
        type: "alarm_updated",
        title: "Alarm Updated",
        body: `Alarm "${updatedAlarm.title}" in "${group.name}" has been rescheduled.`,
        data: { alarm_id: alarm_id, group_id: alarm.group_id, type: "alarm_updated" }
      }));

      await serviceClient.from("notifications").insert(notificationsData);
    }

    return new Response(JSON.stringify({ success: true }), {
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
