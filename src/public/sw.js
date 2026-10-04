// Network first for same-origin GETs, so a new deploy shows up on the next load.
// The cache is only the offline fallback. Cross-origin (GTM) passes straight through.
const CACHE = 'plumthedev';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
    const req = e.request;
    if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

    e.respondWith(caches.open(CACHE).then((cache) =>
        // no-cache: revalidate with the server instead of trusting the 10 min HTTP cache of GitHub Pages
        fetch(req, { cache: 'no-cache' })
            .then((res) => {
                if (res.ok) cache.put(req, res.clone());
                return res;
            })
            .catch(() => cache.match(req).then((hit) => hit ?? Response.error()))
    ));
});
