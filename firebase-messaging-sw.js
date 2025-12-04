importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

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

messaging.onBackgroundMessage(function(payload) {
  const { title, body, icon, click_action } = payload.notification;
  self.registration.showNotification(title, { body, icon, data: { click_action } });
});

self.addEventListener('notificationclick', function(event) {
  const click_action = event.notification.data?.click_action;
  if (click_action) {
    event.notification.close();
    event.waitUntil(clients.openWindow(click_action));
  }
});
