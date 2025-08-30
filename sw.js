// sw.js
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
