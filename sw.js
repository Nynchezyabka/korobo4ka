// sw.js
const CACHE_NAME = 'korobochka-cache-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Сетевой запрос с запасным вариантом из кеша
  event.respondWith(
    fetch(req).then(res => {
      const resClone = res.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(req, resClone)).catch(() => {});
      return res;
    }).catch(() => caches.match(req).then(c => c || (req.mode === 'navigate' ? caches.match('/index.html') : undefined)))
  );
});

self.addEventListener('push', function(event) {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch (e) {
        data = {};
    }
    const options = {
        body: data.body || 'Время вышло! Задача завершена.',
        icon: data.icon || '/icon-192.png',
        badge: data.badge || '/icon-192.png',
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
