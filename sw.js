const CACHE = 'job-signal-v18';
const ASSETS = ['./', './index.html', './styles.css', './store.js', './components.js', './app.js', './workflow.js', './workflow-model.js', './workflow-motion.js', './styles/workflow.css', './styles/workflow-motion.js', './app-updates.js', './pack-effects.js', './pack-motion.js', './pack-haptics.js', './styles/pack-motion.js', './assets/vendor/motion-mini.js', './styles/pack-effects.css', './styles/role-cards.css', './styles/dashboard.css', './styles/pack-shaders.js', './assets/vendor/three.module.min.js', './data/jobs.json', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' })))).then(() => self.skipWaiting())));
self.addEventListener('activate', (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request, { cache: 'no-cache' }).then((response) => {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request).then((cached) => cached || caches.match('./'))));
});
