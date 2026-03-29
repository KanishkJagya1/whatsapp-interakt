/**
 * AUTHENTICATION MIDDLEWARE
 * ═════════════════════════
 * - Webhook signature verification (Interakt HMAC)
 * - Admin API key validation
 */

const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Verify Interakt webhook signature
 * Interakt sends a secret key that you configure; verify it matches.
 */
function verifyWebhookSignature(req, res, next) {
  try {
    const webhookSecret = process.env.INTERAKT_WEBHOOK_SECRET;

    // If no secret configured, skip verification (dev mode)
    if (!webhookSecret) {
      logger.warn('Webhook signature verification skipped (no secret configured)');
      return next();
    }

    // Interakt uses a secret key sent in headers
    const receivedSignature = req.headers['x-interakt-signature']
      || req.headers['x-webhook-signature']
      || req.query.secret;

    if (!receivedSignature) {
      logger.warn('Webhook received without signature');
      // Still process in dev, reject in production
      if (process.env.NODE_ENV === 'production') {
        return res.status(401).json({ error: 'Missing webhook signature' });
      }
      return next();
    }

    // HMAC verification
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (receivedSignature === webhookSecret || receivedSignature === expectedSignature) {
      return next();
    }

    logger.warn('Invalid webhook signature');
    return res.status(401).json({ error: 'Invalid webhook signature' });
  } catch (error) {
    logger.error('Webhook auth error', { error: error.message });
    return res.status(500).json({ error: 'Authentication error' });
  }
}

/**
 * Validate admin API key
 */
function verifyAdminAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

  if (!apiKey || apiKey !== process.env.API_SECRET_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.adminId = 'admin'; // In production, decode JWT to get admin ID
  next();
}

module.exports = { verifyWebhookSignature, verifyAdminAuth };
