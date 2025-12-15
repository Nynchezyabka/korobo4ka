// sw.js
const CACHE_VERSION = 'v5';
const STATIC_CACHE = `korobochka-static-${CACHE_VERSION}`;
const ASSETS_CACHE = `korobochka-assets-${CACHE_VERSION}`;
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/db.js',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k !== STATIC_CACHE && k !== ASSETS_CACHE).map(k => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

function isApiRequest(req) {
  try { return new URL(req.url).pathname.startsWith('/api/'); } catch (_) { return false; }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // bypass non-GET

  if (isApiRequest(req)) {
    // Network First for API
    event.respondWith((async () => {
      try {
        const net = await fetch(req);
        return net;
      } catch (_) {
        const cached = await caches.match(req);
        if (cached) return cached;
        // Fallback 503 JSON
        return new Response(JSON.stringify({ error: 'offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
      }
    })());
    return;
  }

  // Navigation requests -> serve cached index.html when offline
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try { return await fetch(req); } catch (_) { return caches.match('/index.html'); }
    })());
    return;
  }

  // Cache First for static assets (same-origin)
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const net = await fetch(req);
      // Determine which cache to use
      const isAssetImage = req.url.includes('/Assets/');
      const cacheToUse = isAssetImage ? ASSETS_CACHE : STATIC_CACHE;
      const cache = await caches.open(cacheToUse);
      cache.put(req, net.clone()).catch(() => {});
      return net;
    } catch (_) {
      // Fallback to cached assets if available
      try {
        const assetsCached = await caches.match(req.url, { cacheName: ASSETS_CACHE });
        if (assetsCached) return assetsCached;
      } catch (__) {}
      // last resort: if requesting index parts, return index
      if (req.destination === 'document') return caches.match('/index.html');
      return new Response('', { status: 504 });
    }
  })());
});

self.addEventListener('push', function(event) {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch (e) {
        data = {};
    }
    const giftBoxIcon = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTkyIiBoZWlnaHQ9IjE5MiIgdmlld0JveD0iMCAwIDE5MiAxOTIiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxOTIiIGhlaWdodD0iMTkyIiBmaWxsPSIjZmZmYWYwIi8+CjxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDQ4LCA0OCkiPgo8cmVjdCB4PSIwIiB5PSI0OCIgd2lkdGg9Ijk2IiBoZWlnaHQ9IjY0IiBmaWxsPSIjRkZENTRGIiBzdHJva2U9IiM1ZDQwMzciIHN0cm9rZS13aWR0aD0iMiIgcng9IjgiLz4KPHBhdGggZD0iTTAgNDhMMjQgMzJMNDggNDhMMjQgNDgiIGZpbGw9IiNGRkE3MjciIHN0cm9rZT0iIzVkNDAzNyIgc3Ryb2tlLXdpZHRoPSIyIi8+CjxwYXRoIGQ9Ik00OCA0OEw3MiAzMkw5NiA0OEw3MiA0OCIgZmlsbD0iI0ZGQjc0RiIgc3Ryb2tlPSIjNWQ0MDM3IiBzdHJva2Utd2lkdGg9IjIiLz4KPC9nPgo8L3N2Zz4=';
    const options = {
        body: data.body || 'Время вышло! Задача завершена.',
        icon: data.icon || giftBoxIcon,
        badge: data.badge || giftBoxIcon,
        vibrate: data.vibrate || [500, 300, 500],
        tag: data.tag || 'timer-notification',
        renotify: true,
        requireInteraction: true,
        data: data.data || { url: '/' }
    };

    event.waitUntil(
        self.registration.showNotification(data.title || '🎁 КОРОБОЧКА', options)
    );
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    const targetUrl = (event.notification.data && event.notification.data.url) || '/';
    event.waitUntil((async () => {
        const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of clientList) {
            try {
                if ('navigate' in client) await client.navigate(targetUrl);
                if ('focus' in client) return client.focus();
            } catch (e) {}
        }
        if (clients.openWindow) {
            return clients.openWindow(targetUrl);
        }
    })());
});
