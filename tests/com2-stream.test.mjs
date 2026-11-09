import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {build,validateReply} from '../scripts/com2/langfuse.mjs';
import {validate as validateCommon,build as buildCommon} from '../scripts/evals/contract.mjs';
const spec=JSON.parse(readFileSync(new URL('../examples/com2/scenario.json',import.meta.url)));
test('COM2 Python contract and grader regression suite',()=>{
 const r=spawnSync('python3',['-m','unittest','discover','-s','scripts/com2','-p','test_*.py'],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
});
test('COM2 experiment is one trajectory with stage children and root scores; private content excluded',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'com2-fixture-'));
 try{
 const script="import sys,json; from pathlib import Path; sys.path.insert(0,'scripts/com2'); from test_com2 import fixture,SPEC; import grade; p=Path(sys.argv[1]); r=fixture(p); (p/'grade.json').write_text(json.dumps(grade.grade(p,SPEC,r)))";
 const r=spawnSync('python3',['-c',script,dir],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
 const g=JSON.parse(readFileSync(path.join(dir,'grade.json')));const p=build(dir,g,spec);
 assert.equal(p.spans.filter(s=>!s.parentSpanId).length,1);
 assert.equal(p.spans.filter(s=>s.parentSpanId===p.rootId).length,13);
 assert.ok(p.spans.every(s=>s.traceId===p.traceId));assert.ok(p.scores.every(s=>s.observationId===p.rootId));
 const encoded=JSON.stringify(p);assert.ok(!encoded.includes(g.evidenceDigest));assert.ok(!encoded.includes('fictional-verification'));assert.ok(!encoded.includes('Leah'));assert.ok(!encoded.includes('Alder'));assert.ok(!encoded.includes('Fictional fixture; no model ran.'));
 assert.deepEqual(build(dir,g,spec),p,'stable IDs and timestamps');
 g.evidenceDigest='stale';assert.throws(()=>build(dir,g,spec),/Stale/);
 }finally{rmSync(dir,{recursive:true,force:true})}
});
test('Partial ingestion fails loudly',()=>{
 assert.throws(()=>validateReply({data:{partialSuccess:{rejectedSpans:1}}}),/Partial/);
 assert.throws(()=>validateReply({data:{rejectedCount:1}}),/Partial/);
});

test('COM2 common summary uses shared contract and excludes content',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'com2-summary-'));
 try {
 const script="import sys,json; from pathlib import Path; sys.path.insert(0,'scripts/com2'); from test_com2 import fixture,SPEC; import grade,summary; p=Path(sys.argv[1]); review=fixture(p); print(json.dumps(summary.build(p,SPEC,grade.grade(p,SPEC,review),'com2-verification')))";
 const r=spawnSync('python3',['-c',script,dir],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
 const record=JSON.parse(r.stdout);validateCommon(record);const plan=buildCommon(record);
 assert.equal(plan.environment,'verification');assert.equal(record.scenarioId,'COM2');assert.equal(record.evaluation.wakesUsed,13);
 assert.ok(!JSON.stringify(plan).includes('Alder'));assert.ok(!JSON.stringify(plan).includes('Leah'));
 } finally {rmSync(dir,{recursive:true,force:true});}
});
