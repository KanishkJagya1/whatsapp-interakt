/**
 * PRICING CONFIGURATION
 * ─────────────────────
 * This is the single source of truth for all pricing rules.
 * Admin dashboard can override these via database.
 * Database values take precedence over these defaults.
 */

const PRICING_DEFAULTS = {
  // ── Print Type Rates (per page) ─────────────
  printRates: {
    bw: {
      label: 'Black & White',
      ratePerPage: 0.45,     // ₹0.45
      currency: 'INR',
    },
    color: {
      label: 'Color',
      ratePerPage: 0.95,     // ₹0.95
      currency: 'INR',
    },
  },

  // ── Binding Rules ───────────────────────────
  bindingRules: {
    centerPin: {
      label: 'Center Pin Binding',
      maxPages: 63,          // Applied when pages < 64
      ratePerPage: 0.17,     // ₹0.17 per page (including cover)
      includesCover: true,
    },
    hardBinding: {
      label: 'Hard Binding',
      minPages: 64,          // Applied when pages >= 64
      ratePerPage: 0.22,     // ₹0.22 per page
      includesCover: false,
    },
  },

  // ── Tax Configuration ───────────────────────
  tax: {
    gst: {
      label: 'GST',
      rate: 18,              // 18%
      isInclusive: false,    // Added on top of subtotal
    },
  },

  // ── Validation Limits ───────────────────────
  limits: {
    minPages: 1,
    maxPages: 10000,
    minQuantity: 1,
    maxQuantity: 5000,
  },

  // ── Future: Paper Types ─────────────────────
  paperTypes: {
    standard70gsm: {
      label: '70 GSM Maplitho',
      surchargePerPage: 0,
    },
    art100gsm: {
      label: '100 GSM Art Paper',
      surchargePerPage: 0.50,
    },
    art130gsm: {
      label: '130 GSM Art Paper',
      surchargePerPage: 0.75,
    },
  },

  // ── Future: Discount Tiers ──────────────────
  quantityDiscounts: [
    { minQty: 1,    maxQty: 49,   discountPercent: 0 },
    { minQty: 50,   maxQty: 199,  discountPercent: 5 },
    { minQty: 200,  maxQty: 499,  discountPercent: 10 },
    { minQty: 500,  maxQty: 99999, discountPercent: 15 },
  ],
};

module.exports = PRICING_DEFAULTS;
