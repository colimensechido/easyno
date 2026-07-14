const crypto = require("crypto");

const MERCADOPAGO_API_BASE = (process.env.MERCADOPAGO_API_BASE_URL || "https://api.mercadopago.com").replace(/\/+$/, "");

function getAccessToken() {
  const token = String(process.env.MERCADOPAGO_ACCESS_TOKEN || "").trim();
  return token || null;
}

function isConfigured() {
  return getAccessToken() !== null;
}

function cleanUrl(value) {
  const cleaned = String(value || "").trim().replace(/\/+$/, "");
  return cleaned || null;
}

function isPublicHttpsUrl(url) {
  if (!url) return false;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  const hostname = parsed.hostname.toLowerCase();
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") return false;
  return true;
}

function buildCheckoutUrls() {
  const publicSiteUrl = cleanUrl(process.env.MERCADOPAGO_PUBLIC_SITE_URL);
  const publicApiUrl = cleanUrl(process.env.MERCADOPAGO_PUBLIC_API_URL);

  return {
    success: cleanUrl(process.env.MERCADOPAGO_SUCCESS_URL) || (publicSiteUrl ? `${publicSiteUrl}/payment-return.html?status=success` : null),
    pending: cleanUrl(process.env.MERCADOPAGO_PENDING_URL) || (publicSiteUrl ? `${publicSiteUrl}/payment-return.html?status=pending` : null),
    failure: cleanUrl(process.env.MERCADOPAGO_FAILURE_URL) || (publicSiteUrl ? `${publicSiteUrl}/payment-return.html?status=failure` : null),
    notification: cleanUrl(process.env.MERCADOPAGO_WEBHOOK_URL) || (publicApiUrl ? `${publicApiUrl}/api/payments/webhook` : null)
  };
}

async function jsonRequest(method, url, payload) {
  const accessToken = getAccessToken();
  if (!accessToken) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN no configurado");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  let response;
  try {
    response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: payload !== undefined ? JSON.stringify(payload) : undefined,
    signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`Mercado Pago HTTP ${response.status}: ${text}`);
  }

  return data;
}

function validateWebhookSignature({ xSignature, xRequestId, dataId }) {
  const secret = String(process.env.MERCADOPAGO_WEBHOOK_SECRET || "").trim();
  if (!secret) {
    return { valid: process.env.NODE_ENV !== "production", configured: false };
  }

  const signature = String(xSignature || "");
  const requestId = String(xRequestId || "").trim();
  const normalizedDataId = String(dataId || "").trim().toLowerCase();
  const parts = Object.fromEntries(signature.split(",").map((part) => {
    const separator = part.indexOf("=");
    return separator > 0
      ? [part.slice(0, separator).trim(), part.slice(separator + 1).trim()]
      : ["", ""];
  }));
  if (!parts.ts || !parts.v1 || !requestId || !normalizedDataId) {
    return { valid: false, configured: true };
  }

  const timestamp = Number(parts.ts);
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > 10 * 60 * 1000) {
    return { valid: false, configured: true };
  }

  const manifest = `id:${normalizedDataId};request-id:${requestId};ts:${parts.ts};`;
  const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  const received = String(parts.v1).toLowerCase();
  if (received.length !== expected.length) return { valid: false, configured: true };
  return {
    valid: crypto.timingSafeEqual(Buffer.from(received, "utf8"), Buffer.from(expected, "utf8")),
    configured: true
  };
}

function createCheckoutPreference(payload) {
  return jsonRequest("POST", `${MERCADOPAGO_API_BASE}/checkout/preferences`, payload);
}

function getPayment(paymentId) {
  return jsonRequest("GET", `${MERCADOPAGO_API_BASE}/v1/payments/${paymentId}`);
}

async function findLatestPaymentByExternalReference(externalReference) {
  const url = `${MERCADOPAGO_API_BASE}/v1/payments/search?external_reference=${encodeURIComponent(externalReference)}&sort=date_created&criteria=desc&limit=1`;
  const data = await jsonRequest("GET", url);
  const results = Array.isArray(data.results) ? data.results : [];
  return results[0] || null;
}

module.exports = {
  isConfigured,
  buildCheckoutUrls,
  isPublicHttpsUrl,
  createCheckoutPreference,
  getPayment,
  findLatestPaymentByExternalReference,
  validateWebhookSignature
};
