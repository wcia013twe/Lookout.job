import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {build,validateReply} from '../scripts/n01/langfuse.mjs';
const spec=JSON.parse(readFileSync(new URL('../examples/n01/scenario.json',import.meta.url)));
test('COM1 Python contract and grader regression suite',()=>{
 const r=spawnSync('python3',['-m','unittest','discover','-s','scripts/n01','-p','test_*.py'],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
});
test('COM1 experiment is one trajectory with stage children and root scores; private content excluded',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'n01-fixture-'));
 try{
 const script="import sys,json; from pathlib import Path; sys.path.insert(0,'scripts/n01'); from test_n01 import fixture,SPEC; import grade; p=Path(sys.argv[1]); r=fixture(p); (p/'grade.json').write_text(json.dumps(grade.grade(p,SPEC,r)))";
 const r=spawnSync('python3',['-c',script,dir],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
 const g=JSON.parse(readFileSync(path.join(dir,'grade.json')));const p=build(dir,g,spec);
 assert.equal(p.spans.filter(s=>!s.parentSpanId).length,1);
 assert.equal(p.spans.filter(s=>s.parentSpanId===p.rootId).length,7);
 assert.ok(p.spans.every(s=>s.traceId===p.traceId));assert.ok(p.scores.every(s=>s.observationId===p.rootId));
 const encoded=JSON.stringify(p);assert.ok(!encoded.includes(g.evidenceDigest));assert.ok(!encoded.includes('fictional-verification'));assert.ok(!encoded.includes('Dana'));assert.ok(!encoded.includes('Ivo'));assert.ok(!encoded.includes('Fictional fixture; no model ran.'));
 assert.deepEqual(build(dir,g,spec),p,'stable IDs and timestamps');
 g.evidenceDigest='stale';assert.throws(()=>build(dir,g,spec),/Stale/);
 }finally{rmSync(dir,{recursive:true,force:true})}
});
test('Partial ingestion fails loudly',()=>{
 assert.throws(()=>validateReply({data:{partialSuccess:{rejectedSpans:1}}}),/Partial/);
 assert.throws(()=>validateReply({data:{rejectedCount:1}}),/Partial/);
});
