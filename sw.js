// Brandzy service worker: makes the web app installable ("Add to Home Screen").
// It deliberately caches nothing, so every launch loads the latest app and data.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {
    // Network only: let the browser handle the request as usual.
});
