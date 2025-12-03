importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// Initialize Firebase
firebase.initializeApp({
  apiKey: "AIzaSyBk9CnCJlTnSkvdC2PNB6UYiV0BnAkO088",
  authDomain: "work-from-anywhere-ac57b.firebaseapp.com",
  projectId: "work-from-anywhere-ac57b",
  storageBucket: "work-from-anywhere-ac57b.firebasestorage.app",
  messagingSenderId: "1058696678009",
  appId: "1:1058696678009:web:a408c66c367439a22b22a8",
  measurementId: "G-KJ1LHJWTZX"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage(payload => {
  console.log('[firebase-messaging-sw.js] Received background message', payload);

  const { title, body, icon, click_action } = payload.notification;

  const notificationOptions = {
    body: body,
    icon: icon,
    data: { url: click_action }
  };

  self.registration.showNotification(title, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data.url;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (let client of windowClients) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
