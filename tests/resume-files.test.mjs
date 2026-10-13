import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../resume-files.js', import.meta.url), 'utf8');
const { validateResume, sha256, assertOwner, uploadResume, resumeDownloadUrl, MAX_RESUME_BYTES } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const owner = '11111111-1111-4111-8111-111111111111';
const file = { name: 'resume.pdf', type: 'application/pdf', size: 3, arrayBuffer: async () => new TextEncoder().encode('abc').buffer };

test('resume validation allows only supported nonempty files within private bucket limit', () => {
  assert.equal(validateResume(file, 'Master').contentType, 'application/pdf');
  assert.equal(validateResume({ ...file, name: 'resume.docx', type: '' }, 'Backend').extension, 'docx');
  for (const invalid of [{ ...file, size: 0 }, { ...file, size: MAX_RESUME_BYTES + 1 }, { ...file, name: 'resume.exe' }, { ...file, type: 'text/plain' }]) assert.throws(() => validateResume(invalid, 'Master'));
  assert.throws(() => validateResume(file, 'Unknown'));
});

test('file fingerprint hashes exact bytes', async () => {
  assert.equal(await sha256(file), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

function mockClient({ insertError = null, afterUpload = () => {}, afterInsert = () => {} } = {}) {
  const log = [];
  let payload;
  const bucket = {
    upload: async (path, _file, options) => { log.push(['upload', path, options]); afterUpload(); return { error: null }; },
    remove: async paths => { log.push(['remove', paths]); return { error: null }; },
    createSignedUrl: async (path, expires) => { log.push(['signed', path, expires]); return { data: { signedUrl: 'https://example.test/private' }, error: null }; }
  };
  return { log, storage: { from: name => { assert.equal(name, 'resumes'); return bucket; } }, from: name => {
    assert.equal(name, 'resumes');
    return { insert: row => { payload = row; log.push(['insert', row]); return { select: () => ({ single: async () => { afterInsert(); return { data: payload, error: insertError }; } }) }; } };
  } };
}

test('upload metadata and object use the same owner and fingerprint; metadata failure cleans object', async () => {
  const client = mockClient();
  const row = await uploadResume({ client, getOwner: () => owner, file, variant: 'Backend', version: 2 });
  assert.equal(row.user_id, owner);
  assert.equal(row.version, 2);
  assert.equal(row.object_path, `${owner}/${row.id}.pdf`);
  assert.equal(row.content_hash, await sha256(file));
  assert.equal(client.log[0][2].upsert, false);
  const failed = mockClient({ insertError: { message: 'insert failed' } });
  await assert.rejects(uploadResume({ client: failed, getOwner: () => owner, file, variant: 'Master' }), /details could not save/);
  assert.equal(failed.log.at(-1)[0], 'remove');
});

test('account switching cannot adopt a file into another local account', async () => {
  assert.throws(() => assertOwner(owner, null), /Account changed/);
  let current = owner;
  const client = mockClient({ afterUpload: () => { current = 'another-user'; } });
  await assert.rejects(uploadResume({ client, getOwner: () => current, file, variant: 'Master' }), /Account changed/);
  assert.equal(client.log.some(entry => entry[0] === 'insert'), false);
  current = owner;
  const saved = mockClient({ afterInsert: () => { current = null; } });
  await assert.rejects(uploadResume({ client: saved, getOwner: () => current, file, variant: 'Master' }), /Account changed/);
  assert.equal(saved.log.some(entry => entry[0] === 'remove'), false, 'valid old-account record stays intact');
});

test('download refuses foreign paths and generates only short lived private URLs', async () => {
  const client = mockClient();
  await assert.rejects(resumeDownloadUrl({ client, getOwner: () => owner, resume: { objectPath: 'another-user/file.pdf' } }), /another account/);
  assert.equal(client.log.length, 0);
  const url = await resumeDownloadUrl({ client, getOwner: () => owner, resume: { objectPath: `${owner}/file.pdf` } });
  assert.equal(url, 'https://example.test/private');
  assert.equal(client.log[0][2], 60);
});
