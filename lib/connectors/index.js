/**
 * lib/connectors/index.js
 * Future Integration Connector Architecture
 *
 * This file defines the integration interface that can plug into:
 * - MultiTechno ERP
 * - Lead generation platforms (Zameen, OLX, etc.)
 * - Social media (Meta Ads, LinkedIn)
 * - TeleCRM / Ufone vPBX webhook push
 * - Custom REST APIs
 * - Webhook-based inbound services
 *
 * Each connector implements: { pull(), push(record), transform(raw) }
 */

// ─── Base Connector Interface ─────────────────────────────────────────────────
class BaseConnector {
  constructor(name, config = {}) {
    this.name = name;
    this.config = config;
    this.enabled = config.enabled ?? false;
  }

  async pull() {
    throw new Error(`${this.name}.pull() not implemented`);
  }

  async push(record) {
    throw new Error(`${this.name}.push() not implemented`);
  }

  transform(raw) {
    return raw; // Identity transform — override in subclass
  }

  log(msg) {
    console.log(`[${this.name}] ${msg}`);
  }
}

// ─── MultiTechno ERP Connector ────────────────────────────────────────────────
export class MultiTechnoConnector extends BaseConnector {
  constructor() {
    super("MultiTechnoERP", {
      enabled: false,
      baseUrl: process.env.MULTITECHNO_API_URL,
      apiKey: process.env.MULTITECHNO_API_KEY,
    });
  }

  async pull() {
    if (!this.enabled) return [];
    this.log("Pulling leads from MultiTechno ERP...");
    // TODO: GET ${this.config.baseUrl}/api/leads
    // Authorization: Bearer ${this.config.apiKey}
    return [];
  }

  async push(record) {
    if (!this.enabled) return null;
    this.log(`Pushing record ${record.id} to MultiTechno ERP...`);
    // TODO: POST ${this.config.baseUrl}/api/leads
    return null;
  }

  transform(raw) {
    // Map ERP field names → CRM canonical fields
    return {
      name: raw.customer_name || raw.name,
      email: raw.customer_email || raw.email,
      phone: raw.customer_phone || raw.phone,
      company: raw.company_name || raw.company,
      status: raw.lead_status || "New Lead",
      source: "MultiTechno ERP",
    };
  }
}

// ─── TeleCRM Connector ────────────────────────────────────────────────────────
export class TeleCRMConnector extends BaseConnector {
  constructor() {
    super("TeleCRM", {
      enabled: false,
      baseUrl: process.env.TELECRM_API_URL,
      apiKey: process.env.TELECRM_API_KEY,
    });
  }

  async pull() {
    if (!this.enabled) return [];
    this.log("Pulling leads from TeleCRM...");
    return [];
  }

  transform(raw) {
    return {
      name: raw.contact_name,
      phone: raw.mobile_number,
      status: "Contacted",
      source: "TeleCRM",
      notes: raw.call_notes,
      assigned_to: raw.agent_name,
    };
  }
}

// ─── Meta / Facebook Ads Connector ───────────────────────────────────────────
export class MetaAdsConnector extends BaseConnector {
  constructor() {
    super("MetaAds", {
      enabled: false,
      accessToken: process.env.META_ACCESS_TOKEN,
      adAccountId: process.env.META_AD_ACCOUNT_ID,
    });
  }

  async pull() {
    if (!this.enabled) return [];
    this.log("Pulling leads from Meta Lead Ads...");
    // TODO: https://graph.facebook.com/v19.0/{form_id}/leads
    return [];
  }

  transform(raw) {
    const fieldData = raw.field_data || [];
    const get = (key) =>
      fieldData.find((f) => f.name === key)?.values?.[0] || "";
    return {
      name: get("full_name"),
      email: get("email"),
      phone: get("phone_number"),
      source: "Facebook Ads",
      status: "New Lead",
      created_at: raw.created_time,
    };
  }
}

// ─── Webhook Inbound Handler ──────────────────────────────────────────────────
export class WebhookConnector extends BaseConnector {
  constructor() {
    super("Webhook", { enabled: true });
  }

  /**
   * Process inbound webhook payload.
   * Called from /api/integrations/webhook POST route.
   */
  async processInbound(payload, source = "webhook") {
    this.log(`Inbound webhook from ${source}`);
    return {
      ...this.transform(payload),
      source,
      status: "New Lead",
      created_at: new Date().toISOString(),
    };
  }

  transform(raw) {
    return {
      name: raw.name || raw.full_name || raw.contact_name || "",
      email: raw.email || "",
      phone: raw.phone || raw.mobile || "",
      company: raw.company || "",
      notes: raw.message || raw.notes || "",
    };
  }
}

// ─── Connector Registry ───────────────────────────────────────────────────────
export const connectors = {
  multitechno: new MultiTechnoConnector(),
  telecrm: new TeleCRMConnector(),
  metaAds: new MetaAdsConnector(),
  webhook: new WebhookConnector(),
};

/**
 * Pull from all enabled connectors and return combined leads.
 * Each lead is tagged with its source connector.
 */
export async function pullAllConnectors() {
  const results = [];
  for (const [key, connector] of Object.entries(connectors)) {
    try {
      if (!connector.enabled) continue;
      const raw = await connector.pull();
      const transformed = raw.map((r) => ({
        ...connector.transform(r),
        _connectorSource: key,
      }));
      results.push(...transformed);
    } catch (err) {
      console.error(`[connectors] Error pulling from ${key}:`, err.message);
    }
  }
  return results;
}
