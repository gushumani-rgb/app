// sw.js — Service Worker for PWA notifications
self.addEventListener('install', (event) => {
  self.skipWaiting();
  console.log('Service Worker installed');
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
  console.log('Service Worker activated');
});

// Listen for push messages from the server
self.addEventListener('push', (event) => {
  let payload = {
    title: 'Notification',
    body: 'You have a new message!',
    icon: '/icons/notification-badge.png',
    badge: '/icons/notification-badge.png',
    data: { path: '/' },
  };

  try {
    if (event.data) {
      const serverData = event.data.json();
      payload = { ...payload, ...serverData };
    }
  } catch (err) {
    console.warn('Failed to parse push data', err);
  }

  const options = {
    body: payload.body,
    icon: payload.icon,
    badge: payload.badge,
    tag: payload.tag || 'general',
    data: payload.data,
    renotify: payload.renotify || false,
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const path = data.path || '/';
  const urlToOpen = new URL(path, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a tab with the same origin is open, focus it
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin)) {
          client.focus();
          return client.navigate ? client.navigate(urlToOpen) : Promise.resolve();
        }
      }
      // Otherwise, open a new tab
      return clients.openWindow(urlToOpen);
    })
  );
});
