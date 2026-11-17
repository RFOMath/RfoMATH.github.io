/* Service worker: tətbiqin özəyi oflayn açılır, məzmun isə həmişə yenisi yoxlanılır. */
const VERSION = "v1";
const CORE = "rfo-core-" + VERSION;
const RUN = "rfo-run-" + VERSION;
const MAX_RUN = 150;

const SHELL = [
  "./",
  "index.html",
  "data.js",
  "data/questions.json",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/favicon.svg"
];

const CDN_HOSTS = [
  "cdnjs.cloudflare.com",
  "fonts.googleapis.com",
  "fonts.gstatic.com"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CORE)
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(new Request(u, { cache: "reload" })))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((k) => k.startsWith("rfo-") && k !== CORE && k !== RUN)
        .map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Sorğu parametrləri keşi şişirməsin deyə açar kimi yalnız ünvan yolu istifadə olunur */
const keyOf = (url) => new Request(url.origin + url.pathname);

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_RUN; i++) await cache.delete(keys[i]);
}

async function networkFirst(e, req, url) {
  const cache = await caches.open(RUN);
  const key = keyOf(url);
  const cached = (await caches.match(key)) || (req.mode === "navigate" ? await caches.match("index.html") : undefined);

  const net = fetch(req).then((res) => {
    if (res && res.ok) {
      cache.put(key, res.clone()).then(() => trim(cache)).catch(() => {});
    }
    return res;
  });
  e.waitUntil(net.catch(() => {}));

  if (!cached) return net;
  /* Şəbəkə yavaşdırsa 4 saniyədən sonra keşdəki nüsxə göstərilir */
  return Promise.race([
    net.catch(() => cached),
    new Promise((resolve) => setTimeout(() => resolve(cached), 4000))
  ]);
}

async function staleWhileRevalidate(e, req, key) {
  const cache = await caches.open(RUN);
  const hit = await cache.match(key);
  const net = fetch(req)
    .then((res) => {
      if (res && (res.ok || res.type === "opaque")) {
        cache.put(key, res.clone()).then(() => trim(cache)).catch(() => {});
      }
      return res;
    })
    .catch(() => null);
  e.waitUntil(net);
  return hit || (await net) || Response.error();
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    /* Admin paneli, PDF-lər və doğrulama faylları birbaşa şəbəkədən gəlir */
    if (/\/admin\.html$/i.test(url.pathname)) return;
    if (url.pathname.includes("/.well-known/")) return;
    if (/\.pdf$/i.test(url.pathname)) return;

    if (/\.(png|jpe?g|webp|gif|svg|ico)$/i.test(url.pathname)) {
      e.respondWith(staleWhileRevalidate(e, req, new Request(req.url)));
      return;
    }
    e.respondWith(networkFirst(e, req, url));
    return;
  }

  if (CDN_HOSTS.includes(url.hostname)) {
    e.respondWith(staleWhileRevalidate(e, req, new Request(req.url)));
  }
});
