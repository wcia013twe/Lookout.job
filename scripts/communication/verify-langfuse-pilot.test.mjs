import test from 'node:test';
import assert from 'node:assert/strict';
import {readScores,verifyPlan} from './verify-langfuse-pilot.mjs';
test('verifies final scores beyond page one and rejects wrong subject',()=>{
 const expected=Array.from({length:125},(_,i)=>({id:String(i),name:`score${i}`,value:i,dataType:'NUMERIC',environment:'benchmark-pilot'}));
 const returned=expected.map(s=>({...s,subject:{kind:'observation',id:'root',traceId:'trace'}}));
 const plan={spans:[{spanId:'root'}],scores:expected,rootId:'root',traceId:'trace',experimentId:'experiment'};
 const cli=args=>{assert(args.includes('--all'));assert(args.includes('--max-items'));return {data:returned};};
 const scores=readScores(cli,x=>x,'trace');
 assert.equal(verifyPlan(plan,[{id:'root'}],scores,[{id:'experiment'}]),true);
 assert.equal(verifyPlan(plan,[{id:'root'}],scores.slice(0,100),[{id:'experiment'}]),false);
 scores[124].subject.id='wrong';
 assert.equal(verifyPlan(plan,[{id:'root'}],scores,[{id:'experiment'}]),false);
});
test('fails loudly at safety cap',()=>assert.throws(()=>readScores(()=>Array(10000),x=>x,'trace'),/safety cap/));
