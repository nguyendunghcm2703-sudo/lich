/* Service worker Lịch Việt
 * - Giao diện (HTML/CSS/JS): stale-while-revalidate, chạy offline
 * - holidays.json: ưu tiên mạng (hết 4 giây thì dùng bản đã lưu)
 * - Bản mới tải xong sẽ CHỜ, đến khi người dùng bấm "Cập nhật" trong app mới được kích hoạt
 * __BUILD__ và danh sách ASSETS do build.js điền khi deploy. */
const VERSION = 'lich-viet-__BUILD__';
const ASSETS = /*__ASSETS__*/ [
  './', 'index.html', 'style.css', 'lunar.js', 'app.js', 'manifest.json', 'holidays.json',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  try {
    const res = await Promise.race([
      fetch(req, { cache: 'no-store' }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000))
    ]);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req);
    if (hit) return hit;
    throw err;
  }
}

async function staleWhileRevalidate(req, key) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(key || req);
  const net = fetch(req)
    .then((res) => { if (res && res.ok) cache.put(key || req, res.clone()); return res; })
    .catch(() => null);
  if (hit) return hit;
  return (await net) || Response.error();
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.endsWith('/holidays.json') || url.pathname.endsWith('/songs.json')) {
    e.respondWith(networkFirst(req));
  } else if (req.mode === 'navigate') {
    e.respondWith(staleWhileRevalidate(req, new Request(new URL('index.html', self.registration.scope).href)));
  } else {
    e.respondWith(staleWhileRevalidate(req));
  }
});
