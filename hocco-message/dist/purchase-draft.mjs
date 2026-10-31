// Keep the same opaque idempotency token after a lost response or reload.
// Store only a digest and token, never the message, company data or images.
const memory = new Map();
const storageKey = kind => 'hocco-purchase-draft-' + kind;
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const hex = bytes => Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
function read(kind) {
  try { return JSON.parse(sessionStorage.getItem(storageKey(kind)) || 'null') || memory.get(kind); }
  catch { return memory.get(kind); }
}
export async function preparePurchaseDraft(kind, payload) {
  const digest = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(canonical(payload))))));
  const previous = read(kind);
  if (previous?.digest === digest && /^[a-f0-9]{64}$/.test(previous.token || '')) return previous.token;
  const token = hex(crypto.getRandomValues(new Uint8Array(32))), entry = { digest, token };
  memory.set(kind, entry);
  try { sessionStorage.setItem(storageKey(kind), JSON.stringify(entry)); } catch {}
  return token;
}
export function clearPurchaseDraft(kind, token) {
  if (token !== undefined && read(kind)?.token !== token) return;
  memory.delete(kind);
  try { sessionStorage.removeItem(storageKey(kind)); } catch {}
}
