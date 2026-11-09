import test from 'node:test';
import assert from 'node:assert/strict';
import {usage,summarize,validatePolicy} from '../scripts/job03/cost.mjs';
import {costValues} from '../scripts/n01/cost-export.mjs';
const receipt=(id='turn-1')=>({schemaVersion:1,scope:'participant_turn',basis:'turn_delta',source:'executor structural counter delta',receiptId:id,status:'complete',model:'test-model',tokens:{input_tokens:100,cached_input_tokens:40,output_tokens:20}});
const entry=(u,stage='s1')=>({stage,usage:u,evidenceFile:stage+'/response.json'});
test('missing usage stays unknown with no totals, estimates or invented free services',()=>{
 const c=summarize([entry(null)]);assert.equal(c.coverage.status,'unknown');assert.equal(c.coverage.attemptedStages,1);assert.equal(c.tokens,null);assert.equal(c.observedTokens,null);assert.equal(c.estimatedModelUsd,null);assert.equal(c.actualBilling.totalUsd,null);assert.equal(c.nonParticipantCosts.grader,'unmeasured');assert.doesNotThrow(()=>costValues(c));
});
test('valid executor deltas aggregate cached subset without counting reasoning twice',()=>{
 const a=receipt(),b=receipt('turn-2');b.tokens.reasoning_output_tokens=7;const c=summarize([entry(a),entry(b,'s2')]);assert.equal(c.coverage.status,'complete');assert.deepEqual(c.tokens,{input_tokens:200,cached_input_tokens:80,output_tokens:40});assert.equal(c.estimatedModelUsd,null);assert.equal(c.billedUsd,null);assert.doesNotThrow(()=>costValues(c));
});
test('missing failed-turn receipt or duplicate receipt makes full totals incomplete',()=>{
 for(const entries of [[entry(receipt()),entry(null,'timeout')],[entry(receipt()),entry(receipt(),'duplicate')]]){const c=summarize(entries);assert.equal(c.coverage.status,'partial');assert.equal(c.tokens,null);assert.equal(c.observedTokens.input_tokens,100);assert.equal(c.estimatedModelUsd,null);assert.doesNotThrow(()=>costValues(c));}
});
test('invalid counters and cumulative-session usage are not accepted as zero or turn deltas',()=>{
 for(const change of [r=>r.tokens.cached_input_tokens=101,r=>r.tokens.output_tokens=-1,r=>delete r.tokens.cached_input_tokens,r=>r.basis='session_total',r=>delete r.receiptId,r=>r.tokens.reasoning_output_tokens=21]){const r=receipt();change(r);const c=summarize([entry(r)]);assert.equal(c.tokens,null);assert.equal(c.coverage.status,'unknown');}
 const zero=receipt();zero.tokens={input_tokens:0,cached_input_tokens:0,output_tokens:0};assert.equal(usage(zero).status,'complete');
});
test('only exact dated configured rates generate a labeled model estimate, never total cost',()=>{
 const policy={schemaVersion:1,currency:'USD',rates:[{model:'test-model',sourceUrl:'https://example.test/frozen-test-rates',asOf:'2026-11-09',inputUsdPerMillion:2,cachedInputUsdPerMillion:1,outputUsdPerMillion:4,outputIncludesReasoning:true,cacheWriteIncludedInInput:true}]};
 const c=summarize([entry(receipt())],policy);assert.equal(c.estimatedModelUsd,0.00024);assert.equal(c.estimatedTotalUsd,null);assert.equal(c.basis,'estimated_api_equivalent_not_subscription_invoice');assert.equal(c.stages[0].pricing.asOf,'2026-11-09');assert.doesNotThrow(()=>costValues(c));
 const wrong=receipt();wrong.model='other-model';assert.equal(summarize([entry(wrong)],policy).estimatedModelUsd,null);
 for(const edit of [p=>delete p.rates[0].sourceUrl,p=>delete p.rates[0].asOf,p=>p.rates[0].asOf='2026-02-30']){const p=structuredClone(policy);edit(p);assert.throws(()=>validatePolicy(p));}
});
test('actual billed receipts are separately covered locally; unknown billing remains unknown',()=>{
 const r=receipt();r.billedUsd=0.12;r.currency='USD';r.billingBasis='actual_provider_billed';const c=summarize([entry(r)]);assert.equal(c.actualBilling.coverage,'complete');assert.equal(c.actualBilling.totalUsd,0.12);assert.equal(c.estimatedModelUsd,null);assert.equal(c.billedUsd,null);assert.doesNotThrow(()=>costValues(c));
 assert.equal(summarize([entry(r),entry(null,'missing')]).actualBilling.totalUsd,null);
 delete r.billingBasis;assert.equal(summarize([entry(r)]).actualBilling.totalUsd,null);
});
test('setup/checkpoint captures do not become participant cost attempts',()=>{
 const c=summarize([{stage:'preflight',attempted:false,usage:receipt()}]);assert.equal(c.coverage.attemptedStages,0);assert.equal(c.coverage.status,'unknown');assert.equal(c.tokens,null);
});
