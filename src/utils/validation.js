/**
 * VALIDATION LAYER
 * ════════════════
 * Input validation for all entry points.
 * Uses Joi for schema validation + custom business rules.
 */

const Joi = require('joi');
const PRICING_DEFAULTS = require('../config/pricing.config');

// ── Webhook Payload Validation ─────────────────────────
const webhookSchema = Joi.object({
  type: Joi.string().required(),
  data: Joi.object().required(),
}).unknown(true); // Allow extra Interakt fields

// ── Direct API Quotation Request ───────────────────────
const quotationRequestSchema = Joi.object({
  printType: Joi.string()
    .valid('bw', 'color')
    .required()
    .messages({
      'any.only': 'Print type must be "bw" or "color"',
      'any.required': 'Print type is required',
    }),
  pages: Joi.number()
    .integer()
    .min(PRICING_DEFAULTS.limits.minPages)
    .max(PRICING_DEFAULTS.limits.maxPages)
    .required()
    .messages({
      'number.base': 'Pages must be a number',
      'number.integer': 'Pages must be a whole number',
      'number.min': `Minimum ${PRICING_DEFAULTS.limits.minPages} page required`,
      'number.max': `Maximum ${PRICING_DEFAULTS.limits.maxPages} pages allowed`,
      'any.required': 'Number of pages is required',
    }),
  quantity: Joi.number()
    .integer()
    .min(PRICING_DEFAULTS.limits.minQuantity)
    .max(PRICING_DEFAULTS.limits.maxQuantity)
    .default(1)
    .messages({
      'number.min': `Minimum quantity is ${PRICING_DEFAULTS.limits.minQuantity}`,
      'number.max': `Maximum quantity is ${PRICING_DEFAULTS.limits.maxQuantity}`,
    }),
});

/**
 * Parse user's WhatsApp text into a print type
 * Handles: "1", "bw", "b&w", "black", "black and white", etc.
 */
function parsePrintType(text) {
  if (!text || typeof text !== 'string') return null;

  const normalized = text.trim().toLowerCase();
  const bwPatterns = ['1', 'bw', 'b&w', 'b/w', 'black', 'black and white', 'black & white', 'bnw'];
  const colorPatterns = ['2', 'color', 'colour', 'clr', 'colored', 'coloured'];

  if (bwPatterns.includes(normalized)) return 'bw';
  if (colorPatterns.includes(normalized)) return 'color';
  return null;
}

/**
 * Parse user's WhatsApp text into a page count
 * Handles: "150", "150 pages", "around 200", extracts numbers
 */
function parsePageCount(text) {
  if (!text || typeof text !== 'string') return null;

  const normalized = text.trim();

  // Extract first number from the text
  const match = normalized.match(/(\d+)/);
  if (!match) return null;

  const pages = parseInt(match[1], 10);

  // Validate range
  if (pages < PRICING_DEFAULTS.limits.minPages || pages > PRICING_DEFAULTS.limits.maxPages) {
    return null;
  }

  return pages;
}

/**
 * Validate a direct API quotation request
 */
function validateQuotationRequest(data) {
  const { error, value } = quotationRequestSchema.validate(data, { abortEarly: false });

  if (error) {
    return {
      valid: false,
      errors: error.details.map((d) => d.message),
    };
  }

  return { valid: true, data: value };
}

module.exports = {
  webhookSchema,
  quotationRequestSchema,
  parsePrintType,
  parsePageCount,
  validateQuotationRequest,
};
