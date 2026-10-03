// Stale-while-revalidate for same-origin GETs: serve from cache, refresh in the background.
// Cross-origin (GTM) passes straight through.
// ponytail: cache never prunes old hashed assets; add cleanup on activate if it ever grows noticeably.
const CACHE = 'plumthedev';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
    const req = e.request;
    if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

    e.respondWith(caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const fresh = fetch(req).then((res) => {
            if (res.ok) cache.put(req, res.clone());
            return res;
        });
        if (!cached) return fresh;
        e.waitUntil(fresh.catch(() => {}));
        return cached;
    }));
});
