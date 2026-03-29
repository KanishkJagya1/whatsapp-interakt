/**
 * MESSAGE FORMATTER
 * ══════════════════
 * Formats pricing engine output into WhatsApp-friendly messages.
 * Uses Unicode characters for clean formatting (WhatsApp supports bold via *text*).
 */

/**
 * Format a full quotation result into a WhatsApp reply message
 */
function formatQuotationMessage(result, customerName) {
  const { input, breakdown, summary } = result;
  const greeting = customerName ? `Hi ${customerName}! ` : 'Hi! ';

  const lines = [
    `${greeting}Here's your quotation:`,
    '',
    `📋 *QUOTATION DETAILS*`,
    `━━━━━━━━━━━━━━━━━━━━━`,
    '',
    `📄 *Print Type:* ${breakdown.printLabel}`,
    `📑 *Pages:* ${input.pages}`,
    input.quantity > 1 ? `📦 *Quantity:* ${input.quantity} copies` : null,
    '',
    `💰 *PRICE BREAKDOWN*`,
    `━━━━━━━━━━━━━━━━━━━━━`,
    '',
    `Print Cost: ₹${breakdown.printCostPerPage}/page × ${input.pages} = *₹${breakdown.totalPrintCost}*`,
    '',
    `📎 *Binding:* ${breakdown.bindingLabel}`,
    `Binding Cost: ₹${breakdown.bindingCostPerPage}/page × ${breakdown.bindingPagesCharged} = *₹${breakdown.totalBindingCost}*`,
    '',
  ];

  if (input.quantity > 1) {
    lines.push(`Per Copy: *₹${summary.perCopy}*`);
    lines.push(`Subtotal (${input.quantity} copies): *₹${summary.subtotal}*`);
  } else {
    lines.push(`Subtotal: *₹${summary.subtotal}*`);
  }

  if (summary.discount > 0) {
    lines.push(`Discount (${breakdown.discountPercent}%): -₹${summary.discount}`);
  }

  lines.push(
    `GST (${breakdown.gstRate}%): +₹${summary.gst}`,
    '',
    `━━━━━━━━━━━━━━━━━━━━━`,
    `🧾 *TOTAL: ₹${summary.total}*`,
    `━━━━━━━━━━━━━━━━━━━━━`,
    '',
    `💡 _This quote is valid for 24 hours._`,
    '',
    `Would you like to:`,
    `1️⃣ Place this order`,
    `2️⃣ Get a new quote`,
    `3️⃣ Talk to our team`,
  );

  return lines.filter((l) => l !== null).join('\n');
}

/**
 * Format error message for invalid inputs
 */
function formatErrorMessage(errorType, details) {
  const messages = {
    invalidPages: [
      `⚠️ Oops! "${details}" is not a valid page count.`,
      '',
      'Please enter a number between 1 and 10,000.',
      '',
      'Example: *150*',
    ],
    invalidPrintType: [
      `⚠️ Please select a valid print type:`,
      '',
      '1️⃣ *Black & White* — ₹0.45/page',
      '2️⃣ *Color* — ₹0.95/page',
      '',
      'Reply with *1* or *2*',
    ],
    serverError: [
      '😔 Sorry, something went wrong on our end.',
      '',
      'Please try again in a moment, or type *HELP* to connect with our team.',
    ],
    sessionExpired: [
      'Your previous session has expired.',
      '',
      'Type *Hi* to start a new quotation.',
    ],
  };

  return (messages[errorType] || messages.serverError).join('\n');
}

/**
 * Format welcome message
 */
function formatWelcomeMessage() {
  return [
    '👋 Welcome to *YourPrintShop*!',
    '',
    'I can generate an instant quote for your printing needs.',
    '',
    'Let\'s get started! What type of printing do you need?',
    '',
    '1️⃣ *Black & White* — ₹0.45/page',
    '2️⃣ *Color* — ₹0.95/page',
    '',
    'Reply with *1* or *2*',
  ].join('\n');
}

/**
 * Format page count prompt
 */
function formatPagePrompt(printType) {
  const label = printType === 'bw' ? 'Black & White' : 'Color';
  return [
    `✅ Great! You selected *${label}* printing.`,
    '',
    '📄 How many pages do you need printed?',
    '',
    'Just reply with the number (e.g., *150*)',
  ].join('\n');
}

module.exports = {
  formatQuotationMessage,
  formatErrorMessage,
  formatWelcomeMessage,
  formatPagePrompt,
};
