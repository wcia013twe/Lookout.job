import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { generateToken, hashToken, validateRequest, SCOPES } from '../supabase/functions/agent-gateway/contract.mjs';

test('agent credentials are high entropy, separately generated and only hashed for storage', async () => {
  const a = generateToken(webcrypto), b = generateToken(webcrypto);
  assert.match(a, /^jb_agent_[a-f0-9]{64}$/);
  assert.notEqual(a, b);
  const hash = await hashToken(a, webcrypto);
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.notEqual(hash, a);
  assert.equal(hash, await hashToken(a, webcrypto));
});
test('credential management rejects unbounded expiration and unknown scope', () => {
  for (const expiresInDays of [0,91,1.5,'30']) {
    assert.throws(() => validateRequest({operation:'connections.issue',payload:{name:'Muse',scopes:SCOPES,expiresInDays}}));
  }
  for (const scopes of [[],['admin'],['drafts:write','approvals:write']]) {
    assert.throws(() => validateRequest({operation:'connections.issue',payload:{name:'Muse',scopes}}));
  }
  assert.doesNotThrow(() => validateRequest({operation:'connections.issue',payload:{name:'Muse',scopes:['workspace:read'],expiresInDays:30}}));
});
test('the gateway exposes no approve or submit operation and requires object payloads', () => {
  for (const operation of ['approvals.create','applications.submit','sql','connections.delete']) {
    assert.throws(() => validateRequest({operation,payload:{}}));
  }
  assert.throws(() => validateRequest({operation:'workspace.read',payload:[]}));
});

test('batch publishing rejects candidate data in the shared employer catalog', () => {
  assert.throws(() => validateRequest({operation:'batches.publish',payload:{eventKey:'test',label:'Test',jobs:[{canonicalUrl:'https://example.com/job',employer:{company:'Employer',profile:{name:'Private'}}}]}}));
  assert.doesNotThrow(() => validateRequest({operation:'batches.publish',payload:{eventKey:'test',label:'Test',jobs:[{canonicalUrl:'https://example.com/job',employer:{company:'Employer',title:'Engineer'},recommendation:{whyItFits:'Private fit'}}]}}));
});
