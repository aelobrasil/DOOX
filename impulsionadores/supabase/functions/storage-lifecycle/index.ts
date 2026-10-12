import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const URL = Deno.env.get("SUPABASE_URL") ?? "";
const LEGACY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SECRET_SET = Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}";
let MODERN = "";
try { MODERN = JSON.parse(SECRET_SET)?.default ?? ""; } catch {}
const SERVICE_KEY = LEGACY || MODERN;
if (!URL || !SERVICE_KEY) throw new Error("missing_supabase_admin_credentials");

const admin = createClient(URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const BUCKET = "impulsionadores-avatars";
const STORAGE_QUOTA = 1024 * 1024 * 1024;

type StorageItem = { id?: string | null; name: string; created_at?: string | null; updated_at?: string | null; metadata?: Record<string, unknown> | null };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
}

function pathFromUrl(value: unknown) {
  const text = String(value ?? "");
  const markers = [
    `/storage/v1/object/public/${BUCKET}/`,
    `/storage/v1/object/sign/${BUCKET}/`,
    `/storage/v1/object/authenticated/${BUCKET}/`,
  ];
  for (const marker of markers) {
    const index = text.indexOf(marker);
    if (index >= 0) {
      const raw = text.slice(index + marker.length).split("?")[0].split("#")[0];
      try { return decodeURIComponent(raw); } catch { return raw; }
    }
  }
  return null;
}

async function addReferences(set: Set<string>, table: string, columns: string[]) {
  const { data, error } = await admin.from(table).select(columns.join(",")).limit(10000);
  if (error) throw new Error(`reference_${table}:${error.message}`);
  for (const row of data ?? []) {
    for (const column of columns) {
      const path = pathFromUrl((row as Record<string, unknown>)[column]);
      if (path) set.add(path);
    }
  }
}

async function referencedPaths() {
  const set = new Set<string>();
  await Promise.all([
    addReferences(set, "impulsionadores_perfis", ["avatar_url"]),
    addReferences(set, "hype_solicitacoes", ["logo_url", "capa_url"]),
    addReferences(set, "hype_empresas", ["logo_url", "capa_url"]),
    addReferences(set, "hocco_patrocinios", ["logo_url"]),
    addReferences(set, "hocco_experiencias", ["imagem_url"]),
    addReferences(set, "hype_agenda", ["logo_url_snapshot", "cover_url_snapshot"]),
  ]);
  return set;
}

async function listTree(prefix = ""): Promise<Array<StorageItem & { path: string }>> {
  const out: Array<StorageItem & { path: string }> = [];
  let offset = 0;
  while (true) {
    const { data, error } = await admin.storage.from(BUCKET).list(prefix, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`storage_list:${error.message}`);
    const rows = (data ?? []) as StorageItem[];
    for (const item of rows) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id) out.push({ ...item, path });
      else out.push(...await listTree(path));
    }
    if (rows.length < 1000) break;
    offset += rows.length;
  }
  return out;
}

function fileSize(item: StorageItem) {
  const raw = item.metadata?.size;
  const n = typeof raw === "number" ? raw : Number(raw ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function eligiblePath(path: string) {
  return path.includes("/requests/") || path.includes("/sponsors/");
}

async function runLifecycle() {
  const [files, references] = await Promise.all([listTree(""), referencedPaths()]);
  const storageBytes = files.reduce((sum, item) => sum + fileSize(item), 0);
  const pct = storageBytes / STORAGE_QUOTA * 100;
  const ageDays = pct >= 80 ? 14 : pct >= 65 ? 30 : 60;
  const cutoff = Date.now() - ageDays * 86400000;
  const candidates = files.filter((item) => {
    if (!eligiblePath(item.path) || references.has(item.path)) return false;
    const created = Date.parse(item.created_at || item.updated_at || "");
    return Number.isFinite(created) && created < cutoff;
  });

  let removed = 0;
  let removedBytes = 0;
  for (let i = 0; i < candidates.length; i += 100) {
    const chunk = candidates.slice(i, i + 100);
    const { error } = await admin.storage.from(BUCKET).remove(chunk.map((x) => x.path));
    if (error) throw new Error(`storage_remove:${error.message}`);
    removed += chunk.length;
    removedBytes += chunk.reduce((sum, item) => sum + fileSize(item), 0);
  }

  const { data: owner } = await admin.from("hocco_admins").select("user_id").eq("role", "owner").limit(1).maybeSingle();
  if (owner?.user_id) {
    await admin.from("hocco_admin_audit").insert({
      admin_user_id: owner.user_id,
      action: "storage_lifecycle_auto",
      entity_type: "storage",
      entity_id: BUCKET,
      metadata: { storage_bytes_before: storageBytes, storage_pct: Number(pct.toFixed(3)), retention_days: ageDays, scanned: files.length, referenced: references.size, eligible_candidates: candidates.length, removed, removed_bytes: removedBytes, executed_at: new Date().toISOString() },
    });
  }

  return { ok: true, storage_bytes_before: storageBytes, storage_pct: Number(pct.toFixed(3)), retention_days: ageDays, scanned: files.length, referenced: references.size, candidates: candidates.length, removed, removed_bytes: removedBytes };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const { data: expected, error } = await admin.rpc("get_storage_lifecycle_secret");
    if (error || !expected) throw new Error("storage_secret_unavailable");
    const provided = req.headers.get("x-hocco-storage-cron") ?? "";
    if (!provided || provided !== expected) return json({ error: "not_authorized" }, 401);
    return json(await runLifecycle());
  } catch (error) {
    console.error("storage_lifecycle_error", String((error as Error)?.message || error));
    return json({ error: "storage_lifecycle_failed" }, 500);
  }
});
