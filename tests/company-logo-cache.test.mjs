import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { buildManifest, imageFormat, PROJECT_URL } from '../scripts/company-logo-cache.mjs';

const png = Buffer.from([137,80,78,71,13,10,26,10,0]);
test('public logos use immutable content paths without bundled assets', async () => {
  const first = await buildManifest({ google: 'google.png' }, async () => png);
  assert.match(first.google.url, /company-logos\/google\/[a-f0-9]{16}\.png$/);
  assert.equal('local' in first.google, false);
  const changed = await buildManifest({ google: 'google.png' }, async () => Buffer.concat([png, Buffer.from([1])]));
  assert.notEqual(changed.google.url, first.google.url);
});
test('maintenance rejects invalid signatures, oversized images, traversal and arbitrary hosts', async () => {
  assert.deepEqual(imageFormat(Buffer.from([255,216,255,0])), { extension: 'jpg', contentType: 'image/jpeg' });
  await assert.rejects(buildManifest({ google: '../private.json' }, async () => png));
  await assert.rejects(buildManifest({ google: 'google.png' }, async () => Buffer.from('html')));
  await assert.rejects(buildManifest({ google: 'google.png' }, async () => Buffer.concat([png, Buffer.alloc(1048576)])));
  await assert.rejects(buildManifest({}, async () => png, 'https://example.com'));
});
function components() {
  const classes = {}, context = { window: { JB: {} }, HTMLElement: class {}, customElements: { define: (name, value) => classes[name] = value }, document: { addEventListener() {}, createElement: () => ({ setAttribute() {} }) }, Date, console };
  runInNewContext(readFileSync('legacy/components.js', 'utf8'), context);
  return { Logo: classes['logo-img'], JB: context.window.JB };
}
test('company-name lookup renders backend URLs and falls back directly to initials', () => {
  const { Logo, JB } = components();
  JB.logoManifest.google = { url: `${PROJECT_URL}/storage/v1/object/public/company-logos/google/hash.png` };
  const logo = new Logo(); logo.getAttribute = name => name === 'company' ? ' GOOGLE ' : null; logo.render();
  assert.match(logo.innerHTML, /object\/public\/company-logos\/google/);
  assert.doesNotMatch(logo.innerHTML, /data-local|assets\/logos/);
  const attrs = new Map([['data-company', 'Google']]);
  let replacement;
  const img = { getAttribute: k => attrs.get(k), replaceWith: span => { replacement = span; } };
  JB.logoFallback(img);
  assert.equal(replacement.textContent, 'G');
  assert.equal(replacement.className, 'company-logo logo-fallback');
});
test('published lookup contains backend URLs and hashes without local paths', async () => {
  const manifest = JSON.parse(await readFile('data/logo-manifest.json', 'utf8'));
  assert.ok(Object.keys(manifest).length > 0);
  for (const entry of Object.values(manifest)) {
    assert.equal('local' in entry, false);
    if(entry.source==='official') {assert.equal(entry.url,'https://robinhood.com/us/en/rh_favicon_152.png?v=2024');continue;}
    assert.ok(entry.url.startsWith(`${PROJECT_URL}/storage/v1/object/public/company-logos/`));
    assert.match(entry.sha256, /^[a-f0-9]{64}$/);
  }
});
