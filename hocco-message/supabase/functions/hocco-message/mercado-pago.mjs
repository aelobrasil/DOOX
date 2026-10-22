const API = "https://api.mercadopago.com";
const utf8 = new TextEncoder();

function toHex(bytes) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

async function stableIdempotencyKey(value) {
  const digest = await crypto.subtle.digest("SHA-256", utf8.encode(value));
  const hex = toHex(new Uint8Array(digest));
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function paymentReference(kind, code) {
  if (!["order", "community", "sponsor"].includes(kind) || !/^[A-Z0-9-]{8,24}$/.test(code)) {
    throw new Error("Referência de pagamento inválida.");
  }
  return `hocco:${kind}:${code}`;
}

export async function createPreference({
  accessToken,
  externalReference,
  title,
  priceCents,
  origin,
  returnPath,
  notificationUrl,
  payerEmail,
  fetcher = fetch,
}) {
  if (!accessToken) throw new Error("O pagamento online está em configuração.");
  if (!Number.isSafeInteger(priceCents) || priceCents < 100 || priceCents > 999999) {
    throw new Error("Valor de pagamento inválido.");
  }
  const target = new URL(origin);
  if (target.protocol !== "https:") throw new Error("Origem de pagamento inválida.");
  const returnUrl = new URL(returnPath, target.origin).href;
  const body = {
    items: [{
      id: externalReference,
      title,
      quantity: 1,
      currency_id: "BRL",
      unit_price: Number((priceCents / 100).toFixed(2)),
    }],
    external_reference: externalReference,
    notification_url: notificationUrl,
    back_urls: { success: returnUrl, pending: returnUrl, failure: returnUrl },
    auto_return: "approved",
    statement_descriptor: "HOCCO",
  };
  if (payerEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payerEmail)) {
    body.payer = { email: payerEmail };
  }
  const response = await fetcher(`${API}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": await stableIdempotencyKey(externalReference),
    },
    body: JSON.stringify(body),
  });
  let data = {};
  try { data = await response.json(); } catch {}
  if (!response.ok) throw new Error(`Não foi possível criar o checkout no Mercado Pago (HTTP ${response.status}).`);
  const checkoutUrl = data.sandbox_init_point;
  if (!checkoutUrl) throw new Error("O Mercado Pago não retornou um checkout sandbox; nenhum link de produção será usado.");
  let parsed;
  try { parsed = new URL(checkoutUrl); } catch { throw new Error("O Mercado Pago não retornou um link de checkout válido."); }
  if (parsed.protocol !== "https:" || !["mercadopago.com.br", "www.mercadopago.com.br", "mercadopago.com", "www.mercadopago.com"].includes(parsed.hostname)) {
    throw new Error("O Mercado Pago retornou um domínio de checkout inesperado.");
  }
  return { preferenceId: String(data.id || ""), checkoutUrl: parsed.href, externalReference };
}

export async function verifyWebhookSignature({ dataId, requestId, signature, secret, cryptoProvider = crypto }) {
  if (!dataId || !requestId || !signature || !secret) return false;
  const values = Object.fromEntries(signature.split(",").map((part) => {
    const index = part.indexOf("=");
    return index < 0 ? ["", ""] : [part.slice(0, index).trim(), part.slice(index + 1).trim()];
  }).filter(([key]) => key));
  if (!values.ts || !/^[a-f0-9]{64}$/i.test(values.v1 || "")) return false;
  const manifest = `id:${String(dataId).toLowerCase()};request-id:${requestId};ts:${values.ts};`;
  const key = await cryptoProvider.subtle.importKey(
    "raw",
    utf8.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = new Uint8Array(await cryptoProvider.subtle.sign("HMAC", key, utf8.encode(manifest)));
  const expected = toHex(digest);
  const received = values.v1.toLowerCase();
  let mismatch = expected.length ^ received.length;
  for (let i = 0; i < Math.max(expected.length, received.length); i++) {
    mismatch |= (expected.charCodeAt(i) || 0) ^ (received.charCodeAt(i) || 0);
  }
  return mismatch === 0;
}

export function isApprovedPayment(payment, externalReference, priceCents) {
  return payment?.status === "approved"
    && payment?.currency_id === "BRL"
    && payment?.external_reference === externalReference
    && Number.isFinite(Number(payment?.transaction_amount))
    && Math.round(Number(payment.transaction_amount) * 100) === priceCents;
}
