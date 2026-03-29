const mongoose = require('mongoose');
const logger = require('../utils/logger');

async function connectDB() {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    logger.info(`MongoDB connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    logger.error('MongoDB connection failed', { error: error.message });
    throw error;
  }
}

module.exports = { connectDB };
