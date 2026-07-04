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
    success: cleanUrl(process.env.MERCADOPAGO_SUCCESS_URL) || (publicSiteUrl ? `${publicSiteUrl}/?payment=success` : null),
    pending: cleanUrl(process.env.MERCADOPAGO_PENDING_URL) || (publicSiteUrl ? `${publicSiteUrl}/?payment=pending` : null),
    failure: cleanUrl(process.env.MERCADOPAGO_FAILURE_URL) || (publicSiteUrl ? `${publicSiteUrl}/?payment=failure` : null),
    notification: cleanUrl(process.env.MERCADOPAGO_WEBHOOK_URL) || (publicApiUrl ? `${publicApiUrl}/api/payments/webhook` : null)
  };
}

async function jsonRequest(method, url, payload) {
  const accessToken = getAccessToken();
  if (!accessToken) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN no configurado");
  }

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: payload !== undefined ? JSON.stringify(payload) : undefined
  });

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
  findLatestPaymentByExternalReference
};
