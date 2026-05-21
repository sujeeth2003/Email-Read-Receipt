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

