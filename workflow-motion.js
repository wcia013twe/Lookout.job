import { animate } from './assets/vendor/motion-mini.js';
import { panelEntrance, reviewEntrance, tileEntrance, transition } from './styles/workflow-motion.js';
const motionAllowed = () => !matchMedia('(prefers-reduced-motion: reduce)').matches;
document.addEventListener('workspace:view', e => {
  const panel = document.getElementById(e.detail.panel);
  if (panel && motionAllowed()) animate(panel, panelEntrance, transition);
});
document.addEventListener('workflow:review', e => {
  if (motionAllowed()) animate(e.target, reviewEntrance, transition);
});

document.addEventListener('tierlist:moved', e => {
  if (motionAllowed()) animate(e.target, tileEntrance, transition);
});
