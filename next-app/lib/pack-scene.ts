import * as THREE from "three";
import { foilVertex, foilFragment, sparkVertex, sparkFragment } from "../../styles/pack-shaders.js";
import { TIER_HEX } from "./role-display";

import { tierOrder as tiers, type Tier } from "./drop-pack";
type FoilMesh = THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
type Burst = {
  points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  material: THREE.ShaderMaterial;
  started: number;
  duration: number;
};

/** One short-lived scene per visible pack. There is no global event controller. */
export function createPackScene(root: HTMLElement, onContextLost: () => void): () => void {
  const modal = root.querySelector<HTMLElement>(".pack-modal") || root;
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0, 0);
  const canvas = renderer.domElement;
  canvas.className = "pack-effects-canvas";
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.pointerEvents = "none";
  modal.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 2000);
  camera.position.z = 1000;
  const geometry = new THREE.PlaneGeometry(1, 1);
  const material = new THREE.ShaderMaterial({
    vertexShader: foilVertex, fragmentShader: foilFragment,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: {
      time: { value: 0 }, strength: { value: 1 }, opaque: { value: 0 }, fade: { value: 1 },
      touch: { value: new THREE.Vector2(0.5, 0.5) }, size: { value: new THREE.Vector2(300, 440) },
      tint: { value: new THREE.Color("#aa85e3") },
    },
  });
  const foil = new THREE.Mesh(geometry, material);
  scene.add(foil);
  const seamMaterial = material.clone();
  seamMaterial.uniforms.opaque.value = 1;
  const seam = new THREE.Mesh(geometry, seamMaterial);
  scene.add(seam);

  let width = 1, height = 1, frame = 0, until = 0, tornAt = 0;
  let burst: Burst | null = null;
  let disposed = false;
  let touchX = 0, touchY = 0;
  const events = new AbortController();
  const opts = { signal: events.signal };

  function wake(ms = 650) {
    if (disposed || document.hidden) return;
    until = Math.max(until, performance.now() + ms);
    if (!frame) frame = requestAnimationFrame(draw);
  }

  function resize() {
    const rect = modal.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    renderer.setSize(width, height, false);
    camera.left = -width / 2;
    camera.right = width / 2;
    camera.top = height / 2;
    camera.bottom = -height / 2;
    camera.updateProjectionMatrix();
    wake(900);
  }

  function position(mesh: FoilMesh, rect: DOMRect, base: DOMRect) {
    mesh.position.x = rect.left - base.left + rect.width / 2 - width / 2;
    mesh.position.y = height / 2 - (rect.top - base.top + rect.height / 2);
    mesh.scale.set(rect.width, rect.height, 1);
  }

  function draw(now: number) {
    frame = 0;
    if (disposed || document.hidden) return;
    if (!root.isConnected) { dispose(); return; }
    const base = modal.getBoundingClientRect();
    const seal = root.querySelector<HTMLElement>(".pack-seal-art");
    const tearing = tornAt > 0 && now - tornAt < 650;
    const sealed = root.dataset.sealed === "true" || tearing;
    material.uniforms.time.value = now / 1000;
    seamMaterial.uniforms.time.value = now / 1000;
    foil.visible = false;
    seam.visible = false;
    if (sealed && seal) {
      const rect = seal.getBoundingClientRect();
      position(foil, rect, base);
      foil.visible = rect.width > 0 && rect.height > 0;
      material.uniforms.opaque.value = 1;
      material.uniforms.strength.value = 1;
      material.uniforms.size.value.set(rect.width, rect.height);
      seam.visible = foil.visible;
      seam.scale.set(rect.width, 34, 1);
      seam.position.copy(foil.position);
      seam.position.y += rect.height / 2 - 17;
      seam.position.z = 2;
      seamMaterial.uniforms.size.value.set(rect.width, 34);
      const progress = tornAt > 0 ? Math.min(1, (now - tornAt) / 650) : 0;
      seam.position.x += progress * rect.width * 0.8;
      seam.position.y += progress * 120;
      seam.rotation.z = -progress * 0.8;
      foil.rotation.y = touchX * 0.12;
      foil.rotation.x = -touchY * 0.08;
      material.uniforms.fade.value = tornAt > 0 ? 1 - progress : 1;
      seamMaterial.uniforms.fade.value = material.uniforms.fade.value;
    } else {
      material.uniforms.opaque.value = 0;
      material.uniforms.fade.value = 1;
      const center = base.left + width / 2;
      const active = Array.from(root.querySelectorAll<HTMLElement>(".dropcard"))
        .map(card => ({ card, rect: card.getBoundingClientRect() }))
        .filter(({ rect }) => rect.width > 0 && rect.right > base.left && rect.left < base.right)
        .sort((a, b) => Math.abs(a.rect.left + a.rect.width / 2 - center) - Math.abs(b.rect.left + b.rect.width / 2 - center))[0];
      if (active) {
        position(foil, active.rect, base);
        foil.visible = true;
        material.uniforms.size.value.set(active.rect.width, active.rect.height);
        material.uniforms.strength.value = active.card.classList.contains("t-mythic") ? 1.5 : 0.8;
        foil.rotation.y = touchX * 0.105;
        foil.rotation.x = -touchY * 0.087;
      }
    }
    if (burst) {
      const age = (now - burst.started) / burst.duration;
      burst.material.uniforms.age.value = Math.min(1, age);
      if (age >= 1) clearBurst();
    }
    try { renderer.render(scene, camera); }
    catch { dispose(); onContextLost(); return; }
    if (now < until || burst) frame = requestAnimationFrame(draw);
  }

  function clearBurst() {
    if (!burst) return;
    scene.remove(burst.points);
    burst.points.geometry.dispose();
    burst.material.dispose();
    burst = null;
  }

  function explode(card: HTMLElement, requestedTier: unknown) {
    clearBurst();
    const tier: Tier = tiers.includes(requestedTier as Tier) ? requestedTier as Tier : "common";
    const rank = tiers.indexOf(tier);
    const count = 18 + rank * 18;
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const angle = i / count * Math.PI * 2;
      const speed = 0.4 + Math.random() * 0.8;
      positions[i * 3] = Math.cos(angle) * speed;
      positions[i * 3 + 1] = Math.sin(angle) * speed;
      seeds[i] = Math.random();
    }
    const sparkGeometry = new THREE.BufferGeometry();
    sparkGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    sparkGeometry.setAttribute("seed", new THREE.BufferAttribute(seeds, 1));
    const sparkMaterial = new THREE.ShaderMaterial({
      vertexShader: sparkVertex, fragmentShader: sparkFragment,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { age: { value: 0 }, pixelRatio: { value: renderer.getPixelRatio() }, tint: { value: new THREE.Color(TIER_HEX[tier]) } },
    });
    const points = new THREE.Points(sparkGeometry, sparkMaterial);
    const rect = card.getBoundingClientRect(), base = modal.getBoundingClientRect();
    points.position.set(rect.left - base.left + rect.width / 2 - width / 2, height / 2 - (rect.top - base.top + rect.height * 0.3), 10);
    scene.add(points);
    burst = { points, material: sparkMaterial, started: performance.now(), duration: 700 + rank * 180 };
    wake(burst.duration);
  }

  root.addEventListener("pointermove", event => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>(".dropcard, .pack-seal-art") : null;
    if (!target || !root.contains(target)) return;
    const rect = target.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    touchX = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width - 0.5) * 2));
    touchY = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height - 0.5) * 2));
    material.uniforms.touch.value.set((touchX + 1) / 2, (1 - touchY) / 2);
    wake();
  }, opts);
  const resetTouch = () => { touchX = touchY = 0; material.uniforms.touch.value.set(0.5, 0.5); wake(); };
  root.addEventListener("pointerup", resetTouch, opts);
  root.addEventListener("pointerleave", resetTouch, opts);
  root.addEventListener("pack:tear", () => { tornAt = performance.now(); wake(900); }, opts);
  root.addEventListener("pack:charge", () => wake(650), opts);
  root.addEventListener("dropcard:stage", event => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>(".dropcard") : null;
    if (target && root.contains(target)) explode(target, (event as CustomEvent<{ tier?: unknown }>).detail?.tier);
  }, opts);
  root.addEventListener("scroll", () => wake(500), { ...opts, passive: true, capture: true });
  canvas.addEventListener("webglcontextlost", event => { event.preventDefault(); dispose(); onContextLost(); }, opts);
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(modal);

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    frame = 0;
    events.abort();
    resizeObserver.disconnect();
    clearBurst();
    geometry.dispose();
    material.dispose();
    seamMaterial.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
    root.classList.remove("effects-ready");
  }

  root.classList.remove("effects-fallback");
  root.classList.add("effects-ready");
  resize();
  return dispose;
}
