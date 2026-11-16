/* Olimpiada arxivi — service worker
   Məqsəd: app shell offline işləsin, PDF-lər və CDN kitabxanaları keşlənsin.
   GitHub Pages alt qovluqda da işləməsi üçün bütün yollar relative-dir. */

const VERSION = 'v1.0.0';
const SHELL = `shell-${VERSION}`;
const RUNTIME = `runtime-${VERSION}`;
const PDFS = `pdfs-${VERSION}`;

/* App shell — quraşdırma zamanı mütləq keşlənir */
const SHELL_FILES = [
  './',
  './index.html',
  './data.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './icons/favicon.ico'
];

/* Offline-da ən azı bunlar görünməlidir; biri tapılmasa quraşdırma dayanmasın */
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    await Promise.all(SHELL_FILES.map(async (url) => {
      try {
        const res = await fetch(new Request(url, { cache: 'reload' }));
        if (res.ok) await cache.put(url, res);
      } catch (_) { /* bir fayl yoxdursa qalanları davam etsin */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keep = new Set([SHELL, RUNTIME, PDFS]);
    const names = await caches.keys();
    await Promise.all(names.filter((n) => !keep.has(n)).map((n) => caches.delete(n)));
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.disable(); } catch (_) {}
    }
    await self.clients.claim();
  })());
});

/* PDF keşinə limit — 60 fayl / ~120 MB */
const PDF_MAX_ITEMS = 60;
const PDF_MAX_BYTES = 120 * 1024 * 1024;

async function trimPdfCache() {
  const cache = await caches.open(PDFS);
  const keys = await cache.keys();
  if (keys.length <= PDF_MAX_ITEMS) return;
  for (const req of keys.slice(0, keys.length - PDF_MAX_ITEMS)) {
    await cache.delete(req);
  }
}

const isPdf = (url) => /\.pdf($|\?)/i.test(url.pathname);
const isCdn = (url) => /(^|\.)(cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net)$/.test(url.hostname);

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  /* 1) Səhifə naviqasiyası — şəbəkə, alınmasa keşdən index.html */
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(SHELL);
        cache.put('./index.html', fresh.clone()).catch(() => {});
        return fresh;
      } catch (_) {
        const cache = await caches.open(SHELL);
        return (await cache.match('./index.html')) ||
               (await cache.match('./')) ||
               new Response('<h1>Oflayn</h1><p>İnternet bağlantısı yoxdur.</p>',
                 { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 });
      }
    })());
    return;
  }

  /* 2) PDF — əvvəl keş, sonra şəbəkə (offline oxuma üçün) */
  if (isPdf(url)) {
    e.respondWith((async () => {
      const cache = await caches.open(PDFS);
      const hit = await cache.match(req, { ignoreVary: true });
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok && res.status === 200) {
          const len = Number(res.headers.get('content-length') || 0);
          if (!len || len < PDF_MAX_BYTES) {
            cache.put(req, res.clone()).then(trimPdfCache).catch(() => {});
          }
        }
        return res;
      } catch (_) {
        return new Response('PDF oflayn əlçatan deyil. İnternetə qoşulub bir dəfə aç.', {
          status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }
    })());
    return;
  }

  /* 3) CDN (PDF.js, KaTeX, şriftlər) — stale-while-revalidate */
  if (isCdn(url)) {
    e.respondWith((async () => {
      const cache = await caches.open(RUNTIME);
      const hit = await cache.match(req);
      const net = fetch(req).then((res) => {
        if (res.ok) cache.put(req, res.clone()).catch(() => {});
        return res;
      }).catch(() => null);
      return hit || (await net) || new Response('', { status: 504 });
    })());
    return;
  }

  /* 4) Öz resurslarımız (data.js, questions.json, ikonlar) — network-first, keş fallback */
  if (url.origin === self.location.origin) {
    e.respondWith((async () => {
      const cache = await caches.open(RUNTIME);
      try {
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone()).catch(() => {});
        return res;
      } catch (_) {
        const hit = await cache.match(req, { ignoreVary: true });
        if (hit) return hit;
        const shell = await caches.open(SHELL);
        return (await shell.match(req)) || new Response('', { status: 504 });
      }
    })());
  }
});

/* Admin paneldən "yenilə" düyməsi üçün */
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
  if (e.data === 'CLEAR_PDF_CACHE') {
    e.waitUntil(caches.delete(PDFS).then(() => caches.open(PDFS)));
  }
});
