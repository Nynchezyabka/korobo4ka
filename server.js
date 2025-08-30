const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

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

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url);
  let pathname = decodeURIComponent(parsed.pathname || '/');

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
