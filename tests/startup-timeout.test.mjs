import test from 'node:test';
import assert from 'node:assert/strict';
import {withStartupTimeout} from '../next-app/lib/startup-timeout.mjs';

test('startup requests succeed normally and stalled requests fail', async () => {
  assert.equal(await withStartupTimeout(Promise.resolve('ready'), 50), 'ready');
  await assert.rejects(withStartupTimeout(new Promise(() => {}), 10), /timed out/);
  await assert.rejects(withStartupTimeout(Promise.reject(new Error('offline')), 50), /offline/);
});
