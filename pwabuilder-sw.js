// /sw.js
const CACHE_VERSION = 'v1';
const CACHE_NAME = `pwabuilder-offline-page-${CACHE_VERSION}`;

// Make this a same-origin offline page (create /offline.html on app-a24.pages.dev)
const OFFLINE_FALLBACK = '/offline.html';

// Workbox (CDN)
importScripts('https://storage.googleapis.com/workbox-cdn/releases/5.1.2/workbox-sw.js');

// Skip waiting when receiving message from page
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Install: cache offline page and any core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll([
        OFFLINE_FALLBACK,
        // add additional core files if you want: '/', '/index.html', '/styles.css'
      ]))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches and take control
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve()))
    ))
    .then(() => self.clients.claim())
  );
});

// Enable navigation preload if supported
if (workbox && workbox.navigationPreload && workbox.navigationPreload.isSupported()) {
  workbox.navigationPreload.enable();
}

// Use navigation matcher for SPA navigations
workbox.routing.registerRoute(
  ({request}) => request.mode === 'navigate',
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: CACHE_NAME,
  })
);

// Optionally cache images and static assets (example)
workbox.routing.registerRoute(
  ({request}) => request.destination === 'image',
  new workbox.strategies.CacheFirst({
    cacheName: `images-${CACHE_VERSION}`,
    plugins: [
      new workbox.expiration.ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 })
    ]
  })
);

// Fetch handler: fallback to offline page for navigation failures
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        // Try navigation preload
        const preloadResp = await event.preloadResponse;
        if (preloadResp) return preloadResp;

        // Try network first
        const networkResp = await fetch(event.request);
        return networkResp;
      } catch (err) {
        // On failure, return cached offline page
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(OFFLINE_FALLBACK);
        return cached || Response.error();
      }
    })());
  }
  // Let workbox routes handle other requests
});

// ===== PUSH NOTIFICATIONS =====
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Notification';
  const options = {
    body: data.body || '',
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/badge-72.png',
    data: { url: data.url || '/' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus an open client if possible
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
