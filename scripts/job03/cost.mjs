// Same eval-v1 cost shape as n01/cost.py; no pricing lookup or remote calls.
import {createHash} from 'node:crypto';
const fields=['input_tokens','cached_input_tokens','output_tokens'];
const number=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
const integer=x=>Number.isSafeInteger(x)&&x>=0;
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function validatePolicy(policy={schemaVersion:1,currency:'USD',rates:[]}){
 if(policy.schemaVersion!==1||policy.currency!=='USD'||!Array.isArray(policy.rates))throw Error('Invalid frozen cost policy');
 const seen=new Set();for(const r of policy.rates){
  if(typeof r.model!=='string'||!r.model||seen.has(r.model)||!/^https:\/\//.test(r.sourceUrl||'')||!/^\d{4}-\d{2}-\d{2}$/.test(r.asOf||'')||!Number.isFinite(Date.parse(r.asOf))||new Date(r.asOf).toISOString().slice(0,10)!==r.asOf||r.outputIncludesReasoning!==true||r.cacheWriteIncludedInInput!==true||!['inputUsdPerMillion','cachedInputUsdPerMillion','outputUsdPerMillion'].every(k=>number(r[k])))throw Error('Exact model, dated sourced rates and supported token convention required');seen.add(r.model);
 }
 // Preflight/harness/grader and shared infrastructure are not participant model charges.
 if(policy.externalCosts&&Object.values(policy.externalCosts).some(x=>x!=null))throw Error('JOB03 external costs require a separate attributable receipt adapter; leave unmeasured');
 return policy;
}
export function usage(raw){
 const base={status:'unknown',tokens:null,model:null,receiptId:null,source:null,billedUsd:null};
 if(!raw||raw.schemaVersion!==1||raw.scope!=='participant_turn'||raw.basis!=='turn_delta'||typeof raw.source!=='string'||!raw.source||typeof raw.receiptId!=='string'||!raw.receiptId)return {...base,reason:'missing_or_unbound_executor_usage'};
 const t=raw.tokens,valid=raw.status==='complete'&&t&&fields.every(k=>integer(t[k]))&&t.cached_input_tokens<=t.input_tokens&&(t.reasoning_output_tokens==null||integer(t.reasoning_output_tokens)&&t.reasoning_output_tokens<=t.output_tokens);
 const billed=raw.billingBasis==='actual_provider_billed'&&raw.currency==='USD'&&number(raw.billedUsd)?raw.billedUsd:null;
 return {...base,status:valid?'complete':'unknown',tokens:valid?Object.fromEntries(fields.map(k=>[k,t[k]])):null,model:typeof raw.model==='string'?raw.model:null,source:raw.source,receiptId:raw.receiptId,billedUsd:billed,reason:valid?null:'incomplete_or_malformed_counters'};
}
export function summarize(entries,policy){
 policy=validatePolicy(policy);const seen=new Set(),stages=[];
 for(const entry of entries){if(entry.attempted===false)continue;let u=usage(entry.usage);
  if(u.receiptId&&seen.has(u.receiptId))u={...u,status:'unknown',tokens:null,billedUsd:null,reason:'duplicate_executor_usage_receipt'};
  if(u.receiptId)seen.add(u.receiptId);const rate=u.tokens?policy.rates.find(r=>r.model===u.model):null;
  const estimatedModelUsd=rate?((u.tokens.input_tokens-u.tokens.cached_input_tokens)*rate.inputUsdPerMillion+u.tokens.cached_input_tokens*rate.cachedInputUsdPerMillion+u.tokens.output_tokens*rate.outputUsdPerMillion)/1e6:null;
  stages.push({stage:entry.stage,...u,estimatedModelUsd,pricing:rate??null,evidenceFile:entry.evidenceFile??null});
 }
 const count=stages.length,covered=stages.filter(s=>s.tokens!==null).length,complete=count>0&&covered===count;
 const observed=covered?Object.fromEntries(fields.map(k=>[k,stages.reduce((n,s)=>n+(s.tokens?.[k]??0),0)])):null;
 const billed=stages.filter(s=>s.billedUsd!==null),billingComplete=count>0&&billed.length===count;
 return {schemaVersion:1,basis:'estimated_api_equivalent_not_subscription_invoice',currency:'USD',coverage:{status:complete?'complete':covered?'partial':'unknown',attemptedStages:count,coveredStages:covered},tokens:complete?observed:null,observedTokens:observed,estimatedModelUsd:complete&&stages.every(s=>s.estimatedModelUsd!==null)?stages.reduce((n,s)=>n+s.estimatedModelUsd,0):null,externalCosts:{toolUsd:null,infrastructureUsd:null,lookoutProcessingUsd:null,source:null},estimatedTotalUsd:null,billedUsd:null,actualBilling:{basis:'actual_provider_billed_receipts_only',coverage:billingComplete?'complete':billed.length?'partial':'unknown',coveredStages:billed.length,totalUsd:billingComplete?billed.reduce((n,s)=>n+s.billedUsd,0):null,observedUsd:billed.length?billed.reduce((n,s)=>n+s.billedUsd,0):null},pricingPolicyDigest:digest(policy),stages,nonParticipantCosts:{preflight:'unmeasured',harness:'unmeasured',grader:'unmeasured',infrastructure:'unmeasured',lookoutProcessing:'unmeasured'},limitations:['Participant executor turn deltas only; no cumulative-session double counting.','Missing, killed, invalid or duplicate usage is unknown, never zero.','Partial observed tokens are diagnostic, not full totals.','USD model estimates require exact dated frozen rates; they are not subscription charges.','Actual billed receipt totals remain local under actualBilling; shared eval-v1 does not export those fields.','Preflight, harness, grader and external costs are separately unmeasured, not free.']};
}
