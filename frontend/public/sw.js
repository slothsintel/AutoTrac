// Simple offline support for AutoTrac

const CACHE_NAME = "autotrac-static-v1";

// You can add must-have URLs here if you like, but we'll do
// dynamic caching so it's OK to leave this empty.
const PRECACHE_URLS = ["/"];

// Install: pre-cache the core shell (index.html)
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches when we bump CACHE_NAME
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for frontend assets, network-only for API
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Don't try to handle non-GET requests
  if (event.request.method !== "GET") {
    return;
  }

  // Always go to network for API calls (FastAPI backend on port 8000)
  if (url.port === "8000") {
    return; // let the request go through normally
  }

  // For navigation requests (HTML pages), use cache-first fallback
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Successful network response, update cache
          const respClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, respClone));
          return response;
        })
        .catch(() =>
          // offline → return cached shell if available
          caches.match(event.request).then((cached) => cached || caches.match("/"))
        )
    );
    return;
  }

  // For static assets (JS, CSS, images, etc.) use cache-first, then network
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // serve from cache
        return cachedResponse;
      }

      // otherwise fetch and cache for next time
      return fetch(event.request)
        .then((networkResponse) => {
          const respClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, respClone);
          });
          return networkResponse;
        })
        .catch(() => {
          // If both network and cache fail (first ever visit offline)
          return new Response("Offline and no cached version available.", {
            status: 503,
            headers: { "Content-Type": "text/plain" },
          });
        });
    })
  );
});
