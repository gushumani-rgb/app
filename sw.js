// sw.js — Service Worker for PWA notifications

// Install event
self.addEventListener('install', (event) => {
  self.skipWaiting();
  console.log('Service Worker installed');
});

// Activate event
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

  // Try to parse push data sent from server
  if (event.data) {
    try {
      const serverData = event.data.json();
      payload = { ...payload, ...serverData };
    } catch (err) {
      console.warn('Failed to parse push data', err);
    }
  }

  const options = {
    body: payload.body,
    icon: payload.icon,
    badge: payload.badge,
    tag: payload.tag || 'general',
    data: payload.data,
    renotify: payload.renotify || false,
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const path = event.notification.data?.path || '/';
  const urlToOpen = new URL(path, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.focus();
          if ('navigate' in client) {
            return client.navigate(urlToOpen);
          }
          return;
        }
      }
      // Open new window if no matching tab
      return clients.openWindow(urlToOpen);
    })
  );
});
