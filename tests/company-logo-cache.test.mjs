import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
test('published lookup contains backend or immutable repository URLs and hashes without local paths', async () => {
  const manifest = JSON.parse(await readFile('data/logo-manifest.json', 'utf8'));
  assert.ok(Object.keys(manifest).length > 0);
  for (const entry of Object.values(manifest)) {
    assert.equal('local' in entry, false);
    if(entry.source==='official') {assert.equal(entry.url,'https://robinhood.com/us/en/rh_favicon_152.png?v=2024');continue;}
    const repositoryLogo = /^https:\/\/raw\.githubusercontent\.com\/wcia013twe\/codex-automated-job-board\/[a-f0-9]{40}\/assets\/logos\/[a-z0-9-]+\.png$/.test(entry.url);
    assert.ok(entry.url.startsWith(`${PROJECT_URL}/storage/v1/object/public/company-logos/`) || repositoryLogo);
    if (repositoryLogo) {
      const file = entry.url.split('/').pop();
      const bytes = await readFile(`assets/logos/${file}`);
      assert.equal((await import('node:crypto')).createHash('sha256').update(bytes).digest('hex'), entry.sha256);
      assert.deepEqual(imageFormat(bytes), { extension: 'png', contentType: entry.contentType });
    }
    assert.match(entry.sha256, /^[a-f0-9]{64}$/);
  }
});
