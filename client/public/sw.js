// Commute Therapist service worker
// Caches the app shell so it loads offline after first visit

const CACHE = "ct-v2";
const SHELL = [
  "/commute-therapist/",
  "/commute-therapist/index.html",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  // Network-first for JS/CSS assets (so updates land); cache-first for the HTML shell
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;

  if (url.pathname.endsWith(".js") || url.pathname.endsWith(".css")) {
    // Network-first
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
  } else {
    // Cache-first for HTML shell
    e.respondWith(
      caches.match(e.request).then((cached) =>
        cached || fetch(e.request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
          return res;
        })
      )
    );
  }
});
