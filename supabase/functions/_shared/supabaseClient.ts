import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export function getServiceClient() {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
    }
  });
}

export function getUserClient(req: Request) {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const authHeader = req.headers.get("Authorization");
  
  if (!authHeader) {
    throw new Error("Missing Authorization header");
  }
  
  return createClient(url, anonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
    auth: {
      persistSession: false,
    }
  });
}

export async function getUserIdFromToken(req: Request): Promise<string> {
  const userClient = getUserClient(req);
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) {
    throw new Error("Invalid access token: " + (error?.message || "User not found"));
  }
  return user.id;
}
