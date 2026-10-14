import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../out/", import.meta.url));
async function files(dir = "") {
  const result = [];
  for (const entry of await readdir(root + dir, { withFileTypes: true })) {
    const path = dir + entry.name;
    if (entry.isDirectory()) result.push(...(await files(path + "/")));
    else if (path !== "sw.js" && !path.startsWith(".")) result.push(path);
  }
  return result;
}
const paths = await files();
const digest = createHash("sha256");
for (const path of paths) digest.update(await readFile(root + path));
const cache = "job-signal-react-" + digest.digest("hex").slice(0, 12);
const worker = `const CACHE=${JSON.stringify(cache)};const ASSETS=${JSON.stringify(paths.map((p) => "./" + p))};self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('job-signal-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||url.searchParams.has('code')||url.searchParams.has('error'))return;event.respondWith(fetch(event.request).then(response=>response).catch(async()=>{const cache=await caches.open(CACHE);let saved=await cache.match(event.request,{ignoreSearch:true});if(!saved&&event.request.mode==='navigate')saved=await cache.match(new Request(new URL('./index.html',event.request.url)));return saved||Response.error();}));});`;
await writeFile(root + "sw.js", worker);
console.log(
  `Prepared static export and ${paths.length} public offline assets.`,
);
