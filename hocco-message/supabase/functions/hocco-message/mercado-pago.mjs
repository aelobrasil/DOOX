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
  environment = "production",
  fetcher = fetch,
}) {
  if (!accessToken) throw new Error("O pagamento online está em configuração.");
  if (!Number.isSafeInteger(priceCents) || priceCents < 1 || priceCents > 999999) {
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
  if (!response.ok) {
    const providerError = typeof data.error === "string" ? data.error : "";
    const causeCodes = Array.isArray(data.cause)
      ? data.cause.map((cause) => typeof cause?.code === "string" ? cause.code : "").filter(Boolean).slice(0, 5)
      : [];
    // Keep diagnostics useful while never logging the access token or request body.
    console.error("Mercado Pago preference rejected", {
      status: response.status,
      error: providerError,
      causeCodes,
    });
    const detail = causeCodes.length ? ` Código: ${causeCodes.join(", ")}.` : "";
    if (response.status === 403) {
      throw new Error(`O Mercado Pago recusou as permissões da conta conectada (HTTP 403). Verifique o Access Token do vendedor e a liberação do Checkout Pro.${detail}`);
    }
    if (response.status === 401) {
      throw new Error(`O Mercado Pago não autorizou o Access Token configurado (HTTP 401). Confirme se ele pertence à aplicação e ao vendedor corretos.${detail}`);
    }
    throw new Error(`Não foi possível criar o checkout no Mercado Pago (HTTP ${response.status}).${detail}`);
  }
  const mode = String(environment || "production").trim().toLowerCase();
  let checkoutUrl;
  if (mode === "test" || mode === "sandbox") {
    checkoutUrl = data.sandbox_init_point;
    if (!checkoutUrl) throw new Error("O Mercado Pago não retornou o link de checkout de teste. Confira as credenciais de teste do vendedor.");
  } else if (mode === "production" || mode === "prod") {
    checkoutUrl = data.init_point;
  } else {
    throw new Error("MP_ENVIRONMENT deve ser test ou production.");
  }
  let parsed;
  try { parsed = new URL(checkoutUrl); } catch { throw new Error("O Mercado Pago não retornou um link de checkout válido."); }
  const checkoutHost = parsed.hostname.toLowerCase().replace(/\\.$/, "");
  const officialCheckoutHost = ["mercadopago.com.br", "mercadopago.com"].some(
    (domain) => checkoutHost === domain || checkoutHost.endsWith("." + domain),
  );
  if (parsed.protocol !== "https:" || !officialCheckoutHost || parsed.username || parsed.password) {
    throw new Error("O Mercado Pago retornou um domínio de checkout inesperado.");
  }
  return { preferenceId: String(data.id || ""), checkoutUrl: parsed.href, externalReference };
}

export async function refundApprovedPayment({
  accessToken,
  paymentId,
  externalReference,
  priceCents,
  fetcher = fetch,
}) {
  if (!accessToken) throw new Error("O reembolso online está em configuração.");
  if (!/^\\d{1,24}$/.test(String(paymentId || ""))) throw new Error("Identificador do pagamento inválido.");
  if (!/^hocco:(?:order|community|sponsor):[A-Z0-9-]{8,24}$/.test(String(externalReference || ""))) throw new Error("Referência do pedido inválida.");
  if (!Number.isSafeInteger(priceCents) || priceCents < 1 || priceCents > 999999) throw new Error("Valor de reembolso inválido.");

  const headers = { Authorization: `Bearer ${accessToken}` };
  const paymentResponse = await fetcher(`${API}/v1/payments/${encodeURIComponent(paymentId)}`, { headers });
  let payment = {};
  try { payment = await paymentResponse.json(); } catch {}
  if (!paymentResponse.ok) throw new Error(`Não foi possível conferir o pagamento no Mercado Pago (HTTP ${paymentResponse.status}).`);
  if (payment.status !== "approved"
    || payment.currency_id !== "BRL"
    || payment.external_reference !== externalReference
    || !Number.isFinite(Number(payment.transaction_amount))
    || Math.round(Number(payment.transaction_amount) * 100) !== priceCents) {
    throw new Error("O pagamento não corresponde ao patrocínio ou não está disponível para devolução.");
  }

  const response = await fetcher(`${API}/v1/payments/${encodeURIComponent(paymentId)}/refunds`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
      "X-Idempotency-Key": await stableIdempotencyKey(`hocco:sponsor:refund:${paymentId}`),
    },
    body: "{}",
  });
  let refund = {};
  try { refund = await response.json(); } catch {}
  if (!response.ok) {
    const causeCodes = Array.isArray(refund.cause)
      ? refund.cause.map((cause) => typeof cause?.code === "string" ? cause.code : "").filter(Boolean).slice(0, 5)
      : [];
    console.error("Mercado Pago sponsor refund rejected", { status: response.status, causeCodes });
    throw new Error(`O Mercado Pago não confirmou a devolução (HTTP ${response.status}).${causeCodes.length ? ` Código: ${causeCodes.join(", ")}.` : ""}`);
  }
  if (refund.status && refund.status !== "approved") throw new Error("O Mercado Pago recebeu a solicitação, mas ainda não confirmou a devolução. Atualize o status mais tarde.");
  if (refund.amount != null && Math.round(Number(refund.amount) * 100) !== priceCents) throw new Error("O Mercado Pago retornou um valor de devolução diferente do esperado.");
  return { id: String(refund.id || ""), paymentId: String(paymentId), amount: Number(refund.amount ?? priceCents / 100), status: refund.status || "approved" };
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
