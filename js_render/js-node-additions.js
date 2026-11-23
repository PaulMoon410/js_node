/**
 * GeoOS - Node.js Service Additions for js-node.onrender.com
 * ----------------------------------------------------------
 * Add these routes to PaulMoon410/js_node/server.js (Harold's dedicated Node service).
 * Insert them before app.listen(), after the existing /api/auth/me route.
 *
 * These endpoints are required by the GeoOS web OS frontend:
 *   GET  /health          - Cold-start wake-up check (used by boot.js)
 *   GET  /echo?msg=...    - Utility echo endpoint
 *   POST /webhook         - Webhook receiver
 *
 * API key enforcement is optional. If API_KEY env var is set,
 * /echo and /webhook require X-API-Key header. /health is always public.
 */

// Optional API key middleware (reuse existing pattern from server.js)
const requireNodeApiKey = (req, res, next) => {
  const API_KEY = process.env.API_KEY || '';
  if (API_KEY && req.headers['x-api-key'] !== API_KEY) {
    return res.status(401).json({ error: 'Invalid or missing API key' });
  }
  next();
};

// Health check for web OS cold-start wake-up
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'node-service', timestamp: new Date().toISOString() });
});

// Utility echo endpoint
app.get('/echo', requireNodeApiKey, (req, res) => {
  res.json({ echo: req.query.message || '', timestamp: new Date().toISOString() });
});

// Webhook receiver
app.post('/webhook', requireNodeApiKey, (req, res) => {
  console.log('GeoOS webhook received:', JSON.stringify(req.body, null, 2));
  res.json({ status: 'received', receivedAt: new Date().toISOString() });
});
