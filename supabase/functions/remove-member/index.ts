import { corsHeaders } from "../_shared/cors.ts";
import { getServiceClient, getUserIdFromToken } from "../_shared/supabaseClient.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const serviceClient = getServiceClient();
    const adminUserId = await getUserIdFromToken(req);
    
    // Parse request body
    const { group_id, user_id } = await req.json();

    if (!group_id || !user_id) {
      return new Response(JSON.stringify({ error: "Group ID and target User ID are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify requesting user is Admin of group_id
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

    if (group.admin_id !== adminUserId) {
      return new Response(JSON.stringify({ error: "Only the group admin can remove members" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify admin is not trying to remove themselves
    if (adminUserId === user_id) {
      return new Response(JSON.stringify({ error: "Admins cannot remove themselves from their own group" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if target user is currently an active member of this group
    const { data: member, error: memberError } = await serviceClient
      .from("group_members")
      .select("id, is_active")
      .eq("group_id", group_id)
      .eq("user_id", user_id)
      .maybeSingle();

    if (memberError || !member || !member.is_active) {
      return new Response(JSON.stringify({ error: "Target user is not an active member of this group" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Set group_members.is_active = false (soft delete)
    const { error: deactivateError } = await serviceClient
      .from("group_members")
      .update({ is_active: false })
      .eq("id", member.id);

    if (deactivateError) {
      return new Response(JSON.stringify({ error: "Failed to deactivate group membership: " + deactivateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Clean up any pending alarm completions for this user in this group
    await serviceClient
      .from("alarm_completions")
      .update({ status: "cancelled" })
      .eq("group_id", group_id)
      .eq("user_id", user_id)
      .eq("status", "pending");

    // Fetch active device tokens of the removed member
    const { data: tokensData } = await serviceClient
      .from("device_tokens")
      .select("fcm_token")
      .eq("user_id", user_id)
      .eq("is_active", true);

    if (tokensData && tokensData.length > 0) {
      const tokens = tokensData.map(t => t.fcm_token);
      
      // Build FCM silent payload
      const fcmData = {
        type: "member_removed",
        group_id: group_id,
        group_name: group.name
      };

      edgeSendFCM(tokens, fcmData);
    }

    // Insert database notification log for the removed member
    await serviceClient.from("notifications").insert({
      user_id: user_id,
      type: "member_removed",
      title: "Removed from group",
      body: `You have been removed from the group "${group.name}".`,
      data: {
        group_id: group_id,
        type: "member_removed"
      }
    });

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
