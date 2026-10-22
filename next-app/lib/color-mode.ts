export const COLOR_MODE_KEY = "lookout.color-mode";
export type ColorMode = "system" | "light" | "dark";
export function parseColorMode(value: unknown): ColorMode {
  return value === "light" || value === "dark" ? value : "system";
}
export function resolveColorMode(mode: ColorMode, systemDark: boolean): "light" | "dark" {
  return mode === "system" ? systemDark ? "dark" : "light" : mode;
}
// Run before the first paint in the static export. Storage may be unavailable.
export const colorModeScript = `(()=>{let mode='system';try{const saved=localStorage.getItem('${COLOR_MODE_KEY}');if(saved==='light'||saved==='dark')mode=saved;}catch{}const root=document.documentElement;root.dataset.colorMode=mode;root.dataset.theme=mode==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):mode;})();`;
