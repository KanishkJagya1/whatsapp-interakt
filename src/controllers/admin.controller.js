/**
 * ADMIN CONTROLLER
 * ════════════════
 * Admin endpoints for managing pricing, viewing analytics, and managing orders.
 */

const logger = require('../utils/logger');
const { PricingConfig, Quotation, Customer } = require('../models');
const { invalidateCache, getConfig } = require('../services/pricing.engine');

// ── Get Current Pricing Config ──────────────────────────
async function getPricingConfig(req, res) {
  try {
    const config = await getConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

// ── Update a Pricing Rule ───────────────────────────────
async function updatePricingConfig(req, res) {
  try {
    const { key, value, label, category } = req.body;

    if (!key || value === undefined || !category) {
      return res.status(400).json({ success: false, error: 'key, value, and category are required' });
    }

    const updated = await PricingConfig.findOneAndUpdate(
      { key },
      { value, label, category, isActive: true, updatedBy: req.adminId || 'admin' },
      { upsert: true, new: true }
    );

    // Invalidate pricing cache so next calculation uses new values
    invalidateCache();

    logger.info('Pricing config updated', { key, value });
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

// ── Dashboard Analytics ─────────────────────────────────
async function getAnalytics(req, res) {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const matchStage = Object.keys(dateFilter).length
      ? { createdAt: dateFilter }
      : {};

    const [totalQuotes, statusBreakdown, revenueStats, avgResponseTime, topCustomers] =
      await Promise.all([
        // Total quotations
        Quotation.countDocuments(matchStage),

        // Status breakdown
        Quotation.aggregate([
          { $match: matchStage },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),

        // Revenue stats
        Quotation.aggregate([
          { $match: { ...matchStage, status: { $in: ['confirmed', 'paid', 'completed'] } } },
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: '$breakdown.totalAmount' },
              avgOrderValue: { $avg: '$breakdown.totalAmount' },
              totalOrders: { $sum: 1 },
            },
          },
        ]),

        // Average response time
        Quotation.aggregate([
          { $match: { ...matchStage, responseTimeMs: { $exists: true } } },
          { $group: { _id: null, avgMs: { $avg: '$responseTimeMs' } } },
        ]),

        // Top 10 customers
        Customer.find()
          .sort({ totalQuotations: -1 })
          .limit(10)
          .select('phone name totalQuotations totalOrders totalSpent')
          .lean(),
      ]);

    res.json({
      success: true,
      data: {
        totalQuotes,
        statusBreakdown: statusBreakdown.reduce((acc, s) => {
          acc[s._id] = s.count;
          return acc;
        }, {}),
        revenue: revenueStats[0] || { totalRevenue: 0, avgOrderValue: 0, totalOrders: 0 },
        avgResponseTimeMs: avgResponseTime[0]?.avgMs || 0,
        topCustomers,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

// ── List Quotations ─────────────────────────────────────
async function listQuotations(req, res) {
  try {
    const { page = 1, limit = 20, status, phone } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (phone) filter['customer.phone'] = { $regex: phone };

    const quotations = await Quotation.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const total = await Quotation.countDocuments(filter);

    res.json({
      success: true,
      data: quotations,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = { getPricingConfig, updatePricingConfig, getAnalytics, listQuotations };
