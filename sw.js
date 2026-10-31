// Brandzy service worker: makes the web app installable ("Add to Home Screen") and shows its
// notifications (Web Push from the send-push function; app/push.js subscribes).
// It deliberately caches nothing, so every launch loads the latest app and data.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {
    // Network only: let the browser handle the request as usual.
});

self.addEventListener('push', (event) => {
    let data = {};
    try { data = event.data ? event.data.json() : {}; } catch (e) {}
    event.waitUntil(Promise.all([
        // iPhone requires every push to show a notification.
        self.registration.showNotification(data.title || 'Brandzy', {
            body: data.body || '',
            icon: '/assets/pwa-192.png',
            badge: '/assets/favicon.png',
            tag: data.notification_id || undefined,
            data: { url: '/app/' }
        }),
        // An open app reloads its data so the bell and deal list show it.
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
            list.forEach((client) => client.postMessage('brandzy-push'));
        })
    ]));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = (event.notification.data && event.notification.data.url) || '/app/';
    event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
        for (const client of list) {
            if (new URL(client.url).pathname.startsWith('/app') && 'focus' in client) return client.focus();
        }
        return self.clients.openWindow(url);
    }));
});
