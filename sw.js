// sw.js — full PWA service worker (precache + runtime cache + push notifications)

const CACHE_NAME = 'site-cache-v1';
const PRECACHE = [
  "/",
  "/index.json",
  "/posts/aviso-autoclicker/",
  "/posts/aviso-review/",
  "/posts/benable-guide/",
  "/posts/benable-video/",
  "/posts/boost-earnings-jumptask/",
  "/posts/honeygain-passive-income/",
  "/posts/jumpstask-watch-earn/",
  "/posts/search-earn/",
  "/posts/sproughtgigs-earnings/",
  "/posts/sproughtgigs-video/",
  "/posts/timebucks/",
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgCGidyUJf_In9HiPsmfJ20th393UX3U-kRAXf0qZwBO-YvKztuDyBR0nesmwJFE82YCfs3NZHGfV3CTTjXQfN-US_8deBm0VVU70U1GjDFo5Rd_hms9jpK3ZNqDzE-IVt4rEawkTBsSPnIHj1wY2D_Wwwootj3jav04BnCeIWk0mNfdfGEa7HpvtqI_axZ/s1600/1000062637.webp",
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgoU9ctw-i8fki_svLXzwjVJUgfc2q4xLG507peNxYoFTfMYJSpMStd0Eg1HJkjWs1TW7yPR6AxZxXSXITps2NRx8Xk8ZrYao9qLbBL0BtZqFj5teAQwx9vD_EAGjTp3FEo_y23zB9Vs4TGBDwBIt2RNI8joHlsOmj0NQ1ffR7l6k4JrjLasZ5J2QZbnT6O/s1600/1000062618.webp",
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgovC2hFdYIklJYSw67NH_Zez_yd9ticy4KoW6Z0jmsT2gBD3m_z-GfbGG4f8YwFsq12rz6Uga5BUujaLbiwT9euscE2l7ocrve2HNGhJddC_QKXrMQuP79ko-agaIoa67448WCapmB0hAD89OsNpGf7dUJkFW-VGVheBs2YtaEZOqWGWSrTq09Uski9YQN/s1600/1000062631.webp",
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEh6LASxKVODj5onvgXZ9SaKfaZBVzfIILNPivZRpTvKjq084JdEG5furEPxtD97x7gJQGB75LlqfOV-tqmUClbXVdsysQ0VxA_9s4lkdk-HgUXDp6acg6FIXhzVegWKwdEWyENfJSOi0JSnc-MiARxHvMbZ-WclgcNCnwWWIq7WlVJmSuaxx3AYV6iqm286/s1600/1000062612.webp",
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEic2FhelAjWHgHP9b5FIftOFj7-AGqsKIvFi3BD-DYVjOjRr1HG5JwwAsR1Jm5I3_L3nFURoZpUzDEDAyOUKvON8XnY9vxhmmhM4dbbUP6-MszbzhpXcag1vySCluleYMGA0V8tEFqwCwEmp5Ia1mr2679lvF66vDyPCdfcLOjtGwiANshxGlEHcxznBIup/s1600/1000062635.webp",
  "https://img.youtube.com/vi/0euCUIUDp0c/hqdefault.jpg",
  "https://img.youtube.com/vi/1sBsz9IJw00/hqdefault.jpg",
  "https://img.youtube.com/vi/a59RvqmL8tk/hqdefault.jpg",
  "https://img.youtube.com/vi/gkIULH2sRdQ/hqdefault.jpg",
  "https://img.youtube.com/vi/oLvMXuXa2G0/hqdefault.jpg"
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      try {
        const results = await Promise.allSettled(PRECACHE.map(url =>
          cache.add(new Request(url, { credentials: 'same-origin' }))
        ));
        const failures = results.filter(r => r.status === 'rejected');
        if (failures.length) console.warn('sw: precache failures', failures);
      } catch (err) {
        console.warn('sw: precache error', err);
      }
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(networkRes => {
        const copy = networkRes.clone();
        caches.open(CACHE_NAME).then(cache => {
          if (networkRes && networkRes.ok) cache.put(req, copy).catch(()=>{});
        });
        return networkRes;
      }).catch(() => caches.match('/'))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(networkRes => {
        if (!networkRes || !networkRes.ok) return networkRes;
        const copy = networkRes.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy).catch(()=>{}));
        return networkRes;
      }).catch(() => caches.match('/'));
    })
  );
});

// Push handler (receives payload from server push)
self.addEventListener('push', (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (e) {
      payload = { body: event.data.text() };
    }
  }

  const title = payload.title || 'Notification Title';
  const options = {
    body: payload.body || 'Notification Body Text',
    icon: payload.icon || '/icons/custom-notification-icon.png',
    badge: payload.badge || '/icons/notification-badge.png',
    data: payload.data || { path: '/' },
    tag: payload.tag || undefined,
    renotify: payload.renotify || false,
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click — open or focus the client, navigate if needed
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notificationData = event.notification && event.notification.data ? event.notification.data : {};
  const targetPath = notificationData.path || '/';
  const targetUrl = self.location.origin + targetPath;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url && 'focus' in client) {
          if (client.url === targetUrl) {
            return client.focus();
          } else if (client.navigate) {
            client.focus();
            return client.navigate(targetPath);
          } else {
            client.focus();
            return;
          }
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

// Optional: pushsubscriptionchange event for subscription rotation
self.addEventListener('pushsubscriptionchange', (event) => {
  console.info('sw: pushsubscriptionchange', event);
});
