import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sourceHashes,checkBundle,makeEvidence,checkEvidenceSources} from '../scripts/backend-evidence.mjs';
const prefix='supabase/functions/agent-gateway/';
const files=[{name:prefix+'index.ts',content:"import './worker.mjs';"},{name:prefix+'worker.mjs',content:'export const x=1;'},{name:prefix+'deno.json',content:'{}'}];
const source=(sha,path)=>files.find(f=>f.name===path).content;
const observation={sourceCommit:'a'.repeat(40),observedAt:'2026-10-25T00:00:00Z',operator:'synthetic test',readSource:source,
 readbacks:[{name:'agent-gateway',id:'dfc5f49c-280e-48f5-ad2b-8c013050a1da',version:33,status:'ACTIVE',verify_jwt:false,files}]};
test('record generation requires exact source readback and complete relative dependency closure',()=>{
 const record=makeEvidence(observation);assert.doesNotThrow(()=>checkEvidenceSources(record,source));
 assert.equal(record.functions[0].files.length,3);
 assert.throws(()=>makeEvidence({...observation,readSource:()=>''}),/mismatch/);
 assert.throws(()=>checkBundle(files.filter(f=>!f.name.endsWith('worker.mjs')),'agent-gateway'),/dependency/);
 const bad=structuredClone(record);bad.functions[0].files[0].sha256='0'.repeat(64);
 assert.throws(()=>checkEvidenceSources(bad,source),/hash mismatch/);
});
test('hashes use exact UTF-8 bytes including terminal newlines',()=>{
 assert.notDeepEqual(sourceHashes('é'),sourceHashes('é\n'));
 assert.equal(sourceHashes('').gitBlobSha,'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391');
});
