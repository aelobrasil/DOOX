import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  createPreference,
  isApprovedPayment,
  paymentReference,
  verifyWebhookSignature,
} from "../supabase/functions/hocco-message/mercado-pago.mjs";

test("creates a Pix-capable Checkout Pro preference using the server token and exact amount", async () => {
  let request;
  const result = await createPreference({
    accessToken: "TEST-server-token",
    externalReference: paymentReference("order", "HM-26-ABCDEF123456"),
    title: "Mensagem no vídeo oficial HOCCO",
    priceCents: 500,
    origin: "https://hocco-message.vercel.app",
    returnPath: "/cliente/#acompanhar/HM-26-ABCDEF123456/token",
    notificationUrl: "https://vebqvedmhfaebvdantiu.supabase.co/functions/v1/hocco-message?type=payment",
    fetcher: async (url, options) => {
      request = { url, options };
      return new Response(JSON.stringify({
        id: 456,
        init_point: "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=live",
        sandbox_init_point: "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=test",
      }), { status: 201 });
    },
  });
  assert.equal(result.checkoutUrl, "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=test");
  assert.equal(request.options.headers.Authorization, "Bearer TEST-server-token");
  assert.match(request.options.headers["X-Idempotency-Key"], /^[a-f0-9-]{36}$/);
  const payload = JSON.parse(request.options.body);
  assert.equal(payload.items[0].unit_price, 5);
  assert.equal(payload.items[0].currency_id, "BRL");
  assert.equal(payload.external_reference, "hocco:order:HM-26-ABCDEF123456");
  assert.match(payload.back_urls.success, /#acompanhar\/HM-26-ABCDEF123456/);
});

test("rejects invalid price and unexpected checkout domains", async () => {
  await assert.rejects(() => createPreference({
    accessToken: "TEST-token",
    externalReference: "hocco:community:HC-CM-ABCDEF123456",
    title: "Mensagem Comunidade",
    priceCents: 0,
    origin: "https://hocco-message.vercel.app",
    returnPath: "/",
    notificationUrl: "https://example.com/hook",
  }), /Valor de pagamento inválido/);
  await assert.rejects(() => createPreference({
    accessToken: "APP_USR-token",
    externalReference: "hocco:community:HC-CM-ABCDEF123456",
    title: "Mensagem Comunidade",
    priceCents: 350,
    origin: "https://hocco-message.vercel.app",
    returnPath: "/",
    notificationUrl: "https://example.com/hook",
    fetcher: async () => new Response(JSON.stringify({ id: 1, sandbox_init_point: "https://attacker.invalid/pay",
    init_point: "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=not-used" }), { status: 201 }),
  }), /domínio de checkout inesperado/);
});

test("verifies Mercado Pago HMAC signatures and rejects tampering", async () => {
  const dataId = "123456";
  const requestId = "request-abc";
  const timestamp = "1700000000";
  const secret = "webhook-secret-for-test";
  const manifest = `id:${dataId};request-id:${requestId};ts:${timestamp};`;
  const v1 = createHmac("sha256", secret).update(manifest).digest("hex");
  const signature = `ts=${timestamp},v1=${v1}`;
  assert.equal(await verifyWebhookSignature({ dataId, requestId, signature, secret }), true);
  assert.equal(await verifyWebhookSignature({ dataId, requestId, signature: `ts=${timestamp},v1=${"0".repeat(64)}`, secret }), false);
});

test("accepts only the approved BRL payment for the exact reference and amount", () => {
  const payment = {
    status: "approved",
    currency_id: "BRL",
    external_reference: "hocco:community:HC-CM-ABCDEF123456",
    transaction_amount: 3.5,
  };
  assert.equal(isApprovedPayment(payment, payment.external_reference, 350), true);
  assert.equal(isApprovedPayment({ ...payment, transaction_amount: 4 }, payment.external_reference, 350), false);
  assert.equal(isApprovedPayment({ ...payment, status: "pending" }, payment.external_reference, 350), false);
});

test("reports Mercado Pago permission errors without exposing credentials", async () => {
  await assert.rejects(() => createPreference({
    accessToken: "TEST-secret-value",
    externalReference: "hocco:order:HM-26-ABCDEF123456",
    title: "Mensagem no vídeo oficial HOCCO",
    priceCents: 500,
    origin: "https://hocco-message.vercel.app",
    returnPath: "/cliente/#acompanhar/HM-26-ABCDEF123456/token",
    notificationUrl: "https://hocco-message.vercel.app/hook",
    fetcher: async () => new Response(JSON.stringify({
      error: "forbidden",
      cause: [{ code: "PA_UNAUTHORIZED_RESULT_FROM_POLICIES" }],
    }), { status: 403 }),
  }), (error) => {
    assert.match(error.message, /HTTP 403/);
    assert.match(error.message, /PA_UNAUTHORIZED_RESULT_FROM_POLICIES/);
    assert.doesNotMatch(error.message, /TEST-secret-value/);
    return true;
  });
});
