/**
 * INTERAKT SERVICE
 * ════════════════
 * Handles all communication with Interakt's API.
 * Sends template messages and session replies back to users.
 */

const axios = require('axios');
const logger = require('../utils/logger');

const INTERAKT_BASE = process.env.INTERAKT_BASE_URL || 'https://api.interakt.ai/v1';
const API_KEY = process.env.INTERAKT_API_KEY;

/**
 * Send a reply message to a WhatsApp user via Interakt
 * Uses the "send message" API for session-based replies
 */
async function sendReply(phoneNumber, messageBody) {
  try {
    // Clean phone number (remove country code prefix if present)
    const cleanPhone = phoneNumber.replace(/^(91|0|\+91)/, '');

    const response = await axios.post(
      `${INTERAKT_BASE}/public/message/`,
      {
        countryCode: '+91',
        phoneNumber: cleanPhone,
        callbackData: 'quotation_reply',
        type: 'Text',
        data: {
          message: messageBody,
        },
      },
      {
        headers: {
          Authorization: `Basic ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 5000, // 5 second timeout
      }
    );

    logger.info('Message sent via Interakt', {
      phone: cleanPhone,
      status: response.status,
    });

    return { success: true, messageId: response.data?.id };
  } catch (error) {
    logger.error('Failed to send Interakt message', {
      phone: phoneNumber,
      error: error.response?.data || error.message,
    });
    return { success: false, error: error.message };
  }
}

/**
 * Send a template message (for outbound/notifications)
 */
async function sendTemplate(phoneNumber, templateName, params = []) {
  try {
    const cleanPhone = phoneNumber.replace(/^(91|0|\+91)/, '');

    const response = await axios.post(
      `${INTERAKT_BASE}/public/message/`,
      {
        countryCode: '+91',
        phoneNumber: cleanPhone,
        type: 'Template',
        template: {
          name: templateName,
          languageCode: 'en',
          bodyValues: params,
        },
      },
      {
        headers: {
          Authorization: `Basic ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      }
    );

    return { success: true, messageId: response.data?.id };
  } catch (error) {
    logger.error('Failed to send template', {
      phone: phoneNumber,
      template: templateName,
      error: error.response?.data || error.message,
    });
    return { success: false, error: error.message };
  }
}

module.exports = { sendReply, sendTemplate };
