const CACHE_NAME = "village-sim-cache-v1";
const urlsToCache = [
    "./",
    "./index.html",
    "./main.js",
    "./assets/lalpur_c.png", // Add all assets you want to cache
    "./assets/img.png",
    "./assets/img1.png",
    "./assets/img2.png",
    "./assets/img3.png",
    "./assets/mobile_ss.png",
    "./assets/pc_ss.png"
];

// Install the service worker and cache necessary assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event for network-first and cache-first strategies
self.addEventListener("fetch", (event) => {
    // Cache the essential files (index.html, JS, etc.) with cache-first strategy
    if (event.request.url.includes("index.html") || event.request.url.includes("main.js")) {
        event.respondWith(
            caches.match(event.request).then((response) => {
                return response || fetch(event.request).then((fetchResponse) => {
                    return caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, fetchResponse.clone());
                        return fetchResponse;
                    });
                });
            })
        );
    }
    // For images and assets, use a network-first strategy
    else if (event.request.url.includes("/assets/")) {
        event.respondWith(
            fetch(event.request).then((response) => {
                return caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, response.clone());
                    return response;
                });
            }).catch(() => {
                // Fallback to cache if offline
                return caches.match(event.request);
            })
        );
    }
});

// Activate the service worker and clean up old caches
self.addEventListener("activate", (event) => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) =>
            Promise.all(
                cacheNames.map((cacheName) => {
                    if (!cacheWhitelist.includes(cacheName)) {
                        return caches.delete(cacheName);
                    }
                })
            )
        )
    );
});
