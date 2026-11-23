/* Service worker CTRL + Coffee: hanya menyimpan berkas statis (ikon, aset build).
   Data transaksi, sesi, dan respons /_agent-native TIDAK pernah disimpan agar tidak ada data usang atau bocor antar pengguna. */
const CACHE = "ctrl-coffee-static-v3";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll([OFFLINE_URL, "/icon-192.png", "/icon-512.png"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
    return;
  }
  const isStatic = url.pathname.startsWith("/assets/") || /\.(?:png|svg|ico|woff2?)$/.test(url.pathname);
  if (!isStatic) return;
  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    })),
  );
});
