const assert = require("node:assert/strict");
const test = require("node:test");
const crypto = require("node:crypto");
const { createPaymentsService } = require("./payments-service");
const mercadopago = require("./mercadopago-service");

const intent = {
  id: "intent-1",
  user_id: 7,
  package_id: "pack_starter",
  amount_usd: 3,
  external_reference: "easyno-reference-1"
};

function payment(overrides = {}) {
  return {
    id: 123,
    external_reference: intent.external_reference,
    transaction_amount: 3,
    currency_id: "USD",
    live_mode: true,
    metadata: { payment_intent_id: intent.id, user_id: 7, package_id: intent.package_id },
    ...overrides
  };
}

test("Mercado Pago rechaza un payment_id ajeno al intento", () => {
  const service = createPaymentsService({});
  assert.throws(
    () => service.validateProviderPayment(intent, payment({ external_reference: "otra-compra" })),
    /no corresponde/
  );
});

test("Mercado Pago rechaza importe, moneda y propietario manipulados", () => {
  const service = createPaymentsService({});
  assert.throws(() => service.validateProviderPayment(intent, payment({ transaction_amount: 0.01 })), /importe/);
  assert.throws(() => service.validateProviderPayment(intent, payment({ currency_id: "MXN" })), /moneda/);
  assert.throws(() => service.validateProviderPayment(intent, payment({ metadata: { user_id: 99 } })), /propietario/);
});

test("la firma HMAC del webhook valida manifest y rechaza replay viejo", () => {
  const previousSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  process.env.MERCADOPAGO_WEBHOOK_SECRET = "webhook-test-secret";
  const dataId = "ABC123";
  const requestId = "request-1";
  const ts = String(Date.now());
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const hash = crypto.createHmac("sha256", process.env.MERCADOPAGO_WEBHOOK_SECRET).update(manifest).digest("hex");
  assert.equal(mercadopago.validateWebhookSignature({
    xSignature: `ts=${ts},v1=${hash}`, xRequestId: requestId, dataId
  }).valid, true);
  assert.equal(mercadopago.validateWebhookSignature({
    xSignature: `ts=${Date.now() - 11 * 60 * 1000},v1=${hash}`, xRequestId: requestId, dataId
  }).valid, false);
  if (previousSecret === undefined) delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
  else process.env.MERCADOPAGO_WEBHOOK_SECRET = previousSecret;
});
