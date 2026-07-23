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

      const likelyPrefetch = secondsSinceCreated < GRACE_PERIOD_SECONDS;

      const openEvent = {
        time: now.toLocaleString(),
        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'] || '',
        likelyPrefetch
      };
      db[id].opens.push(openEvent);
      saveDB(db);

      if (!likelyPrefetch) {
        notifier.notify({
          title: '📬 Email opened!',
          message: `"${db[id].label}" was just opened${db[id].recipient ? ' by ' + db[id].recipient : ''}`,
          sound: true
        });
        console.log(`[OPEN] ${id} - ${db[id].label} at ${openEvent.time} (ip: ${openEvent.ip})`);
      } else {
        console.log(`[LIKELY PREFETCH, not notifying] ${id} - ${openEvent.time} (ip: ${openEvent.ip})`);
      }
    } else {
      console.log(`[UNKNOWN PIXEL HIT] ${id}`);
    }

    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': PIXEL.length,
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache'
    });
    return res.end(PIXEL);
  }

  // --- simple dashboard ---
  if (url.pathname === '/' || url.pathname === '/dashboard') {
    const db = loadDB();
    const rows = Object.values(db)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(e => {
        const realOpens = e.opens.filter(o => !o.likelyPrefetch);
        const opensHtml = e.opens.map(o =>
          `${o.time} ${o.ip ? `<span style="color:#888">(${o.ip})</span>` : ''} ${o.likelyPrefetch ? '<span style="color:#e69500">[likely prefetch]</span>' : '<b style="color:#1a7a1a">[real open]</b>'}`
        ).join('<br>');
        return `
        <tr>
          <td>${e.label}</td>
          <td>${e.recipient}</td>
          <td>${e.createdAt}</td>
          <td>${realOpens.length} / ${e.opens.length}</td>
          <td>${opensHtml || '-'}</td>
        </tr>`;
      }).join('');
    const html = `<html><head><title>Mail Tracker</title>
      <style>body{font-family:sans-serif;padding:20px}table{border-collapse:collapse;width:100%}
      td,th{border:1px solid #ccc;padding:6px 10px;text-align:left;font-size:14px}</style>
      <meta http-equiv="refresh" content="5"></head><body>
      <h2>📬 Mail Tracker Dashboard</h2>
      <p style="font-size:13px;color:#666">"Real opens" excludes hits in the first 60s after sending
      (usually Gmail's own prefetch/cache, not an actual read).</p>
      <table><tr><th>Subject/Label</th><th>Recipient</th><th>Sent</th><th>Real / Total opens</th><th>Open log</th></tr>
      ${rows || '<tr><td colspan=5>No tracked emails yet</td></tr>'}</table>
      </body></html>`;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(html);
  }

  send(res, 404, { error: 'not found' });
});

server.listen(PORT, () => {
  console.log(`Mail tracker server running at http://localhost:${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}/dashboard`);
  console.log(`Now run: ngrok http ${PORT}   (to get a public URL for the pixel)`);
});
