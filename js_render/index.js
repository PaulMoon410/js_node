/**
 * GeoOS - Node.js Utility Service (Render + Express)
 * Deploys to https://js-node.onrender.com (Harold's dedicated Node service).
 * Exposes /health and utility endpoints with CORS.
 *
 * To merge into the existing js_node server.js (PaulMoon410/js_node),
 * add the /health, /echo, and /webhook routes below to server.js.
 *
 * Environment variables:
 *   PORT    - Port to listen on (Render sets this automatically)
 *   API_KEY - Required X-API-Key header value (optional; if set, enforced)
 */

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || '';

const corsOptions = {
  origin: ["https://www.geocities.ws/paulmoon410/harold_os", "https://www.geocities.ws", "http://localhost:3000", "http://127.0.0.1:3000"],
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json());

// Optional API key middleware
const requireApiKey = (req, res, next) => {
  if (API_KEY && req.headers['x-api-key'] !== API_KEY) {
    return res.status(401).json({ error: 'Invalid or missing API key' });
  }
  next();
};

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'node-service', timestamp: new Date().toISOString() });
});

app.get('/echo', requireApiKey, (req, res) => {
  res.json({ echo: req.query.message || '', timestamp: new Date().toISOString() });
});

app.post('/webhook', requireApiKey, (req, res) => {
  console.log('Webhook received:', JSON.stringify(req.body, null, 2));
  res.json({ status: 'received', receivedAt: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Node service listening on port ${PORT}`);
});

module.exports = app;