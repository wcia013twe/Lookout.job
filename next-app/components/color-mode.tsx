"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useWorkspace } from "../lib/workspace";
import { COLOR_MODE_KEY, parseColorMode, resolveColorMode, type ColorMode } from "../lib/color-mode";

export default function ColorModeControl({ compact = false }: { compact?: boolean }) {
  const { demo } = useWorkspace();
  const [mode, setMode] = useState<ColorMode>("system");
  const [expanded, setExpanded] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const root = document.documentElement;
    function apply(value: ColorMode) {
      setMode(value);
      root.dataset.colorMode = value;
      root.dataset.theme = resolveColorMode(value, media.matches);
    }
    let saved = root.dataset.colorMode;
    if (!demo) { try { saved = localStorage.getItem(COLOR_MODE_KEY) || "system"; } catch {} }
    apply(parseColorMode(saved));
    setReady(true);
    const systemChanged = () => {
      if (root.dataset.colorMode === "system") apply("system");
    };
    const storageChanged = (event: StorageEvent) => {
      if (!demo && (event.key === COLOR_MODE_KEY || event.key === null)) apply(parseColorMode(event.newValue));
    };
    media.addEventListener("change", systemChanged);
    const tabChanged = () => apply(parseColorMode(root.dataset.colorMode));
    window.addEventListener("lookout:color-mode", tabChanged);
    window.addEventListener("storage", storageChanged);
    return () => {
      media.removeEventListener("change", systemChanged);
      window.removeEventListener("storage", storageChanged);
      window.removeEventListener("lookout:color-mode", tabChanged);
    };
  }, [demo]);
  function change(value: string) {
    const next = parseColorMode(value);
    setMode(next);
    document.documentElement.dataset.colorMode = next;
    document.documentElement.dataset.theme = resolveColorMode(next, window.matchMedia("(prefers-color-scheme: dark)").matches);
    window.dispatchEvent(new Event("lookout:color-mode"));
    try {
      if (demo) return;
      if (next === "system") localStorage.removeItem(COLOR_MODE_KEY);
      else localStorage.setItem(COLOR_MODE_KEY, next);
    } catch { /* Keep this tab usable when browser storage is disabled. */ }
  }
  const choices = [
    { id: "system", label: "System", description: "Follow your device." },
    { id: "light", label: "Light", description: "A light color palette." },
    { id: "dark", label: "Dark", description: "A dark color palette." },
  ] as const;
  return <details className={`color-mode-control relative ${compact ? "w-full" : ""}`} open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}>
    <summary className="flex min-h-11 items-center justify-between gap-3 rounded-lg px-3 text-sm font-medium hover:bg-board-tag">
      <span>Theme</span><span className="text-board-muted">{choices.find(choice => choice.id === mode)?.label}</span>
    </summary>
    <fieldset className={`rounded-xl bg-board-panel p-3 ${compact ? "" : "absolute right-0 top-full z-50 mt-2 w-72 shadow-xl"}`}>
      <legend className="sr-only">Choose a theme</legend>
      <div className="grid grid-cols-3 gap-2">
        {choices.map(choice => <label key={choice.id} className="relative cursor-pointer rounded-lg border border-board-line p-2 has-checked:border-board-accent has-checked:bg-board-tag focus-within:outline-2 focus-within:outline-board-accent">
          <input className="sr-only" type="radio" name={compact ? "profile-theme" : "header-theme"} value={choice.id} checked={mode === choice.id} disabled={!ready} onChange={() => change(choice.id)} />
          <span aria-hidden="true" className={`theme-preview theme-preview-${choice.id}`}><span /><span /><span /></span>
          <span className="mt-2 flex items-center justify-between text-sm font-semibold">{choice.label}<span aria-hidden="true">{mode === choice.id && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m5 12 4 4L19 6" /></svg>}</span></span>
          <span className="mt-1 block text-xs leading-4 text-board-muted">{choice.description}</span>
        </label>)}
      </div>
      <Link href="/themes/" onClick={() => setExpanded(false)} className="mt-3 flex min-h-11 items-center justify-between rounded-lg px-2 text-sm font-semibold text-board-accent hover:bg-board-tag">Browse theme marketplace <span aria-hidden="true">→</span></Link>
    </fieldset>
  </details>;
}
