import { animate } from './assets/vendor/motion-mini.js';
import { tearTop, tearBottom, tearTiming } from './styles/pack-motion.js';

const animations = new WeakMap();
const ready = pack => pack.classList.add('motion-ready');
document.addEventListener('pack:mounted', e => ready(e.target));
document.querySelectorAll('pack-opening').forEach(ready);
document.addEventListener('pack:tear', e => {
  const pack = e.target;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const top = pack.querySelector('.seal-shard-top');
  const bottom = pack.querySelector('.seal-shard-bottom');
  if (!top || !bottom) return;
  try {
    animations.set(pack, [animate(top, tearTop, tearTiming), animate(bottom, tearBottom, tearTiming)]);
  } catch {
    pack.classList.remove('motion-ready'); // CSS tear is the fallback.
  }
});
document.addEventListener('pack:closed', e => {
  animations.get(e.target)?.forEach(animation => animation.stop());
  animations.delete(e.target);
});
