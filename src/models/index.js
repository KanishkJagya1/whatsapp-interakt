const mongoose = require('mongoose');

// ═══════════════════════════════════════════════════════
// 1. PRICING CONFIG - Admin-editable pricing rules
// ═══════════════════════════════════════════════════════
const PricingConfigSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    index: true,
    // e.g., 'printRate.bw', 'printRate.color', 'binding.centerPin', 'tax.gst'
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  label: String,
  category: {
    type: String,
    enum: ['printRate', 'binding', 'tax', 'discount', 'delivery', 'paper'],
    required: true,
  },
  isActive: { type: Boolean, default: true },
  updatedBy: String,
}, {
  timestamps: true,
});

// ═══════════════════════════════════════════════════════
// 2. QUOTATION - Every quote generated
// ═══════════════════════════════════════════════════════
const QuotationSchema = new mongoose.Schema({
  quotationId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  // Customer Info (from WhatsApp)
  customer: {
    phone: { type: String, required: true, index: true },
    name: String,
    whatsappId: String,
  },
  // Input Parameters
  input: {
    printType: { type: String, enum: ['bw', 'color'], required: true },
    pages: { type: Number, required: true, min: 1 },
    quantity: { type: Number, default: 1, min: 1 },
    paperType: { type: String, default: 'standard70gsm' },
  },
  // Calculated Breakdown
  breakdown: {
    printCostPerPage: Number,
    totalPrintCost: Number,
    bindingType: String,
    bindingCostPerPage: Number,
    totalBindingCost: Number,
    subtotal: Number,
    discountPercent: Number,
    discountAmount: Number,
    taxableAmount: Number,
    gstRate: Number,
    gstAmount: Number,
    totalAmount: Number,
  },
  // Metadata
  channel: { type: String, default: 'whatsapp', enum: ['whatsapp', 'web', 'api'] },
  status: {
    type: String,
    default: 'quoted',
    enum: ['quoted', 'confirmed', 'paid', 'in_progress', 'completed', 'cancelled'],
  },
  convertedToOrder: { type: Boolean, default: false },
  webhookPayload: mongoose.Schema.Types.Mixed, // Raw webhook data for debugging
  responseTimeMs: Number,
}, {
  timestamps: true,
});

// Index for analytics queries
QuotationSchema.index({ createdAt: -1 });
QuotationSchema.index({ 'customer.phone': 1, createdAt: -1 });
QuotationSchema.index({ status: 1 });

// ═══════════════════════════════════════════════════════
// 3. CUSTOMER / LEAD - Track repeat customers
// ═══════════════════════════════════════════════════════
const CustomerSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true, index: true },
  name: String,
  email: String,
  whatsappOptIn: { type: Boolean, default: true },
  totalQuotations: { type: Number, default: 0 },
  totalOrders: { type: Number, default: 0 },
  totalSpent: { type: Number, default: 0 },
  lastInteraction: Date,
  tags: [String],              // e.g., ['bulk_buyer', 'repeat_customer']
  notes: String,
}, {
  timestamps: true,
});

// ═══════════════════════════════════════════════════════
// 4. WEBHOOK LOG - Debugging & retry tracking
// ═══════════════════════════════════════════════════════
const WebhookLogSchema = new mongoose.Schema({
  webhookId: { type: String, index: true },
  direction: { type: String, enum: ['incoming', 'outgoing'] },
  payload: mongoose.Schema.Types.Mixed,
  status: { type: String, enum: ['received', 'processed', 'failed', 'retried'] },
  errorMessage: String,
  processingTimeMs: Number,
}, {
  timestamps: true,
  // Auto-delete logs older than 30 days
  expireAfterSeconds: 30 * 24 * 60 * 60,
});

WebhookLogSchema.index({ createdAt: -1 });

module.exports = {
  PricingConfig: mongoose.model('PricingConfig', PricingConfigSchema),
  Quotation: mongoose.model('Quotation', QuotationSchema),
  Customer: mongoose.model('Customer', CustomerSchema),
  WebhookLog: mongoose.model('WebhookLog', WebhookLogSchema),
};
