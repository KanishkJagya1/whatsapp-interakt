require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');
const { connectDB } = require('./config/database');
const webhookRoutes = require('./routes/webhook.routes');
const adminRoutes = require('./routes/admin.routes');
const healthRoutes = require('./routes/health.routes');

const app = express();

// ─── Security & Performance Middleware ──────────────────
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting: 100 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, try again later' }
});
app.use('/api/', limiter);

// ─── Routes ─────────────────────────────────────────────
app.use('/webhook', webhookRoutes);
app.use('/api/admin', adminRoutes);
app.use('/health', healthRoutes);

// ─── Global Error Handler ───────────────────────────────
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// ─── Start Server ───────────────────────────────────────
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
}

startServer();

module.exports = app;
