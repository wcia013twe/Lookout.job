const CACHE = 'job-signal-v35';
const ASSETS = ['./', './index.html', './styles.css', './store.js', './components.js', './app.js', './workflow.js', './profile-onboarding.js', './profile-autofill.js', './profile-editor.js', './profile-schema.js', './styles/profile.css', './styles/applications.css', './saved-answers-model.js', './saved-answers.js', './styles/saved-answers.css', './tierlist-model.js', './tierlists.js', './styles/tierlists.css', './workflow-model.js', './workflow-motion.js', './styles/workflow.css', './styles/workflow-motion.js', './app-updates.js', './agent-connections.js', './profile-preferences.js', './resume-files.js', './leaderboard.mjs', './styles/leaderboard.css', './styles/resume-files.css', './assets/vendor/auth.bundle.js', './styles/account.css', './pack-effects.js', './pack-motion.js', './pack-haptics.js', './styles/pack-motion.js', './assets/vendor/motion-mini.js', './styles/pack-effects.css', './styles/role-cards.css', './styles/dashboard.css', './styles/pack-shaders.js', './assets/vendor/three.module.min.js', './data/logo-manifest.json', './data/jobs.json', './data/tierlist-presets.json', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' })))).then(() => self.skipWaiting())));
self.addEventListener('activate', (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  if (event.request.method !== 'GET' || requestUrl.origin !== self.location.origin || requestUrl.searchParams.has('code') || requestUrl.searchParams.has('error')) return;
  event.respondWith(fetch(event.request, { cache: 'no-cache' }).then((response) => {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request).then((cached) => cached || caches.match('./'))));
});
