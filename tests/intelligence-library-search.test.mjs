import test from 'node:test';
import assert from 'node:assert/strict';
import {librarySearchEvaluation} from '../backend/intelligence/library-search-evaluation.ts';
const vector=i=>Array.from({length:1536},(_,n)=>n===i?1:0);
test('Node library adapter uses independent BM25/vector modes and library hybrid without exposing text or vectors',async()=>{
 const records=[{id:'waiting',text:'Bloomberg New Grad waiting for a reply after the interview',embedding:vector(0)},{id:'invitation',text:'Bloomberg New Grad received a next round invitation',embedding:vector(1)}];
 const original=structuredClone(records),run=await librarySearchEvaluation(records);
 assert.equal((await run('bm25','invitation'))[0].id,'invitation');
 assert.equal((await run('bm25','Who got an invitation recently?'))[0].id,'invitation');
 assert.equal((await run('vector','invitation',vector(0)))[0].id,'waiting');
 const hybrid=await run('hybrid','invitation',vector(0));
 assert.deepEqual(new Set(hybrid.map(r=>r.id)),new Set(['invitation','waiting']));
 assert(hybrid.every(h=>Object.keys(h).sort().join(',')==='id,score'&&Number.isFinite(h.score)));
 assert.deepEqual(await run('hybrid','invitation',vector(0)),hybrid);
 assert.equal((await run('bm25','zzzxxyy')).length,0);
 assert.equal((await run('bm25','How do I repair a leaking kitchen faucet?')).length,0);
 assert.deepEqual(records,original);
 await assert.rejects(()=>run('invalid','test'),/INVALID_SEARCH_MODE/);
 await assert.rejects(()=>run('vector','test',[]),/INVALID_VECTOR/);
 await assert.rejects(()=>run('bm25',' '),/INVALID_QUERY/);
 await assert.rejects(()=>run('bm25','test',undefined,21),/INVALID_LIMIT/);
 await assert.rejects(()=>librarySearchEvaluation([...records,records[0]]),/INVALID_EVALUATION_RECORD/);
});

test('library company and role scope excludes other roles and companies in every mode',async()=>{
 const run=await librarySearchEvaluation([
  {id:'match',text:'Waiting after interview',company:'Bloomberg',role:'New Grad Software Engineer',embedding:vector(0)},
  {id:'intern',text:'Waiting after interview',company:'Bloomberg',role:'Software Engineer Intern',embedding:vector(0)},
  {id:'other',text:'Waiting after interview',company:'Cedar Systems',role:'New Grad Software Engineer',embedding:vector(0)},
 ]);
 const scope={company:'Bloomberg',role:'New Grad Software Engineer'};
 for(const mode of ['bm25','vector','hybrid']){
  assert.equal((await run(mode,'Waiting after interview',vector(0),3)).length,3);
  assert.deepEqual((await run(mode,'Waiting after interview',vector(0),3,scope)).map(h=>h.id),['match']);
  assert.equal((await run(mode,'Waiting after interview',vector(0),3,{...scope,company:'Missing'})).length,0);
 }
});
