/**
 * WEBHOOK CONTROLLER
 * ══════════════════
 * Processes incoming Interakt webhook events.
 *
 * CONVERSATION FLOW:
 *   1. User sends "Hi" / any greeting → Welcome message + print type prompt
 *   2. User selects print type (1 or 2) → Page count prompt
 *   3. User enters page count → Calculate & send quotation
 *   4. User can request new quote or confirm order
 *
 * STATE MANAGEMENT:
 *   Uses in-memory store with TTL (scales to Redis for multi-instance).
 *   State per phone number tracks where user is in the flow.
 */

const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { parsePrintType, parsePageCount } = require('../utils/validation');
const { calculateQuotation } = require('../services/pricing.engine');
const { sendReply } = require('../services/interakt.service');
const {
  formatQuotationMessage,
  formatErrorMessage,
  formatWelcomeMessage,
  formatPagePrompt,
} = require('../services/message.formatter');
const { Quotation, Customer, WebhookLog } = require('../models');

// ─── Conversation State Store ──────────────────────────
// In production with multiple instances, replace with Redis
const sessionStore = new Map();
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

function getSession(phone) {
  const session = sessionStore.get(phone);
  if (!session) return null;
  if (Date.now() - session.updatedAt > SESSION_TTL_MS) {
    sessionStore.delete(phone);
    return null;
  }
  return session;
}

function setSession(phone, data) {
  sessionStore.set(phone, {
    ...data,
    updatedAt: Date.now(),
  });
}

function clearSession(phone) {
  sessionStore.delete(phone);
}

// Clean expired sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [phone, session] of sessionStore) {
    if (now - session.updatedAt > SESSION_TTL_MS) {
      sessionStore.delete(phone);
    }
  }
}, 5 * 60 * 1000);

// ═══════════════════════════════════════════════════════
// MAIN WEBHOOK HANDLER
// ═══════════════════════════════════════════════════════
async function handleWebhook(req, res) {
  const startTime = Date.now();

  // Immediately respond 200 to Interakt (prevent retries)
  res.status(200).json({ status: 'received' });

  try {
    const payload = req.body;

    // Log the incoming webhook
    await WebhookLog.create({
      webhookId: uuidv4(),
      direction: 'incoming',
      payload,
      status: 'received',
    }).catch(() => {}); // Non-blocking

    // Extract message data from Interakt's webhook format
    const messageData = extractMessageData(payload);
    if (!messageData) {
      logger.debug('Non-message webhook received, ignoring');
      return;
    }

    const { phone, text, customerName } = messageData;
    logger.info('Processing message', { phone, text: text.substring(0, 50) });

    // Process through conversation flow
    await processConversation(phone, text, customerName, startTime);
  } catch (error) {
    logger.error('Webhook processing error', { error: error.message, stack: error.stack });
  }
}

/**
 * Extract relevant data from Interakt's webhook payload.
 * Interakt sends different formats; this normalizes them.
 */
function extractMessageData(payload) {
  // Interakt incoming message webhook format
  // Adjust based on your actual Interakt webhook structure
  try {
    // Format 1: Standard Interakt incoming message
    if (payload?.data?.message) {
      return {
        phone: payload.data.customer?.channel_phone_number
          || payload.data.customer?.phone_number
          || payload.data.message?.from,
        text: payload.data.message?.text || payload.data.message?.body || '',
        customerName: payload.data.customer?.traits?.name || null,
      };
    }

    // Format 2: Interakt workflow webhook (button replies)
    if (payload?.data?.customer && payload?.data?.message_text) {
      return {
        phone: payload.data.customer.channel_phone_number,
        text: payload.data.message_text || '',
        customerName: payload.data.customer.traits?.name || null,
      };
    }

    // Format 3: Direct / simplified format
    if (payload?.phone && payload?.message) {
      return {
        phone: payload.phone,
        text: payload.message,
        customerName: payload.name || null,
      };
    }

    return null;
  } catch (error) {
    logger.warn('Could not extract message data', { error: error.message });
    return null;
  }
}

// ═══════════════════════════════════════════════════════
// CONVERSATION STATE MACHINE
// ═══════════════════════════════════════════════════════
async function processConversation(phone, text, customerName, startTime) {
  const normalizedText = text.trim().toLowerCase();
  const session = getSession(phone);

  // ── Command Shortcuts ─────────────────────────────
  if (['hi', 'hello', 'hey', 'start', 'menu', 'reset'].includes(normalizedText)) {
    clearSession(phone);
    setSession(phone, { step: 'awaiting_print_type' });
    await sendReply(phone, formatWelcomeMessage());
    return;
  }

  if (['help', 'support', 'agent'].includes(normalizedText)) {
    await sendReply(phone, '🙋 Our team will reach out to you shortly!\n\nYou can also call us at: *+91 98765 43210*\n\nOr type *Hi* to start a new quote.');
    return;
  }

  // ── No Active Session → Start Fresh ───────────────
  if (!session) {
    setSession(phone, { step: 'awaiting_print_type' });
    await sendReply(phone, formatWelcomeMessage());
    return;
  }

  // ── Step 1: Awaiting Print Type ───────────────────
  if (session.step === 'awaiting_print_type') {
    const printType = parsePrintType(normalizedText);

    if (!printType) {
      await sendReply(phone, formatErrorMessage('invalidPrintType'));
      return;
    }

    setSession(phone, { step: 'awaiting_pages', printType });
    await sendReply(phone, formatPagePrompt(printType));
    return;
  }

  // ── Step 2: Awaiting Page Count ───────────────────
  if (session.step === 'awaiting_pages') {
    const pages = parsePageCount(normalizedText);

    if (!pages) {
      await sendReply(phone, formatErrorMessage('invalidPages', text));
      return;
    }

    // Calculate quotation
    try {
      const result = await calculateQuotation({
        printType: session.printType,
        pages,
        quantity: 1,
      });

      // Send formatted quotation
      const message = formatQuotationMessage(result, customerName);
      await sendReply(phone, message);

      // Save to database (non-blocking)
      const quotationId = `QT-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

      Quotation.create({
        quotationId,
        customer: { phone, name: customerName },
        input: { printType: session.printType, pages, quantity: 1 },
        breakdown: result.breakdown,
        channel: 'whatsapp',
        responseTimeMs: Date.now() - startTime,
      }).catch((err) => logger.error('Failed to save quotation', { error: err.message }));

      // Upsert customer record (non-blocking)
      Customer.findOneAndUpdate(
        { phone },
        {
          $inc: { totalQuotations: 1 },
          $set: { name: customerName, lastInteraction: new Date() },
        },
        { upsert: true, new: true }
      ).catch(() => {});

      // Reset session for new quote
      setSession(phone, { step: 'post_quote', lastQuotationId: quotationId });
    } catch (error) {
      logger.error('Quotation calculation failed', { error: error.message, phone });
      await sendReply(phone, formatErrorMessage('serverError'));
    }
    return;
  }

  // ── Step 3: Post-Quote Actions ────────────────────
  if (session.step === 'post_quote') {
    if (['1', 'order', 'confirm', 'yes', 'place order'].includes(normalizedText)) {
      // Mark as confirmed
      if (session.lastQuotationId) {
        Quotation.findOneAndUpdate(
          { quotationId: session.lastQuotationId },
          { status: 'confirmed', convertedToOrder: true }
        ).catch(() => {});
      }

      await sendReply(phone, [
        '✅ *Order Confirmed!*',
        '',
        `Your order ID: *${session.lastQuotationId}*`,
        '',
        'Our team will contact you shortly with payment and delivery details.',
        '',
        'Thank you for choosing *YourPrintShop*! 🙏',
      ].join('\n'));

      clearSession(phone);
      return;
    }

    if (['2', 'new', 'new quote', 'again'].includes(normalizedText)) {
      clearSession(phone);
      setSession(phone, { step: 'awaiting_print_type' });
      await sendReply(phone, formatWelcomeMessage());
      return;
    }

    if (['3', 'talk', 'team', 'call'].includes(normalizedText)) {
      await sendReply(phone, '🙋 Our team will reach out within 5 minutes!\n\nCall: *+91 98765 43210*');
      clearSession(phone);
      return;
    }

    // Unrecognized post-quote input → re-prompt
    await sendReply(phone, [
      'Please choose an option:',
      '',
      '1️⃣ Place this order',
      '2️⃣ Get a new quote',
      '3️⃣ Talk to our team',
    ].join('\n'));
    return;
  }
}

// ═══════════════════════════════════════════════════════
// DIRECT API ENDPOINT (for web/non-WhatsApp clients)
// ═══════════════════════════════════════════════════════
async function handleDirectQuote(req, res) {
  const startTime = Date.now();

  try {
    const { printType, pages, quantity } = req.body;
    const result = await calculateQuotation({ printType, pages, quantity });

    res.json({
      success: true,
      data: result,
      meta: {
        responseTimeMs: Date.now() - startTime,
        quotationId: `QT-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
      },
    });
  } catch (error) {
    logger.error('Direct quote failed', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
}

module.exports = { handleWebhook, handleDirectQuote };
