// Best-effort iPhone haptics: a real label activation toggles a native switch.
// Technique described by tijnjh/ios-haptics; no synthetic switch.click() workaround.
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let sequence = 0;

function mount(pack) {
  if (pack._hapticsMounted) return;
  pack._hapticsMounted = true;
  const events = new AbortController();
  const bindings = new Map();
  function attach() {
    for (const [target, input] of bindings) {
      if (!target.isConnected) { input.remove(); bindings.delete(target); }
    }
    if (!isIOS) return;
    // Never intercept posting links, scrolling in revealed details, or the drag seam.
    pack.querySelectorAll('.dropcard:not([data-revealed="true"]), .double-combo, .pack-claim').forEach(target => {
      if (bindings.has(target) || target.disabled) return;
      const input = document.createElement('input');
      input.type = 'checkbox'; input.setAttribute('switch', '');
      input.id = `pack-haptic-${++sequence}`;
      input.className = 'pack-haptic-switch'; input.tabIndex = -1;
      input.setAttribute('aria-hidden', 'true');
      const label = document.createElement('label');
      label.htmlFor = input.id; label.className = 'pack-haptic-label';
      label.setAttribute('aria-hidden', 'true');
      // Preserve the trusted native toggle; run the original action from change.
      label.addEventListener('click', e => e.stopPropagation(), { signal: events.signal });
      input.addEventListener('change', () => { if (target.isConnected) target.click(); }, { signal: events.signal });
      pack.appendChild(input); target.appendChild(label); bindings.set(target, input);
    });
  }
  if (!isIOS && typeof navigator.vibrate === 'function') {
    pack.addEventListener('dropcard:stage', e => {
      const tier = window.JB.tierIndex(e.detail.tier);
      navigator.vibrate(tier >= 3 ? [18, 30, 28] : 12);
    }, { signal: events.signal });
    pack.addEventListener('pack:tear', () => navigator.vibrate(20), { signal: events.signal });
  }
  const observer = new MutationObserver(attach);
  observer.observe(pack, { childList: true, subtree: true });
  pack.addEventListener('pack:closed', () => {
    events.abort(); observer.disconnect();
    bindings.forEach(input => input.remove()); bindings.clear();
  }, { once: true });
  attach();
}
document.addEventListener('pack:mounted', e => mount(e.target));
document.querySelectorAll('pack-opening').forEach(mount);
