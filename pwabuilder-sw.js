const CACHE = "offline-cache-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll([
        OFFLINE_URL,
        "/manifest.json",
        "/icons/icon-192.png",
        "/icons/icon-512.png"
      ])
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cache = await caches.open(CACHE);
        return cache.match(OFFLINE_URL);
      })
    );
  }
});

// Push notifications
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "Anywhere Income", {
      body: data.body || "You have a new notification",
      icon: data.icon || "/icons/icon-192.png",
      data: { path: data.path || "/" }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = event.notification.data?.path || "/";
  event.waitUntil(clients.openWindow(self.location.origin + path));
});
