const crypto = require("crypto");

// Catálogo EyCon completo ≈ 16,000 units (160 EyCon). Escalera pensada para que
// cada tier mejore el valor por dólar y el VIP compense el salto con 100% + rol.
const PACKAGES = [
  {
    id: "pack_starter",
    name: "Paquete Iniciado",
    description: "¡Buen kit para empezar!",
    priceUsd: 3,
    amountUnits: 4500,
    vip: false
  },
  {
    id: "pack_advanced",
    name: "Paquete Avanzado",
    description: "¡Te alcanza para casi todo!",
    priceUsd: 5,
    amountUnits: 9500,
    vip: false
  },
  {
    id: "pack_vip",
    name: "Paquete VIP Total",
    description: "¡Te alcanza para todo! ¡Eres rico! Incluye rol VIP permanente (nombre dorado).",
    priceUsd: 8,
    amountUnits: 16000,
    vip: true
  }
];

const PACKAGES_BY_ID = new Map(PACKAGES.map((pkg) => [pkg.id, pkg]));

function clientError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function paymentStatusFromProvider(providerStatus) {
  const status = String(providerStatus || "").toLowerCase();
  if (status === "approved") return "approved";
  if (["pending", "in_process", "in_mediation"].includes(status)) return "pending";
  if (["rejected", "cancelled", "canceled"].includes(status)) return "rejected";
  if (status === "refunded" || status === "charged_back") return "refunded";
  return "processing_error";
}

function createPaymentsService({ get, run, all, creditReward, grantRole, mercadopago }) {
  let queue = Promise.resolve();

  function serialize(work) {
    const next = queue.then(work, work);
    queue = next.catch(() => undefined);
    return next;
  }

  async function initSchema() {
    await run(`
      CREATE TABLE IF NOT EXISTS payment_intents (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        package_id TEXT NOT NULL,
        amount_usd REAL NOT NULL,
        amount_units INTEGER NOT NULL,
        grants_vip INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'created',
        external_reference TEXT UNIQUE,
        provider_preference_id TEXT,
        provider_payment_id TEXT,
        init_point TEXT,
        sandbox_init_point TEXT,
        raw_provider_response TEXT,
        granted_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    await run(`CREATE INDEX IF NOT EXISTS idx_payment_intents_user ON payment_intents(user_id)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_payment_intents_payment_id ON payment_intents(provider_payment_id)`);

    await run(`
      CREATE TABLE IF NOT EXISTS payment_webhook_events (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        provider_event_id TEXT,
        event_type TEXT,
        payload TEXT,
        processing_status TEXT NOT NULL DEFAULT 'received',
        error_message TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        processed_at TEXT
      )
    `);
    await run(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_unique ON payment_webhook_events(provider, provider_event_id)`
    );
  }

  function listPackages() {
    return PACKAGES.map((pkg) => ({ ...pkg }));
  }

  function serializeIntent(row) {
    if (!row) return null;
    return {
      id: row.id,
      packageId: row.package_id,
      amountUsd: row.amount_usd,
      amountUnits: row.amount_units,
      grantsVip: Boolean(row.grants_vip),
      status: row.status,
      externalReference: row.external_reference,
      initPoint: row.init_point,
      sandboxInitPoint: row.sandbox_init_point,
      createdAt: row.created_at
    };
  }

  async function grantPackageIfApproved(intentRow) {
    if (intentRow.granted_at) return;
    const pkg = PACKAGES_BY_ID.get(intentRow.package_id);
    if (!pkg) return;

    await creditReward({
      userId: intentRow.user_id,
      amountUnits: intentRow.amount_units,
      movementType: "PAYMENT_TOPUP",
      referenceId: intentRow.id,
      description: `Compra ${pkg.name} (Mercado Pago)`,
      idempotencyKey: `payment:${intentRow.id}`
    });

    if (pkg.vip && typeof grantRole === "function") {
      await grantRole(intentRow.user_id, "vip", { source: `payment:${intentRow.id}` }).catch((error) => {
        console.error("No se pudo otorgar rol VIP tras el pago", error);
      });
    }

    await run(`UPDATE payment_intents SET granted_at = CURRENT_TIMESTAMP WHERE id = ?`, [intentRow.id]);
  }

  async function applyProviderStatus(intentRow, providerStatus, rawResponse) {
    const status = paymentStatusFromProvider(providerStatus);
    await run(
      `UPDATE payment_intents
       SET status = ?, raw_provider_response = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status, JSON.stringify(rawResponse || {}), intentRow.id]
    );
    const updated = { ...intentRow, status };
    if (status === "approved") {
      await grantPackageIfApproved(updated);
    }
    return get(`SELECT * FROM payment_intents WHERE id = ?`, [intentRow.id]);
  }

  async function createCheckout({ userId, packageId }) {
    const pkg = PACKAGES_BY_ID.get(packageId);
    if (!pkg) {
      throw clientError("Paquete no encontrado", 404);
    }

    return serialize(async () => {
      const id = crypto.randomUUID();
      const externalReference = `easyno-eycon-${userId}-${pkg.id}-${crypto.randomUUID().slice(0, 8)}`;

      await run(
        `INSERT INTO payment_intents (
          id, user_id, package_id, amount_usd, amount_units, grants_vip,
          status, external_reference
        ) VALUES (?, ?, ?, ?, ?, ?, 'created', ?)`,
        [id, userId, pkg.id, pkg.priceUsd, pkg.amountUnits, pkg.vip ? 1 : 0, externalReference]
      );

      if (!mercadopago.isConfigured()) {
        return {
          checkoutAvailable: false,
          configurationMissing: true,
          paymentIntent: serializeIntent(await get(`SELECT * FROM payment_intents WHERE id = ?`, [id]))
        };
      }

      const urls = mercadopago.buildCheckoutUrls();
      const hasPublicBackUrls = ["success", "pending", "failure"].every((key) =>
        mercadopago.isPublicHttpsUrl(urls[key])
      );
      const hasPublicNotification = mercadopago.isPublicHttpsUrl(urls.notification);

      const preferencePayload = {
        items: [
          {
            title: `EyCon - ${pkg.name}`,
            quantity: 1,
            unit_price: pkg.priceUsd,
            currency_id: "USD"
          }
        ],
        external_reference: externalReference,
        metadata: { user_id: userId, package_id: pkg.id, payment_intent_id: id }
      };

      if (hasPublicNotification) {
        preferencePayload.notification_url = urls.notification;
      }
      if (hasPublicBackUrls) {
        preferencePayload.back_urls = {
          success: urls.success,
          pending: urls.pending,
          failure: urls.failure
        };
        preferencePayload.auto_return = "approved";
      }

      try {
        const preference = await mercadopago.createCheckoutPreference(preferencePayload);
        await run(
          `UPDATE payment_intents
           SET provider_preference_id = ?, init_point = ?, sandbox_init_point = ?,
               status = 'waiting_payment', updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [preference.id || null, preference.init_point || null, preference.sandbox_init_point || null, id]
        );
        return {
          checkoutAvailable: true,
          configurationMissing: false,
          integrationWarnings: hasPublicNotification
            ? []
            : ["Mercado Pago no recibira webhooks automaticos hasta configurar una URL publica; el estado se sincroniza al volver del checkout."],
          paymentIntent: serializeIntent(await get(`SELECT * FROM payment_intents WHERE id = ?`, [id]))
        };
      } catch (error) {
        await run(
          `UPDATE payment_intents
           SET status = 'processing_error', raw_provider_response = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [JSON.stringify({ error: String(error.message || error) }), id]
        );
        throw clientError(`No se pudo crear la preferencia de pago: ${error.message || error}`, 502);
      }
    });
  }

  async function findByExternalReference(externalReference) {
    return get(`SELECT * FROM payment_intents WHERE external_reference = ?`, [externalReference]);
  }

  async function findByProviderPaymentId(paymentId) {
    return get(`SELECT * FROM payment_intents WHERE provider_payment_id = ?`, [String(paymentId)]);
  }

  async function findById(id, userId = null) {
    if (userId) {
      return get(`SELECT * FROM payment_intents WHERE id = ? AND user_id = ?`, [id, userId]);
    }
    return get(`SELECT * FROM payment_intents WHERE id = ?`, [id]);
  }

  async function returnSync({ userId, paymentIntentId, paymentId, externalReference }) {
    return serialize(async () => {
      let intentRow = null;
      if (paymentIntentId) {
        intentRow = await findById(paymentIntentId, userId);
      }
      if (!intentRow && externalReference) {
        const candidate = await findByExternalReference(externalReference);
        if (candidate && candidate.user_id === userId) intentRow = candidate;
      }
      if (!intentRow && paymentId) {
        const candidate = await findByProviderPaymentId(paymentId);
        if (candidate && candidate.user_id === userId) intentRow = candidate;
      }
      if (!intentRow) {
        throw clientError("Intento de pago no encontrado", 404);
      }

      if (!mercadopago.isConfigured()) {
        return serializeIntent(intentRow);
      }

      let paymentData = null;
      let resolvedPaymentId = paymentId ? String(paymentId) : null;

      if (resolvedPaymentId) {
        paymentData = await mercadopago.getPayment(resolvedPaymentId).catch((error) => {
          throw clientError(`No se pudo consultar el pago: ${error.message || error}`, 502);
        });
      } else if (intentRow.status !== "approved") {
        const found = await mercadopago.findLatestPaymentByExternalReference(intentRow.external_reference).catch(() => null);
        if (found) {
          paymentData = found;
          resolvedPaymentId = String(found.id);
        }
      }

      if (paymentData && resolvedPaymentId) {
        await run(`UPDATE payment_intents SET provider_payment_id = ? WHERE id = ?`, [resolvedPaymentId, intentRow.id]);
        intentRow = await applyProviderStatus({ ...intentRow, provider_payment_id: resolvedPaymentId }, paymentData.status, paymentData);
      }

      return serializeIntent(intentRow);
    });
  }

  async function handleWebhook({ query = {}, payload = {} }) {
    const providerEventId = query.id || payload.id || payload?.data?.id || null;
    const eventType = query.type || query.topic || payload.type || null;

    return serialize(async () => {
      let event = null;
      if (providerEventId) {
        event = await get(
          `SELECT * FROM payment_webhook_events WHERE provider = 'mercadopago' AND provider_event_id = ?`,
          [String(providerEventId)]
        );
      }

      if (event && event.processing_status === "processed") {
        return { duplicate: true };
      }

      const eventId = event?.id || crypto.randomUUID();
      if (!event) {
        await run(
          `INSERT INTO payment_webhook_events (id, provider, provider_event_id, event_type, payload, processing_status)
           VALUES (?, 'mercadopago', ?, ?, ?, 'received')`,
          [eventId, providerEventId ? String(providerEventId) : null, eventType, JSON.stringify(payload || query || {})]
        );
      }

      const paymentLookupId =
        payload?.data?.id || query["data.id"] || (eventType === "payment" ? providerEventId : null);

      if (!paymentLookupId || !mercadopago.isConfigured()) {
        await run(`UPDATE payment_webhook_events SET processing_status = 'received_unverified' WHERE id = ?`, [eventId]);
        return { processed: false };
      }

      try {
        const paymentData = await mercadopago.getPayment(String(paymentLookupId));
        let intentRow = null;
        if (paymentData.external_reference) {
          intentRow = await findByExternalReference(paymentData.external_reference);
        }
        if (!intentRow) {
          intentRow = await findByProviderPaymentId(paymentLookupId);
        }

        if (intentRow) {
          await run(`UPDATE payment_intents SET provider_payment_id = ? WHERE id = ?`, [String(paymentLookupId), intentRow.id]);
          await applyProviderStatus({ ...intentRow, provider_payment_id: String(paymentLookupId) }, paymentData.status, paymentData);
        }

        await run(
          `UPDATE payment_webhook_events SET processing_status = 'processed', processed_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [eventId]
        );
        return { processed: true };
      } catch (error) {
        await run(
          `UPDATE payment_webhook_events SET processing_status = 'processing_error', error_message = ? WHERE id = ?`,
          [String(error.message || error), eventId]
        );
        return { processed: false, error: String(error.message || error) };
      }
    });
  }

  async function listUserHistory(userId) {
    const rows = await all(`SELECT * FROM payment_intents WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`, [userId]);
    return rows.map(serializeIntent);
  }

  return {
    initSchema,
    listPackages,
    createCheckout,
    returnSync,
    handleWebhook,
    listUserHistory,
    serializeIntent
  };
}

module.exports = { createPaymentsService, PACKAGES };
