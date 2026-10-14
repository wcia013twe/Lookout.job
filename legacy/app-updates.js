// Reload only at the user's request; preserve forms while an update arrives.
if ('serviceWorker' in navigator) {
  const refresh = document.querySelector('#app-refresh');
  const startedWithController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (startedWithController && refresh) refresh.hidden = false;
  });
  refresh?.addEventListener('click', () => {
    const url = new URL(location.href);
    url.searchParams.set('v', Date.now());
    location.replace(url.href);
  });
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
    .then(registration => registration.update())
    .catch(() => { /* Online use remains available if offline registration fails. */ });
}
