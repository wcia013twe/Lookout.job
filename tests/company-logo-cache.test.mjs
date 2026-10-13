import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { buildManifest, imageFormat, PROJECT_URL } from '../scripts/company-logo-cache.mjs';

const png = Buffer.from([137,80,78,71,13,10,26,10,0]);
test('public logos use immutable content paths and preserve the bundled fallback', async () => {
  const first = await buildManifest({ google: 'assets/logos/google.png' }, async () => png);
  assert.match(first.google.url, /company-logos\/google\/[a-f0-9]{16}\.png$/);
  assert.equal(first.google.local, 'assets/logos/google.png');
  assert.deepEqual(await buildManifest(first, async () => png), first);
  const changed = await buildManifest(first, async () => Buffer.concat([png, Buffer.from([1])]));
  assert.notEqual(changed.google.url, first.google.url);
});
test('maintenance rejects invalid signatures, oversized images, traversal and arbitrary hosts', async () => {
  assert.deepEqual(imageFormat(Buffer.from([255,216,255,0])), { extension: 'jpg', contentType: 'image/jpeg' });
  await assert.rejects(buildManifest({ google: '../private.json' }, async () => png));
  await assert.rejects(buildManifest({ google: 'assets/logos/google.png' }, async () => Buffer.from('html')));
  await assert.rejects(buildManifest({ google: 'assets/logos/google.png' }, async () => Buffer.concat([png, Buffer.alloc(1048576)])));
  await assert.rejects(buildManifest({}, async () => png, 'https://example.com'));
});
function components() {
  const classes = {}, context = { window: { JB: {} }, HTMLElement: class {}, customElements: { define: (name, value) => classes[name] = value }, document: { addEventListener() {}, createElement: () => ({ setAttribute() {} }) }, Date, console };
  runInNewContext(readFileSync('components.js', 'utf8'), context);
  return { Logo: classes['logo-img'], JB: context.window.JB };
}
test('company-name lookup renders cached URLs and retries local content only once', () => {
  const { Logo, JB } = components();
  JB.logoManifest.google = { url: `${PROJECT_URL}/storage/v1/object/public/company-logos/google/hash.png`, local: 'assets/logos/google.png' };
  const logo = new Logo(); logo.getAttribute = name => name === 'company' ? ' GOOGLE ' : null; logo.render();
  assert.match(logo.innerHTML, /object\/public\/company-logos\/google/);
  assert.match(logo.innerHTML, /data-local="assets\/logos\/google.png"/);
  const attrs = new Map([['data-local', 'assets/logos/google.png'], ['data-company', 'Google']]);
  let replaced = false;
  const img = { getAttribute: k => attrs.get(k), hasAttribute: k => attrs.has(k), setAttribute: (k,v) => attrs.set(k,v), replaceWith: () => { replaced = true; } };
  JB.logoFallback(img); assert.equal(img.src, 'assets/logos/google.png'); assert.equal(replaced, false);
  JB.logoFallback(img); assert.equal(replaced, true);
});
test('every published lookup entry matches a local public asset', async () => {
  const manifest = JSON.parse(await readFile('data/logo-manifest.json', 'utf8'));
  assert.ok(Object.keys(manifest).length > 0);
  assert.deepEqual(await buildManifest(manifest, local => readFile(local)), manifest);
});
