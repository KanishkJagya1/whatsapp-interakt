/**
 * DATABASE SEED
 * ═════════════
 * Run: node src/database/seed.js
 * Seeds the PricingConfig collection with default values.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { PricingConfig } = require('../models');

const seedData = [
  // Print rates
  { key: 'printRates.bw.ratePerPage', value: 0.45, label: 'B&W Rate per Page', category: 'printRate' },
  { key: 'printRates.color.ratePerPage', value: 0.95, label: 'Color Rate per Page', category: 'printRate' },

  // Binding rules
  { key: 'bindingRules.centerPin.ratePerPage', value: 0.17, label: 'Center Pin Binding Rate', category: 'binding' },
  { key: 'bindingRules.centerPin.maxPages', value: 63, label: 'Center Pin Max Pages', category: 'binding' },
  { key: 'bindingRules.hardBinding.ratePerPage', value: 0.22, label: 'Hard Binding Rate', category: 'binding' },
  { key: 'bindingRules.hardBinding.minPages', value: 64, label: 'Hard Binding Min Pages', category: 'binding' },

  // Tax
  { key: 'tax.gst.rate', value: 18, label: 'GST Rate (%)', category: 'tax' },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    for (const item of seedData) {
      await PricingConfig.findOneAndUpdate(
        { key: item.key },
        { ...item, isActive: true, updatedBy: 'seed' },
        { upsert: true }
      );
      console.log(`  ✓ ${item.key} = ${item.value}`);
    }

    console.log('\n✅ Seed complete!');
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error.message);
    process.exit(1);
  }
}

seed();
