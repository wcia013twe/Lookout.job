"use client";
import { useEffect, useState } from "react";
import { COLOR_MODE_KEY, parseColorMode, resolveColorMode, type ColorMode } from "../lib/color-mode";

export default function ColorModeControl() {
  const [mode, setMode] = useState<ColorMode>("system");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const root = document.documentElement;
    function apply(value: ColorMode) {
      setMode(value);
      root.dataset.colorMode = value;
      root.dataset.theme = resolveColorMode(value, media.matches);
    }
    apply(parseColorMode(root.dataset.colorMode));
    setReady(true);
    const systemChanged = () => {
      if (root.dataset.colorMode === "system") apply("system");
    };
    const storageChanged = (event: StorageEvent) => {
      if (event.key === COLOR_MODE_KEY || event.key === null) apply(parseColorMode(event.newValue));
    };
    media.addEventListener("change", systemChanged);
    window.addEventListener("storage", storageChanged);
    return () => {
      media.removeEventListener("change", systemChanged);
      window.removeEventListener("storage", storageChanged);
    };
  }, []);
  function change(value: string) {
    const next = parseColorMode(value);
    setMode(next);
    document.documentElement.dataset.colorMode = next;
    document.documentElement.dataset.theme = resolveColorMode(next, window.matchMedia("(prefers-color-scheme: dark)").matches);
    try {
      if (next === "system") localStorage.removeItem(COLOR_MODE_KEY);
      else localStorage.setItem(COLOR_MODE_KEY, next);
    } catch { /* Keep this tab usable when browser storage is disabled. */ }
  }
  return <label className="color-mode-control inline-flex min-h-11 items-center gap-2 rounded-lg border border-board-line bg-board-tag px-3 text-sm text-board-muted">
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="8"/><path d="M12 4v16M12 4a8 8 0 0 1 0 16" fill="currentColor" stroke="none"/></svg>
    <span>Theme</span>
    <select aria-label="Color theme" className="min-h-11 min-w-0 bg-transparent pr-1 font-semibold text-board-text" value={mode} disabled={!ready} onChange={event => change(event.target.value)}>
      <option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option>
    </select>
  </label>;
}
