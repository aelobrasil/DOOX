import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { sendNotification } from "npm:web-push-neo@0.1.2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const LEGACY_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SECRET_KEYS_RAW = Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}";
let MODERN_SERVICE_KEY = "";
try { MODERN_SERVICE_KEY = JSON.parse(SECRET_KEYS_RAW)?.default ?? ""; } catch { /* legacy fallback */ }
const SERVICE_KEY = LEGACY_SERVICE_KEY || MODERN_SERVICE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("missing_supabase_admin_credentials");

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const OFFICIAL_ORIGIN = "https://hocco-impulsionadores.vercel.app";
const ALLOWED_AUDIENCES = new Set(["all", "user", "streak_risk", "inactive_today"]);

function cors(origin: string | null) {
  const allowed = origin === OFFICIAL_ORIGIN || Boolean(origin?.match(/^https:\/\/hocco-impulsionadores-[a-z0-9-]+\.vercel\.app$/i));
  return {
    "Access-Control-Allow-Origin": allowed && origin ? origin : OFFICIAL_ORIGIN,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hocco-cron",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
  };
}

function json(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), { status, headers: cors(origin) });
}

function cleanText(value: unknown, max: number) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function safePath(value: unknown) {
  const path = String(value || "/app").trim();
  if (!/^\/[A-Za-z0-9/_?&=.#%-]*$/.test(path) || path.startsWith("//")) return "/app";
  return path;
}

function saoPauloParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return { date: `${map.year}-${map.month}-${map.day}`, hour: Number(map.hour || 0) };
}

async function runtimeSecrets() {
  const { data, error } = await admin.rpc("get_push_runtime_secrets");
  if (error) throw new Error(`push_secrets_unavailable:${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.vapid_private_key || !row?.cron_secret) throw new Error("push_secrets_missing");
  return row as { vapid_private_key: string; cron_secret: string };
}

async function currentPushConfig() {
  const { data, error } = await admin.from("hocco_push_config").select("vapid_public_key,vapid_version,enabled").eq("id", true).single();
  if (error || !data?.enabled) throw new Error("push_not_configured");
  return data as { vapid_public_key: string; vapid_version: number; enabled: boolean };
}

async function ownerFromRequest(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: row } = await admin.from("hocco_admins").select("user_id,role").eq("user_id", data.user.id).eq("role", "owner").maybeSingle();
  return row ? data.user : null;
}

async function authorize(req: Request, cronSecret: string) {
  const providedCron = req.headers.get("x-hocco-cron") || "";
  if (providedCron && providedCron === cronSecret) return { kind: "cron" as const, user: null };
  const user = await ownerFromRequest(req);
  if (user) return { kind: "owner" as const, user };
  return null;
}

async function createAutomaticCampaignIfNeeded() {
  const { date, hour } = saoPauloParts();
  if (hour < 19 || hour > 22) return;
  const { data: recipients, error: recError } = await admin.rpc("push_recipients", { p_audience: "streak_risk", p_target_user_id: null });
  if (recError || !recipients?.length) return;
  const dedupe = `auto:streak-risk:${date}`;
  await admin.from("hocco_push_campaigns").upsert({
    title: "HOCCO · sua ofensiva está em risco",
    body: "Entre hoje para manter sua sequência ativa e acompanhar Hypes, HC e benefícios.",
    url: "/app",
    audience: "streak_risk",
    source: "automation",
    status: "QUEUED",
    scheduled_at: new Date().toISOString(),
    dedupe_key: dedupe,
  }, { onConflict: "dedupe_key", ignoreDuplicates: true });
}

async function logDelivery(row: Record<string, unknown>) {
  const { error } = await admin.from("hocco_push_delivery_log").insert(row);
  if (error) console.error("push_delivery_log_failed", error.message);
}

async function markFailure(subscriptionId: string, message: string, disable: boolean) {
  const { data } = await admin.from("impulsionadores_push_subscriptions").select("failure_count").eq("id", subscriptionId).maybeSingle();
  const failures = Number(data?.failure_count || 0) + 1;
  await admin.from("impulsionadores_push_subscriptions").update({
    enabled: disable ? false : failures < 5,
    failure_count: failures,
    last_error: message.slice(0, 500),
    last_push_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", subscriptionId);
}

async function sendCampaign(campaign: any, secrets: { vapid_private_key: string }, config: { vapid_public_key: string }) {
  const lock = await admin.from("hocco_push_campaigns")
    .update({ status: "PROCESSING", started_at: new Date().toISOString() })
    .eq("id", campaign.id).eq("status", "QUEUED")
    .select("id").maybeSingle();
  if (lock.error || !lock.data) return { skipped: true };

  const { data: recipients, error: recError } = await admin.rpc("push_recipients", {
    p_audience: campaign.audience,
    p_target_user_id: campaign.target_user_id || null,
  });
  if (recError) {
    await admin.from("hocco_push_campaigns").update({ status: "FAILED", failed_count: 1, sent_at: new Date().toISOString() }).eq("id", campaign.id);
    throw new Error(`recipient_lookup_failed:${recError.message}`);
  }

  const rows = recipients || [];
  let sent = 0;
  let failed = 0;
  let cursor = 0;
  const concurrency = Math.min(20, Math.max(1, rows.length));

  async function worker() {
    while (cursor < rows.length) {
      const index = cursor++;
      const sub = rows[index];
      try {
        await sendNotification({
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth_key },
        }, JSON.stringify({
          title: campaign.title,
          body: campaign.body,
          url: campaign.url,
          tag: `hocco-${String(campaign.id).slice(0, 12)}`,
        }), {
          vapidDetails: {
            subject: OFFICIAL_ORIGIN,
            publicKey: config.vapid_public_key,
            privateKey: secrets.vapid_private_key,
          },
          TTL: 60 * 60 * 6,
          urgency: "normal",
          topic: `hocco-${String(campaign.id).replace(/-/g, "").slice(0, 24)}`,
          signal: AbortSignal.timeout(10000),
        });
        sent++;
        await admin.from("impulsionadores_push_subscriptions").update({
          last_push_at: new Date().toISOString(), last_success_at: new Date().toISOString(), failure_count: 0, last_error: null, updated_at: new Date().toISOString(),
        }).eq("id", sub.subscription_id);
        await logDelivery({ campaign_id: campaign.id, subscription_id: sub.subscription_id, user_id: sub.user_id, status: "SENT" });
      } catch (err) {
        failed++;
        const anyErr = err as any;
        const status = Number(anyErr?.statusCode || anyErr?.status || 0) || null;
        const message = String(anyErr?.message || anyErr?.body || "push_failed");
        const disable = status === 404 || status === 410;
        await markFailure(sub.subscription_id, message, disable);
        await logDelivery({ campaign_id: campaign.id, subscription_id: sub.subscription_id, user_id: sub.user_id, status: disable ? "DISABLED" : "FAILED", http_status: status, error: message.slice(0, 500) });
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const finalStatus = failed === 0 ? "SENT" : sent > 0 ? "PARTIAL" : rows.length === 0 ? "SENT" : "FAILED";
  await admin.from("hocco_push_campaigns").update({
    status: finalStatus,
    target_count: rows.length,
    sent_count: sent,
    failed_count: failed,
    sent_at: new Date().toISOString(),
  }).eq("id", campaign.id);
  return { campaign_id: campaign.id, target_count: rows.length, sent_count: sent, failed_count: failed, status: finalStatus };
}

async function processDue(secrets: any, config: any) {
  await createAutomaticCampaignIfNeeded();
  const { data, error } = await admin.from("hocco_push_campaigns")
    .select("*")
    .eq("status", "QUEUED")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(10);
  if (error) throw new Error(`campaign_queue_failed:${error.message}`);
  const results = [];
  for (const campaign of data || []) {
    try { results.push(await sendCampaign(campaign, secrets, config)); }
    catch (error) { results.push({ campaign_id: campaign.id, error: String((error as Error)?.message || error) }); }
  }
  return results;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, origin);

  try {
    const secrets = await runtimeSecrets();
    const auth = await authorize(req, secrets.cron_secret);
    if (!auth) return json({ error: "not_authorized" }, 401, origin);
    const config = await currentPushConfig();
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");

    if (action === "process_due") {
      const results = await processDue(secrets, config);
      return json({ ok: true, processed: results.length, results }, 200, origin);
    }

    if (action === "create_campaign") {
      if (auth.kind !== "owner" || !auth.user) return json({ error: "owner_required" }, 403, origin);
      const title = cleanText(body?.title, 80);
      const message = cleanText(body?.body, 220);
      const audience = String(body?.audience || "all");
      const targetUserId = body?.target_user_id ? String(body.target_user_id) : null;
      const url = safePath(body?.url);
      if (!title || !message || !ALLOWED_AUDIENCES.has(audience)) return json({ error: "invalid_campaign" }, 400, origin);
      if (audience === "user" && !targetUserId) return json({ error: "target_user_required" }, 400, origin);
      let scheduled = new Date();
      if (body?.scheduled_at) {
        scheduled = new Date(String(body.scheduled_at));
        if (Number.isNaN(scheduled.getTime())) return json({ error: "invalid_schedule" }, 400, origin);
      }
      const { data: campaign, error } = await admin.from("hocco_push_campaigns").insert({
        title, body: message, url, audience, target_user_id: targetUserId, source: "manual", status: "QUEUED", scheduled_at: scheduled.toISOString(), created_by: auth.user.id,
      }).select("*").single();
      if (error) return json({ error: "campaign_create_failed", detail: error.message }, 400, origin);
      let delivery = null;
      if (scheduled.getTime() <= Date.now() + 5000) delivery = await sendCampaign(campaign, secrets, config);
      return json({ ok: true, campaign: { id: campaign.id, status: delivery?.status || campaign.status, scheduled_at: campaign.scheduled_at }, delivery }, 200, origin);
    }

    return json({ error: "unknown_action" }, 400, origin);
  } catch (error) {
    console.error("push_dispatch_error", String((error as Error)?.message || error));
    return json({ error: "push_dispatch_failed" }, 500, origin);
  }
});
