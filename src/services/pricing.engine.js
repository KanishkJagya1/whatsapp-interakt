/**
 * PRICING ENGINE
 * ═══════════════
 * Modular pricing calculator with separated concerns:
 *   - Print cost calculation
 *   - Binding cost calculation
 *   - Discount calculation
 *   - Tax calculation
 *   - Total assembly
 *
 * Each module is independently testable and replaceable.
 * Database config overrides file-based defaults.
 */

const PRICING_DEFAULTS = require('../config/pricing.config');
const { PricingConfig } = require('../models');
const logger = require('../utils/logger');

// ─── In-Memory Config Cache ────────────────────────────
// Refreshed every 60 seconds or on admin update
let cachedConfig = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

/**
 * Load pricing config: DB values override file defaults
 */
async function getConfig() {
  const now = Date.now();
  if (cachedConfig && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedConfig;
  }

  try {
    const dbConfigs = await PricingConfig.find({ isActive: true }).lean();
    const merged = { ...PRICING_DEFAULTS };

    // Override defaults with any DB-stored values
    for (const cfg of dbConfigs) {
      const keys = cfg.key.split('.');
      let target = merged;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!target[keys[i]]) target[keys[i]] = {};
        target = target[keys[i]];
      }
      target[keys[keys.length - 1]] = cfg.value;
    }

    cachedConfig = merged;
    cacheTimestamp = now;
    return merged;
  } catch (error) {
    logger.warn('Failed to load DB config, using defaults', { error: error.message });
    return PRICING_DEFAULTS;
  }
}

/** Force cache refresh (called after admin updates pricing) */
function invalidateCache() {
  cachedConfig = null;
  cacheTimestamp = 0;
}

// ═══════════════════════════════════════════════════════
// MODULE 1: Print Cost
// ═══════════════════════════════════════════════════════
function calculatePrintCost(pages, printType, config) {
  const rate = config.printRates[printType];
  if (!rate) {
    throw new Error(`Unknown print type: ${printType}`);
  }
  const costPerPage = rate.ratePerPage;
  const totalCost = round(pages * costPerPage);

  return {
    printType,
    printLabel: rate.label,
    costPerPage,
    totalCost,
  };
}

// ═══════════════════════════════════════════════════════
// MODULE 2: Binding Cost
// ═══════════════════════════════════════════════════════
function calculateBindingCost(pages, config) {
  const { centerPin, hardBinding } = config.bindingRules;

  let bindingType, bindingLabel, costPerPage, totalPages;

  if (pages < (centerPin.maxPages + 1)) {
    // Center pin binding: includes cover page in count
    bindingType = 'centerPin';
    bindingLabel = centerPin.label;
    costPerPage = centerPin.ratePerPage;
    totalPages = centerPin.includesCover ? pages + 1 : pages;
  } else {
    // Hard binding
    bindingType = 'hardBinding';
    bindingLabel = hardBinding.label;
    costPerPage = hardBinding.ratePerPage;
    totalPages = pages;
  }

  const totalCost = round(totalPages * costPerPage);

  return {
    bindingType,
    bindingLabel,
    costPerPage,
    pagesCharged: totalPages,
    totalCost,
  };
}

// ═══════════════════════════════════════════════════════
// MODULE 3: Quantity Discount
// ═══════════════════════════════════════════════════════
function calculateDiscount(subtotal, quantity, config) {
  if (!config.quantityDiscounts || quantity <= 1) {
    return { discountPercent: 0, discountAmount: 0 };
  }

  const tier = config.quantityDiscounts.find(
    (d) => quantity >= d.minQty && quantity <= d.maxQty
  );

  const discountPercent = tier ? tier.discountPercent : 0;
  const discountAmount = round(subtotal * discountPercent / 100);

  return { discountPercent, discountAmount };
}

// ═══════════════════════════════════════════════════════
// MODULE 4: Tax Calculation
// ═══════════════════════════════════════════════════════
function calculateTax(taxableAmount, config) {
  const gstRate = config.tax.gst.rate;
  const gstAmount = round(taxableAmount * gstRate / 100);

  return {
    gstRate,
    gstAmount,
    taxLabel: config.tax.gst.label,
  };
}

// ═══════════════════════════════════════════════════════
// MAIN: Full Quotation Calculator
// ═══════════════════════════════════════════════════════
async function calculateQuotation({ printType, pages, quantity = 1 }) {
  const startTime = Date.now();
  const config = await getConfig();

  // Step 1: Print cost (per copy)
  const print = calculatePrintCost(pages, printType, config);

  // Step 2: Binding cost (per copy)
  const binding = calculateBindingCost(pages, config);

  // Step 3: Per-copy subtotal
  const perCopySubtotal = round(print.totalCost + binding.totalCost);

  // Step 4: Multiply by quantity
  const subtotalBeforeDiscount = round(perCopySubtotal * quantity);

  // Step 5: Quantity discount
  const discount = calculateDiscount(subtotalBeforeDiscount, quantity, config);

  // Step 6: Taxable amount
  const taxableAmount = round(subtotalBeforeDiscount - discount.discountAmount);

  // Step 7: GST
  const tax = calculateTax(taxableAmount, config);

  // Step 8: Grand total
  const totalAmount = round(taxableAmount + tax.gstAmount);

  const processingTimeMs = Date.now() - startTime;

  return {
    // Input echo
    input: { printType, pages, quantity },

    // Per-copy breakdown
    perCopy: {
      printCost: print.totalCost,
      bindingCost: binding.totalCost,
      subtotal: perCopySubtotal,
    },

    // Full breakdown
    breakdown: {
      printLabel: print.printLabel,
      printCostPerPage: print.costPerPage,
      totalPrintCost: print.totalCost,

      bindingType: binding.bindingType,
      bindingLabel: binding.bindingLabel,
      bindingCostPerPage: binding.costPerPage,
      bindingPagesCharged: binding.pagesCharged,
      totalBindingCost: binding.totalCost,

      subtotalBeforeDiscount,

      discountPercent: discount.discountPercent,
      discountAmount: discount.discountAmount,

      taxableAmount,
      gstRate: tax.gstRate,
      gstAmount: tax.gstAmount,

      totalAmount,
    },

    // Summary for WhatsApp message
    summary: {
      perCopy: perCopySubtotal,
      subtotal: subtotalBeforeDiscount,
      discount: discount.discountAmount,
      gst: tax.gstAmount,
      total: totalAmount,
    },

    metadata: {
      processingTimeMs,
      configSource: cachedConfig ? 'cached' : 'fresh',
    },
  };
}

// ─── Utility ────────────────────────────────────────────
function round(value) {
  return Math.round(value * 100) / 100;
}

module.exports = {
  calculateQuotation,
  calculatePrintCost,
  calculateBindingCost,
  calculateDiscount,
  calculateTax,
  getConfig,
  invalidateCache,
};
