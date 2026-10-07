export const HOCCO_API_VERSION = '1.4.0';
export const HOCCO_SOURCE_TAG = 'HOCCO-V108-CANONICAL-2026-10-06';

export const HOCCO_SUPABASE_URL = String(process.env.HOCCO_SUPABASE_URL || '').replace(/\/$/, '');
export const HOCCO_SUPABASE_SECRET_KEY = String(process.env.HOCCO_SUPABASE_SECRET_KEY || '').trim();
export const HOCCO_EDGE_INTERNAL_KEY = String(process.env.HOCCO_EDGE_INTERNAL_KEY || '').trim();
export const HOCCO_PUBLIC_BASE_URL = String(process.env.HOCCO_PUBLIC_BASE_URL || '').replace(/\/$/, '');

export function hoccoConfigOk() {
  return Boolean(HOCCO_SUPABASE_URL && HOCCO_SUPABASE_SECRET_KEY && (HOCCO_EDGE_INTERNAL_KEY || HOCCO_SUPABASE_SECRET_KEY));
}

export function hoccoKeyType() {
  if (HOCCO_EDGE_INTERNAL_KEY) return 'edge_proxy';
  const key = HOCCO_SUPABASE_SECRET_KEY;
  if (key.startsWith('sb_secret_')) return 'sb_secret';
  if (key.startsWith('sb_publishable_')) return 'sb_publishable';
  if (key.startsWith('eyJ')) return 'legacy_jwt';
  return key ? 'unknown' : 'missing';
}

export function hoccoProjectRef() {
  try {
    return new URL(HOCCO_SUPABASE_URL).hostname.split('.')[0] || null;
  } catch {
    return null;
  }
}

async function parseResponse(response) {
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const message = data?.message || data?.details || data?.error || data?.hint || `Supabase HTTP ${response.status}`;
    const err = new Error(message);
    err.status = response.status;
    err.payload = data;
    err.code = data?.code || `SUPABASE_HTTP_${response.status}`;
    throw err;
  }
  return data;
}

export async function hoccoSupabase(path, options = {}) {
  if (!hoccoConfigOk()) {
    const err = new Error('HOCCO_API_NOT_CONFIGURED');
    err.code = 'HOCCO_API_NOT_CONFIGURED';
    throw err;
  }

  if (HOCCO_EDGE_INTERNAL_KEY) {
    const method = String(options.method || 'GET').toUpperCase();
    const response = await fetch(`${HOCCO_SUPABASE_URL}/functions/v1/hocco-db-proxy`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-hocco-internal': HOCCO_EDGE_INTERNAL_KEY,
        'User-Agent': `HOCCO-Backend/${HOCCO_API_VERSION}`
      },
      body: JSON.stringify({
        path,
        method,
        body: options.body ?? null,
        headers: options.headers || {}
      })
    });
    return parseResponse(response);
  }

  const response = await fetch(`${HOCCO_SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: HOCCO_SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${HOCCO_SUPABASE_SECRET_KEY}`,
      Accept: 'application/json',
      'User-Agent': `HOCCO-Backend/${HOCCO_API_VERSION}`,
      'X-Client-Info': `hocco-api-v${HOCCO_API_VERSION}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  return parseResponse(response);
}
