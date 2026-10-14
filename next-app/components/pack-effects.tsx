"use client";

import { useEffect, type RefObject } from "react";

/** Decorative GPU effects stay outside the pack's semantic interaction tree. */
export default function PackEffects({ rootRef, reducedMotion }: { rootRef: RefObject<HTMLElement | null>; reducedMotion: boolean }) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || reducedMotion) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    let contextLost = false;
    let generation = 0;

    function stop() {
      generation++;
      cleanup?.();
      cleanup = undefined;
    }

    async function mount() {
      if (cancelled || contextLost || document.hidden || cleanup || !root?.isConnected) return;
      const epoch = ++generation;
      try {
        // Three.js and shaders enter the client bundle only when a pack opens.
        const { createPackScene } = await import("../lib/pack-scene");
        if (cancelled || epoch !== generation || document.hidden || !root.isConnected) return;
        cleanup = createPackScene(root, () => {
          contextLost = true;
          root.classList.add("effects-fallback");
          stop();
        });
      } catch {
        if (!cancelled && epoch === generation) root.classList.add("effects-fallback");
      }
    }

    function synchronize() {
      if (document.hidden) stop();
      else void mount();
    }

    document.addEventListener("visibilitychange", synchronize);
    void mount();
    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", synchronize);
      root.classList.remove("effects-fallback");
    };
  }, [rootRef, reducedMotion]);
  return null;
}
