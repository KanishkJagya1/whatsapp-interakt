const express = require('express');
const router = express.Router();
const { handleWebhook, handleDirectQuote } = require('../controllers/webhook.controller');
const { verifyWebhookSignature } = require('../middleware/auth.middleware');
const { validateQuotationRequest } = require('../utils/validation');

// ── Interakt Webhook Endpoint ───────────────────────────
// POST /webhook/interakt
// This is the URL you configure in Interakt's Developer Settings
router.post('/interakt', verifyWebhookSignature, handleWebhook);

// ── Direct Quote API (for web/app clients) ──────────────
// POST /webhook/quote
router.post('/quote', (req, res, next) => {
  const validation = validateQuotationRequest(req.body);
  if (!validation.valid) {
    return res.status(400).json({ success: false, errors: validation.errors });
  }
  req.body = validation.data;
  next();
}, handleDirectQuote);

// ── Webhook Verification (Interakt may ping this) ──────
router.get('/interakt', (req, res) => {
  const token = req.query['hub.verify_token'] || req.query.token;
  if (token === process.env.WEBHOOK_TOKEN) {
    return res.status(200).send(req.query['hub.challenge'] || 'OK');
  }
  res.status(403).send('Forbidden');
});

module.exports = router;
