self.addEventListener('install', (event) => {
console.log('Service Worker installing.');
// You can add caching here if needed
});

self.addEventListener('fetch', (event) => {
// For now, just pass requests through
event.respondWith(fetch(event.request));
});
