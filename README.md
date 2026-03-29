# WhatsApp Quotation System

Real-time printing quotation calculator via WhatsApp using Interakt.

## Quick Start

```bash
npm install
cp .env.example .env   # Fill in your keys
node src/server.js
```

## Environment Variables

See `.env.example` for all required variables.

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | /webhook/interakt | Interakt webhook receiver |
| POST | /webhook/quote | Direct quotation API |
| GET | /api/admin/pricing | View pricing config |
| PUT | /api/admin/pricing | Update pricing rule |
| GET | /api/admin/analytics | Dashboard stats |
| GET | /health | Health check |
