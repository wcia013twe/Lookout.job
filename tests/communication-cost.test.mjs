import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,readFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';import {build as common} from '../scripts/evals/contract.mjs';
for(const folder of ['n01','com2','com3','com4'])test(`${folder} cost reaches final grade and Langfuse without inventing prices`,async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'communication-cost-'));
 try {
 const source=`import sys,json,importlib.util
from pathlib import Path
sys.path.insert(0,'scripts/${folder}');sys.path.append('scripts/n01')
import grade,cost
${folder==='com3'?"s=importlib.util.spec_from_file_location('fixture','tests/fixtures/com3/trajectory.py');f=importlib.util.module_from_spec(s);s.loader.exec_module(f);fixture=f.fixture;SPEC=f.SPEC":`from test_${folder} import fixture,SPEC`}
p=Path(sys.argv[1]);review=fixture(p,'baseline')
before={'totals':{'input_tokens':100,'cached_input_tokens':20,'output_tokens':10},'records':1}
after={'totals':{'input_tokens':150,'cached_input_tokens':30,'output_tokens':15},'records':2,'models':['fictional-unpriced']}
delta=cost.delta(before,after,True)
assert delta['tokens']=={'input_tokens':50,'cached_input_tokens':10,'output_tokens':5}
assert cost.delta(after,before,True)['status']=='unknown'
for sp in p.glob('stage-*/stage-run.json'):
 m=json.loads(sp.read_text());m['cost']=delta;sp.write_text(json.dumps(m))
m=json.loads((p/'run.json').read_text());m['cost']=cost.persist(p);(p/'run.json').write_text(json.dumps(m))
review['evidenceDigest']=grade.evidence_digest(p);g=grade.grade(p,SPEC,review);(p/'grade.json').write_text(json.dumps(g))
import summary; (p/'summary.json').write_text(json.dumps(summary.build(p,SPEC,g,'synthetic-cost')) )
`;
 const r=spawnSync('python3',['-c',source,dir],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
 const g=JSON.parse(readFileSync(path.join(dir,'grade.json'))),spec=JSON.parse(readFileSync(new URL(`../examples/${folder}/scenario.json`,import.meta.url)));
 assert.equal(g.cost.coverage.status,'complete');assert.equal(g.cost.tokens.input_tokens,spec.stages.length*50);assert.equal(g.cost.estimatedModelUsd,null);assert.equal(g.cost.estimatedTotalUsd,null);
 const {build}=await import(`../scripts/${folder}/langfuse.mjs`);const p=build(dir,g,spec);assert.ok(p.scores.some(x=>x.name.endsWith('_cost_input_tokens')&&x.value===spec.stages.length*50));assert.ok(!p.scores.some(x=>x.name.endsWith('_cost_estimated_model_usd')));
 {const summary=JSON.parse(readFileSync(path.join(dir,'summary.json')));const exported=common(summary);assert.ok(exported.scores.some(x=>x.name==='eval_v1_cost_input_tokens'));}
 }finally{rmSync(dir,{recursive:true,force:true})}
});
