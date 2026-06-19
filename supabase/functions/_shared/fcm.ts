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
