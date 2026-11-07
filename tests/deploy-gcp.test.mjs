import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRuntimeEnv, sourcePaths} from '../scripts/deploy-gcp.mjs';

const valid = `SUPABASE_URL=https://osyrlausutnqzlegxmnd.supabase.co
SUPABASE_SERVICE_ROLE_KEY=server-only-test-key
LOOKOUT_API_HOST=api.lookout.test
LOOKOUT_ALLOWED_HOSTS=api.lookout.test,localhost,127.0.0.1
LOOKOUT_ALLOWED_ORIGINS=https://wcia013twe.github.io
LOOKOUT_EXECUTION_ENABLED=false
LOOKOUT_SUBMISSION_ENABLED=false
`;

test('cloud deploy accepts explicit hosted settings without exposing credentials', () => {
  assert.deepEqual(validateRuntimeEnv(valid), {host: 'api.lookout.test'});
  assert.deepEqual(validateRuntimeEnv(valid.replace('LOOKOUT_EXECUTION_ENABLED=false', 'LOOKOUT_EXECUTION_ENABLED=true')), {host: 'api.lookout.test'});
});

test('cloud deploy rejects local databases, unsafe hosts and mismatched health hosts', () => {
  for (const env of [
    valid.replace('https://osyrlausutnqzlegxmnd.supabase.co', 'http://127.0.0.1:54321'),
    valid.replace('LOOKOUT_API_HOST=api.lookout.test', 'LOOKOUT_API_HOST=api.example.com'),
    valid.replace('LOOKOUT_API_HOST=api.lookout.test', 'LOOKOUT_API_HOST=api.lookout.test;touch /tmp/x'),
    valid.replace(',127.0.0.1', ''),
    valid.replace('https://wcia013twe.github.io', 'https://wcia013twe.github.io/app/'),
  ]) assert.throws(() => validateRuntimeEnv(env));
});

test('cloud deploy requires credentials, explicit execution flag and disabled submissions', () => {
  for (const env of [
    valid.replace('server-only-test-key', ''),
    valid.replace('LOOKOUT_EXECUTION_ENABLED=false', ''),
    valid.replace('LOOKOUT_SUBMISSION_ENABLED=false', 'LOOKOUT_SUBMISSION_ENABLED=true'),
    valid + 'SUPABASE_SERVICE_ROLE_KEY=second-key\n',
  ]) assert.throws(() => validateRuntimeEnv(env));
});

test('source packaging allowlist excludes broad repo and local deployment state', () => {
  for (const path of ['.', 'infra', 'infra/gcp', '.env.gcp.local', 'data', 'google-cloud-sdk', 'next-app']) assert.ok(!sourcePaths.includes(path));
  assert.ok(sourcePaths.includes('backend/runtime'));
});
