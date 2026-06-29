// Generic push notification dispatcher (FCM HTTP v1)
// Accepts:
//   { user_id, title, body, data?, source?, notification_id? }      -> internal (DB trigger / service callers)
//   { test: true, user_id?, title?, body? }                          -> admin test button
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIREBASE_SERVICE_ACCOUNT = Deno.env.get("FIREBASE_SERVICE_ACCOUNT")!;

// --- FCM access token (cached) ---
let cachedToken: { token: string; exp: number } | null = null;

function b64url(input: ArrayBuffer | string) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let s = btoa(String.fromCharCode(...bytes));
  return s.replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function pemToArrayBuffer(pem: string) {
  const b64 = pem.replace(/-----BEGIN [^-]+-----/g, "")
                 .replace(/-----END [^-]+-----/g, "")
                 .replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function getAccessToken(sa: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;

  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"]
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${b64url(sig)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const json = await res.json();
  if (!json.access_token) throw new Error("FCM token error: " + JSON.stringify(json));
  cachedToken = { token: json.access_token, exp: now + (json.expires_in ?? 3600) };
  return cachedToken.token;
}

async function sendFcm(
  projectId: string,
  accessToken: string,
  token: string,
  title: string,
  body: string,
  data: Record<string,string>,
  opts: { androidCollapseKey?: string; apnsThreadId?: string } = {},
) {
  const apnsHeaders: Record<string,string> = { "apns-priority": "10" };
  if (opts.apnsThreadId) apnsHeaders["apns-collapse-id"] = opts.apnsThreadId;

  const aps: Record<string, unknown> = {
    alert: { title, body },
    sound: "default",
    "mutable-content": 1,
    "content-available": 1,
  };
  if (opts.apnsThreadId) aps["thread-id"] = opts.apnsThreadId;

  const android: Record<string, unknown> = {
    priority: "HIGH",
    notification: { sound: "default" },
  };
  if (opts.androidCollapseKey) android.collapse_key = opts.androidCollapseKey;

  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        data,
        android,
        apns: { headers: apnsHeaders, payload: { aps } },
      },
    }),
  });
  return { ok: res.ok, status: res.status, text: await res.text() };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const payload = await req.json().catch(() => ({}));
    let { user_id, title, body, data, test, android_collapse_key, apns_thread_id } = payload as any;

    // Admin test path requires JWT + admin role
    if (test) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const sb = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
      const { data: claims, error } = await sb.auth.getClaims(authHeader.replace("Bearer ", ""));
      if (error || !claims?.claims) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const callerId = claims.claims.sub;
      const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
      const { data: isAdmin } = await admin.rpc("has_role", { _user_id: callerId, _role: "admin" });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      user_id = user_id || callerId;
      title = title || "Test push notification";
      body = body || "This is a test push from My Pro Movers.";
      data = data || { test: "true" };
    }

    if (!user_id || !title || !body) {
      return new Response(JSON.stringify({ error: "Missing user_id/title/body" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: tokens, error: tErr } = await admin
      .from("device_tokens")
      .select("token, platform")
      .eq("user_id", user_id);
    if (tErr) throw tErr;
    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: "no_devices" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sa = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
    const accessToken = await getAccessToken(sa);
    const stringData: Record<string,string> = {};
    for (const [k, v] of Object.entries(data ?? {})) stringData[k] = String(v);

    const results = await Promise.all(
      tokens.map((t) => sendFcm(sa.project_id, accessToken, t.token, title, body, stringData))
    );

    // Clean up invalid tokens
    const invalid: string[] = [];
    results.forEach((r, i) => {
      if (!r.ok && (r.status === 404 || r.status === 400) && /UNREGISTERED|INVALID_ARGUMENT|NOT_FOUND/i.test(r.text)) {
        invalid.push(tokens[i].token);
      }
    });
    if (invalid.length) {
      await admin.from("device_tokens").delete().in("token", invalid);
    }

    return new Response(JSON.stringify({
      ok: true,
      sent: results.filter(r => r.ok).length,
      failed: results.filter(r => !r.ok).length,
      cleaned: invalid.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("send-push-notification error", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
