// ============================================
// SERVICE WORKER — Leaked Archives PWA
// ============================================

const CACHE_NAME = "leaked-archives-v2";

// Core files to cache immediately for offline shell
const CORE_ASSETS = [
  "/index.html",
  "/css/style.css",
  "/js/firebase.js",
  "/js/main.js",
  "/manifest.json"
];

// ---- INSTALL ----
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS).catch(() => {
        // If any asset fails, don't block install
      });
    })
  );
  self.skipWaiting();
});

// ---- ACTIVATE — clean old caches ----
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

// ---- FETCH — network first, fallback to cache ----
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never cache Firebase, R2 videos, or ad scripts — always go to network
  if (
    url.hostname.includes("firestore") ||
    url.hostname.includes("firebaseapp") ||
    url.hostname.includes("googleapis") ||
    url.hostname.includes("r2.dev") ||
    url.hostname.includes("n6wxm") ||
    url.hostname.includes("al5sm") ||
    url.hostname.includes("pemsrv") ||
    url.hostname.includes("magsrv") ||
    event.request.method !== "GET"
  ) {
    return; // let browser handle it normally
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache a copy of successful same-origin responses
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Offline — try cache
        return caches.match(event.request).then((cached) => {
          return cached || caches.match("/index.html");
        });
      })
  );
});