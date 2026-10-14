// One lazy WebGL scene per open pack. No React runtime, no external asset requests.
import { foilVertex, foilFragment, sparkVertex, sparkFragment } from '../lib/pack-shaders.js';

const motion = matchMedia('(prefers-reduced-motion: reduce)');
let threePromise;
const loadThree = () => threePromise ||= import('./assets/vendor/three.module.min.js');

async function mount(pack) {
  if (pack._effectsMounted || motion.matches) return;
  pack._effectsMounted = true;
  try {
    const THREE = await loadThree();
    if (!pack.isConnected || motion.matches) return;
    createScene(pack, THREE);
  } catch {
    // The semantic DOM pack remains fully usable without WebGL.
    pack.classList.add('effects-fallback');
  }
}

function createScene(pack, T) {
  const modal = pack.querySelector('.pack-modal');
  const renderer = new T.WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0, 0);
  const canvas = renderer.domElement;
  canvas.className = 'pack-effects-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  modal.appendChild(canvas);
  const scene = new T.Scene();
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, .1, 2000);
  camera.position.z = 1000;
  const geometry = new T.PlaneGeometry(1, 1);
  const material = new T.ShaderMaterial({
    vertexShader: foilVertex, fragmentShader: foilFragment,
    transparent: true, depthWrite: false, side: T.DoubleSide,
    uniforms: {
      time: { value: 0 }, strength: { value: 1 }, opaque: { value: 0 }, fade: { value: 1 },
      touch: { value: new T.Vector2(.5, .5) }, size: { value: new T.Vector2(300, 440) },
      tint: { value: new T.Color('#aa85e3') },
    },
  });
  const foil = new T.Mesh(geometry, material);
  scene.add(foil);
  const seamMaterial = material.clone();
  seamMaterial.uniforms.opaque.value = 1;
  const seam = new T.Mesh(geometry, seamMaterial);
  scene.add(seam);
  let width = 1, height = 1, frame = 0, until = 0, tornAt = 0, burst = null, disposed = false;
  let active = null, touchX = 0, touchY = 0;
  const events = new AbortController();
  const opts = { signal: events.signal };

  function resize() {
    const r = modal.getBoundingClientRect();
    width = r.width; height = r.height;
    renderer.setSize(width, height, false);
    camera.left = -width / 2; camera.right = width / 2;
    camera.top = height / 2; camera.bottom = -height / 2;
    camera.updateProjectionMatrix();
    wake(900);
  }

  function wake(ms = 650) {
    if (disposed || document.hidden || motion.matches) return;
    until = Math.max(until, performance.now() + ms);
    if (!frame) frame = requestAnimationFrame(draw);
  }

  function position(mesh, rect, base) {
    mesh.position.x = rect.left - base.left + rect.width / 2 - width / 2;
    mesh.position.y = height / 2 - (rect.top - base.top + rect.height / 2);
    mesh.scale.set(rect.width, rect.height, 1);
  }

  function draw(now) {
    frame = 0;
    if (disposed || !pack.isConnected || document.hidden || motion.matches) return;
    const base = modal.getBoundingClientRect();
    const seal = pack.querySelector('.pack-seal-art');
    const sealed = !pack._sealOpen || (tornAt && now - tornAt < 650);
    material.uniforms.time.value = now / 1000;
    seamMaterial.uniforms.time.value = now / 1000;
    foil.visible = false; seam.visible = false;
    if (sealed && seal) {
      const r = seal.getBoundingClientRect();
      position(foil, r, base);
      foil.visible = true;
      material.uniforms.opaque.value = 1;
      material.uniforms.size.value.set(r.width, r.height);
      seam.visible = true;
      seam.scale.set(r.width, 34, 1);
      seam.position.copy(foil.position);
      seam.position.y += r.height / 2 - 17;
      seam.position.z = 2;
      seamMaterial.uniforms.size.value.set(r.width, 34);
      const progress = tornAt ? Math.min(1, (now - tornAt) / 650) : pack._tearProgress || 0;
      seam.position.x += progress * r.width * .8;
      seam.position.y += progress * 120;
      seam.rotation.z = -progress * .8;
      foil.rotation.y = touchX * .12;
      foil.rotation.x = -touchY * .08;
      material.uniforms.fade.value = tornAt ? 1 - progress : 1;
      seamMaterial.uniforms.fade.value = tornAt ? 1 - progress : 1;
    } else {
      material.uniforms.opaque.value = 0;
      material.uniforms.fade.value = 1;
      const cards = [...pack.querySelectorAll('.dropcard')];
      active = cards.filter(c => { const r = c.getBoundingClientRect(); return r.right > base.left && r.left < base.right; })
        .sort((a,b) => Math.abs(a.getBoundingClientRect().left + a.offsetWidth / 2 - (base.left + width / 2)) - Math.abs(b.getBoundingClientRect().left + b.offsetWidth / 2 - (base.left + width / 2)))[0];
      if (active) {
        const r = active.getBoundingClientRect();
        position(foil, r, base);
        foil.visible = true;
        material.uniforms.size.value.set(r.width, r.height);
        material.uniforms.strength.value = active.classList.contains('t-mythic') ? 1.5 : .8;
        foil.rotation.y = touchX * .105;
        foil.rotation.x = -touchY * .087;
      }
    }
    if (burst) {
      const age = (now - burst.started) / burst.duration;
      burst.material.uniforms.age.value = Math.min(1, age);
      if (age >= 1) clearBurst();
    }
    renderer.render(scene, camera);
    if (now < until || burst) frame = requestAnimationFrame(draw);
  }

  function clearBurst() {
    if (!burst) return;
    scene.remove(burst.points);
    burst.points.geometry.dispose(); burst.material.dispose(); burst = null;
  }

  function explode(card, tier) {
    clearBurst();
    const rank = Math.max(0, window.JB.tierIndex(tier));
    const count = 18 + rank * 18;
    const positions = new Float32Array(count * 3), seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const angle = i / count * Math.PI * 2;
      const speed = .4 + Math.random() * .8;
      positions[i*3] = Math.cos(angle) * speed;
      positions[i*3+1] = Math.sin(angle) * speed;
      seeds[i] = Math.random();
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(positions, 3));
    g.setAttribute('seed', new T.BufferAttribute(seeds, 1));
    const m = new T.ShaderMaterial({
      vertexShader: sparkVertex, fragmentShader: sparkFragment, transparent: true,
      depthWrite: false, blending: T.AdditiveBlending,
      uniforms: { age: { value: 0 }, pixelRatio: { value: renderer.getPixelRatio() }, tint: { value: new T.Color(window.JB.TIER_HEX[tier] || '#aa85e3') } },
    });
    const points = new T.Points(g, m);
    const r = card.getBoundingClientRect(), b = modal.getBoundingClientRect();
    points.position.set(r.left-b.left+r.width/2-width/2, height/2-(r.top-b.top+r.height*.3), 10);
    scene.add(points);
    burst = { points, material: m, started: performance.now(), duration: 700 + rank * 180 };
    wake(burst.duration);
  }

  pack.addEventListener('pointermove', e => {
    const target = e.target.closest('.dropcard, .pack-seal-art');
    if (!target) return;
    const r = target.getBoundingClientRect();
    touchX = Math.max(-1, Math.min(1, ((e.clientX-r.left)/r.width-.5)*2));
    touchY = Math.max(-1, Math.min(1, ((e.clientY-r.top)/r.height-.5)*2));
    material.uniforms.touch.value.set((touchX+1)/2, (1-touchY)/2);
    wake();
  }, opts);
  pack.addEventListener('pointerup', () => { touchX = touchY = 0; wake(); }, opts);
  pack.addEventListener('pointerleave', () => { touchX = touchY = 0; wake(); }, opts);
  pack.addEventListener('pack:tear', () => { tornAt = performance.now(); wake(900); }, opts);
  pack.addEventListener('pack:charge', () => wake(650), opts);
  pack.addEventListener('dropcard:stage', e => { explode(e.target, e.detail.tier); }, opts);
  pack.querySelector('.pack-row').addEventListener('scroll', () => wake(500), { ...opts, passive: true });
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); dispose(); }, opts);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
    else wake();
  }, opts);
  motion.addEventListener('change', () => { if (motion.matches) dispose(); }, opts);
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(modal);
  const removalObserver = new MutationObserver(() => { if (!pack.isConnected) dispose(); });
  removalObserver.observe(document.body, { childList: true });
  function dispose() {
    if (disposed) return;
    disposed = true; cancelAnimationFrame(frame);
    events.abort(); resizeObserver.disconnect(); removalObserver.disconnect();
    clearBurst(); geometry.dispose(); material.dispose(); seamMaterial.dispose();
    renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
    pack.classList.remove('effects-ready');
  }
  pack.classList.add('effects-ready');
  resize();
}

document.addEventListener('pack:mounted', e => mount(e.target));
document.querySelectorAll('pack-opening').forEach(mount);
