import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
const dest = fileURLToPath(new URL("../public/", import.meta.url));
await rm(dest, { recursive: true, force: true });
await mkdir(dest, { recursive: true });
for (const name of ["data", "icon.svg", "manifest.webmanifest"]) {
  try {
    await cp(root + name, dest + name, { recursive: true });
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
}
for (const directory of ["agents", "textures"]) {
  await cp(fileURLToPath(new URL(`../assets/${directory}/`, import.meta.url)), dest + directory, { recursive: true });
}
// Replace the old worker at the same scope and discard stale static UI caches.
await writeFile(
  dest + "sw.js",
  `self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('job-signal-')).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));`,
);
await writeFile(dest + ".nojekyll", "");
