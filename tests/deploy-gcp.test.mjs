import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
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

test('committed source archive covers every Docker build input', () => {
  const dockerfile=readFileSync(new URL('../backend/runtime/Dockerfile',import.meta.url),'utf8');
  const inputs=[...dockerfile.matchAll(/^COPY (.+) \S+$/gm)].flatMap(match=>match[1].split(/\s+/));
  assert.ok(inputs.length>0);
  for(const input of inputs) assert.ok(sourcePaths.some(path=>input===path||input.startsWith(path+'/')),`Missing archived Docker input: ${input}`);
});

test('OAuth deployment is opt-in and requires the dedicated approved config mount',()=>{
 assert.deepEqual(validateRuntimeEnv(valid+'LOOKOUT_OAUTH_ENABLED=false\n'),{host:'api.lookout.test'});
 assert.throws(()=>validateRuntimeEnv(valid+'LOOKOUT_OAUTH_ENABLED=true\n'),/private configuration mount/);
 assert.throws(()=>validateRuntimeEnv(valid+'LOOKOUT_OAUTH_ENABLED=yes\n'),/true or false/);
 assert.deepEqual(validateRuntimeEnv(valid+'LOOKOUT_OAUTH_ENABLED=true\nLOOKOUT_OAUTH_CONFIG_FILE=/run/lookout-oauth/config.json\n'),{host:'api.lookout.test'});
 assert.ok(sourcePaths.includes('infra/gcp/compose.oauth.yaml'));
});

test('secret staging verifies complete bytes and preserves previous file on a truncated upload',async()=>{
 const {stageSecretCommand}=await import('../scripts/deploy-gcp.mjs');
 const {createHash}=await import('node:crypto');const {mkdtemp,readFile,readdir,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {spawnSync}=await import('node:child_process');
 const dir=await mkdtemp(join(tmpdir(),'lookout-stage-fixture-'));const text='fictional test config\n',digest=createHash('sha256').update(text).digest('hex');
 try{
 const command=stageSecretCommand('oauth',digest).replace(/^sudo /,'').replaceAll('/etc/lookout/staged',dir);
 assert.equal(spawnSync('sh',['-c',command],{input:text,encoding:'utf8'}).status,0);
 assert.notEqual(spawnSync('sh',['-c',command],{input:'truncated',encoding:'utf8'}).status,0);
 assert.equal(await readFile(join(dir,'oauth-'+digest),'utf8'),text);assert.deepEqual(await readdir(dir),['oauth-'+digest]);
 assert.throws(()=>stageSecretCommand('bad;command',digest));assert.throws(()=>stageSecretCommand('oauth','bad'));
 }finally{await rm(dir,{recursive:true,force:true});}
});
