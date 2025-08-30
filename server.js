const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const webpush = require('web-push');

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const root = process.cwd();

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function send(res, statusCode, data, headers = {}) {
  res.writeHead(statusCode, headers);
  if (data) res.end(data);
  else res.end();
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) req.connection.destroy();
    });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const type = contentTypes[ext] || 'application/octet-stream';

  // No-cache for HTML and service worker to ensure updates
  const baseHeaders = {
    'Content-Type': type,
    'Cache-Control': (ext === '.html' || path.basename(filePath) === 'sw.js')
      ? 'no-cache, no-store, must-revalidate'
      : 'public, max-age=31536000, immutable'
  };

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        send(res, 404, 'Not Found', { 'Content-Type': 'text/plain; charset=utf-8' });
      } else {
        send(res, 500, 'Internal Server Error', { 'Content-Type': 'text/plain; charset=utf-8' });
      }
      return;
    }
    send(res, 200, data, baseHeaders);
  });
}

// Web Push setup
let VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
let VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  const keys = webpush.generateVAPIDKeys();
  VAPID_PUBLIC_KEY = keys.publicKey;
  VAPID_PRIVATE_KEY = keys.privateKey;
  console.log('\nGenerated ephemeral VAPID keys for dev. Public key:');
  console.log(VAPID_PUBLIC_KEY);
}

webpush.setVapidDetails(
  'mailto:admin@example.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

const subscriptions = new Map(); // endpoint -> subscription
const scheduled = new Map(); // id -> timeout handle

function toJson(res, obj, status=200) {
  send(res, status, Buffer.from(JSON.stringify(obj)), { 'Content-Type': 'application/json; charset=utf-8' });
}

async function handleApi(req, res, pathname) {
  if (req.method === 'GET' && pathname === '/api/push/public-key') {
    return toJson(res, { publicKey: VAPID_PUBLIC_KEY });
  }

  if (req.method === 'POST' && pathname === '/api/push/subscribe') {
    try {
      const sub = await readJson(req);
      if (!sub || !sub.endpoint) return toJson(res, { error: 'invalid subscription' }, 400);
      subscriptions.set(sub.endpoint, sub);
      return toJson(res, { ok: true });
    } catch (e) {
      return toJson(res, { error: 'bad json' }, 400);
    }
  }

  if (req.method === 'POST' && pathname === '/api/timer/schedule') {
    try {
      const body = await readJson(req);
      const { endAt, taskText } = body || {};
      if (!endAt) return toJson(res, { error: 'endAt required' }, 400);
      const delay = Math.max(0, endAt - Date.now());
      const id = String(endAt);
      if (!scheduled.has(id)) {
        const handle = setTimeout(() => {
          const payload = JSON.stringify({
            title: '🎁 КОРОБОЧКА',
            body: taskText ? `Задача: ${taskText}` : 'Время вышло! Задача завершена.',
            vibrate: [500,300,500],
            data: { url: '/' }
          });
          for (const sub of subscriptions.values()) {
            webpush.sendNotification(sub, payload).catch(() => {});
          }
          scheduled.delete(id);
        }, delay);
        scheduled.set(id, handle);
      }
      return toJson(res, { ok: true, delay });
    } catch (e) {
      return toJson(res, { error: 'bad json' }, 400);
    }
  }

  if (req.method === 'POST' && pathname === '/api/timer/cancel') {
    try {
      const body = await readJson(req);
      const { endAt } = body || {};
      const id = String(endAt || '');
      const handle = scheduled.get(id);
      if (handle) {
        clearTimeout(handle);
        scheduled.delete(id);
      }
      return toJson(res, { ok: true });
    } catch (e) {
      return toJson(res, { error: 'bad json' }, 400);
    }
  }

  return null;
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url);
  let pathname = decodeURIComponent(parsed.pathname || '/');

  if (pathname.startsWith('/api/')) {
    const handled = await handleApi(req, res, pathname);
    if (handled !== null) return; // already responded
  }

  // Normalize and prevent path traversal
  pathname = path.normalize(pathname).replace(/^\/+/, '/');

  let filePath = path.join(root, pathname);

  // If directory, serve index.html
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  // For SPA-style routes (if any), fallback to index.html when file doesn't exist
  if (!fs.existsSync(filePath)) {
    const fallback = path.join(root, 'index.html');
    if (fs.existsSync(fallback)) {
      return serveFile(fallback, res);
    }
    return send(res, 404, 'Not Found', { 'Content-Type': 'text/plain; charset=utf-8' });
  }

  serveFile(filePath, res);
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
