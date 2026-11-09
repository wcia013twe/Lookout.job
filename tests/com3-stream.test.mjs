import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {build,validateReply} from '../scripts/com3/langfuse.mjs';
import {validate as validateCommon,build as buildCommon} from '../scripts/evals/contract.mjs';
const spec=JSON.parse(readFileSync(new URL('../examples/com3/scenario.json',import.meta.url)));
for(const script of ['scripts/com3/test_com3.py','tests/fixtures/com3/trajectory.py'])test(script,()=>{const r=spawnSync('python3',[script],{encoding:'utf8'});assert.equal(r.status,0,r.stderr)});
for(const condition of ['baseline','lookout'])test(`COM3 ${condition} complete grading and metadata mapping`,()=>{
 const parent=mkdtempSync(path.join(tmpdir(),'com3-synthetic-')),dir=path.join(parent,condition);
 try {
  const r=spawnSync('python3',['tests/fixtures/com3/trajectory.py','build',dir,condition],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
  for(const [gradeFile,summaryFile,reviewed] of [['grade.json','summary.json',true],['pending.json','pending-summary.json',false]]){
   const g=JSON.parse(readFileSync(path.join(dir,gradeFile))),s=JSON.parse(readFileSync(path.join(dir,summaryFile)));
   validateCommon(s);const common=buildCommon(s);assert.equal(common.environment,'verification');assert.equal(s.evaluation.reviewed,reviewed);assert.equal(s.evaluation.wakesUsed,10);assert.equal(s.scenarioId,'COM3');
   const p=build(dir,g,spec);assert.equal(p.spans.filter(x=>!x.parentSpanId).length,1);assert.equal(p.spans.filter(x=>x.parentSpanId===p.rootId).length,10);assert.ok(p.scores.every(x=>x.observationId===p.rootId));assert.deepEqual(build(dir,g,spec),p);
   assert.ok(!JSON.stringify([p,common]).includes('PRIVATE_SYNTHETIC_CONTENT'));assert.ok(!JSON.stringify([p,common]).includes('fictional-owner'));
   assert.equal(p.scores.some(x=>x.name==='com3_quality_pass'),reviewed);if(!reviewed){assert.equal(s.evaluation.taskSuccess,null);assert.equal(s.evaluation.quality,null)}
   assert.throws(()=>build(dir,{...g,evidenceDigest:'stale'},spec),/Stale/);
  }
  const g=JSON.parse(readFileSync(path.join(dir,'grade.json')));writeFileSync(path.join(dir,'terminal-files/result.md'),'tampered');assert.throws(()=>build(dir,g,spec),/Stale/);
 }finally{rmSync(parent,{recursive:true,force:true})}
});
test('COM3 partial ingestion fails loudly',()=>{assert.throws(()=>validateReply({data:{partialSuccess:{rejectedSpans:1}}}),/Partial/)});
