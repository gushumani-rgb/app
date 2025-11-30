const CACHE_NAME = "anywhere-income-cache-v1";
const urlsToCache = [
  "/<repo>/index.html",
  "/<repo>/css/style.css",
  "/<repo>/js/main.js",
  "/<repo>/images/icon-192.png",
  "/<repo>/images/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});
