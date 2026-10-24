import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  createPreference,
  classifyMercadoPagoNotification,
  isApprovedPayment,
  paymentReference,
  refundApprovedPayment,
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

test("accepts a one-cent price for the temporary payment test", async () => {
  let unitPrice;
  await createPreference({
    accessToken: "TEST-server-token",
    externalReference: paymentReference("order", "HM-26-ABCDEF123456"),
    title: "Teste de pagamento HOCCO",
    priceCents: 1,
    origin: "https://hocco-message.vercel.app",
    returnPath: "/cliente/",
    notificationUrl: "https://vebqvedmhfaebvdantiu.supabase.co/functions/v1/hocco-message?type=payment",
    environment: "test",
    fetcher: async (_url, options) => {
      unitPrice = JSON.parse(options.body).items[0].unit_price;
      return new Response(JSON.stringify({
        id: 789,
        sandbox_init_point: "https://www.mercadopago.com.br/checkout/test",
      }), { status: 201 });
    },
  });
  assert.equal(unitPrice, 0.01);
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
    fetcher: async () => new Response(JSON.stringify({ id: 1, init_point: "https://attacker.invalid/pay" }), { status: 201 }),
  }), /domínio de checkout inesperado/);
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

test("ignores unsigned legacy IPN/feed notifications without applying payment state", () => {
  assert.equal(classifyMercadoPagoNotification({
    topic: "payment", type: "payment", dataId: "", signature: "", requestId: "",
  }), "ignore");
  assert.equal(classifyMercadoPagoNotification({
    topic: "merchant_order", type: "payment", dataId: "45514298310", signature: "", requestId: "",
  }), "ignore");
});

test("accepts payment notifications only when a payment ID and Webhook headers are present", () => {
  assert.equal(classifyMercadoPagoNotification({
    topic: "", type: "payment", dataId: "184617272025", signature: "ts=1,v1=abc", requestId: "req-1",
  }), "payment");
  assert.equal(classifyMercadoPagoNotification({
    topic: "payment", type: "payment", dataId: "184617272025", signature: "", requestId: "",
  }), "ignore");
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

test("refunds only the matching approved sponsor payment using a stable idempotency key", async () => {
  const requests = [];
  const result = await refundApprovedPayment({
    accessToken: "APP_USR-test-token",
    paymentId: "998877",
    externalReference: "hocco:sponsor:HM-26-ABCDEF123456",
    priceCents: 2990,
    fetcher: async (url, options) => {
      requests.push({ url, options });
      if (requests.length === 1) return new Response(JSON.stringify({
        id: 998877,
        status: "approved",
        currency_id: "BRL",
        external_reference: "hocco:sponsor:HM-26-ABCDEF123456",
        transaction_amount: 29.9,
      }), { status: 200 });
      return new Response(JSON.stringify({ id: "refund-1", payment_id: 998877, amount: 29.9, status: "approved" }), { status: 201 });
    },
  });
  assert.equal(result.status, "approved");
  assert.equal(result.amount, 29.9);
  assert.match(requests[1].url, /\/v1\/payments\/998877\/refunds$/);
  assert.match(requests[1].options.headers["X-Idempotency-Key"], /^[a-f0-9-]{36}$/);
  assert.equal(requests[1].options.body, "{}");
});

test("does not request a refund if Mercado Pago payment does not match sponsor and price", async () => {
  let refundCalled = false;
  await assert.rejects(() => refundApprovedPayment({
    accessToken: "APP_USR-test-token",
    paymentId: "998877",
    externalReference: "hocco:sponsor:HM-26-ABCDEF123456",
    priceCents: 2990,
    fetcher: async (url) => {
      if (url.endsWith("/refunds")) refundCalled = true;
      return new Response(JSON.stringify({
        status: "approved",
        external_reference: "hocco:sponsor:HM-26-OTHER123456",
        transaction_amount: 10,
      }), { status: 200 });
    },
  }), /não corresponde ao patrocínio/);
  assert.equal(refundCalled, false);
});

test("supports exact references for each Hocco purchase type", async () => {
  for (const kind of ["order", "community", "sponsor"]) {
    let refundCalled = false;
    const reference = paymentReference(kind, "HM-26-ABCDEF123456");
    await refundApprovedPayment({
      accessToken: "APP_USR-test-token",
      paymentId: "998877",
      externalReference: reference,
      priceCents: 350,
      fetcher: async (url, options) => {
        if (url.endsWith("/refunds")) refundCalled = true;
        return new Response(JSON.stringify(url.endsWith("/refunds")
          ? { id: "refund-1", amount: 3.5, status: "approved" }
          : { status: "approved", currency_id: "BRL", external_reference: reference, transaction_amount: 3.5 }), { status: url.endsWith("/refunds") ? 201 : 200 });
      },
    });
    assert.equal(refundCalled, true, kind);
  }
});
