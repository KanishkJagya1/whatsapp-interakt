const express = require('express');
const router = express.Router();
const { verifyAdminAuth } = require('../middleware/auth.middleware');
const {
  getPricingConfig,
  updatePricingConfig,
  getAnalytics,
  listQuotations,
} = require('../controllers/admin.controller');

// All admin routes require API key authentication
router.use(verifyAdminAuth);

// GET  /api/admin/pricing          → Current pricing config
// PUT  /api/admin/pricing          → Update a pricing rule
// GET  /api/admin/analytics        → Dashboard analytics
// GET  /api/admin/quotations       → List all quotations

router.get('/pricing', getPricingConfig);
router.put('/pricing', updatePricingConfig);
router.get('/analytics', getAnalytics);
router.get('/quotations', listQuotations);

module.exports = router;
