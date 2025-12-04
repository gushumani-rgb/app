// -----------------------------
// Service Worker: Offline + Push Notifications
// -----------------------------

// Cache name for offline pages
const CACHE = "pwabuilder-offline";

// Load Workbox from Google CDN
importScripts('https://storage.googleapis.com/workbox-cdn/releases/5.1.2/workbox-sw.js');

// -----------------------------
// Offline caching
// -----------------------------
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Cache all pages using Stale-While-Revalidate
workbox.routing.registerRoute(
  new RegExp('.*'), // Matches all requests
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: CACHE
  })
);

// -----------------------------
// Push notifications
// -----------------------------
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Notification Title', {
      body: data.body || 'Notification Body Text',
      icon: data.icon || '/custom-notification-icon.png',
      data: {
        path: data.path || '/' // URL to open on click
      }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const path = event.notification.data?.path || '/';
  const fullPath = self.location.origin + path;

  event.waitUntil(
    clients.openWindow(fullPath)
  );
});
