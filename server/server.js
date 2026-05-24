// Local Email Open Tracker
// Run with: node server.js
// Then expose it publicly with: ngrok http 3939
//
// Endpoints:
//   GET  /pixel/:id.png   -> serves a 1x1 transparent PNG, logs + notifies on open
//   GET  /api/opens       -> JSON list of all tracked emails and their open events
//   POST /api/new         -> creates a new tracking id, returns pixel URL to embed

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const notifier = require('node-notifier');

const PORT = process.env.PORT || 3939;
const DB_PATH = path.join(__dirname, 'tracking.json');

// 1x1 transparent PNG bytes
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

function loadDB() {
  if (!fs.existsSync(DB_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch (e) {
    return {};
  }
}

function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function send(res, code, body, headers = {}) {
  res.writeHead(code, { 'Content-Type': 'application/json', ...headers });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // CORS for the extension / local dashboard
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  // --- create a new tracking id ---
  if (url.pathname === '/api/new' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      let meta = {};
      try { meta = JSON.parse(body || '{}'); } catch (e) {}
      const id = crypto.randomBytes(8).toString('hex');
      const db = loadDB();
      db[id] = {
        id,
        label: meta.label || '(no subject)',
        recipient: meta.recipient || '',
        createdAt: new Date().toISOString(),
        opens: []
      };
      saveDB(db);
      send(res, 200, { id });
    });
    return;
  }

  // --- list all tracked emails ---
  if (url.pathname === '/api/opens' && req.method === 'GET') {
    return send(res, 200, loadDB());
  }

  // --- the tracking pixel itself ---
  const pixelMatch = url.pathname.match(/^\/pixel\/([a-f0-9]+)\.png$/);
  if (pixelMatch && req.method === 'GET') {
    const id = pixelMatch[1];
    const db = loadDB();
    if (db[id]) {
      const now = new Date();
      const createdAt = new Date(db[id].createdAt);
      const secondsSinceCreated = (now - createdAt) / 1000;
      const GRACE_PERIOD_SECONDS = 60; // opens within this window are likely
                                        // Gmail's own prefetch/cache, not a real read

