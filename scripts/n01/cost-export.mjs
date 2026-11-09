// Cost scores are whole-trajectory summaries, never model-call generation spans.
export function costValues(cost) {
  if(cost==null)return [];
  if(cost.schemaVersion!==1||cost.currency!=='USD'||cost.basis!=='estimated_api_equivalent_not_subscription_invoice'||!['complete','partial','unknown'].includes(cost.coverage?.status))throw Error('Invalid cost accounting schema');
  const cv=cost.coverage;
  if(!Number.isSafeInteger(cv.attemptedStages)||!Number.isSafeInteger(cv.coveredStages)||cv.coveredStages<0||cv.attemptedStages<cv.coveredStages)throw Error('Invalid cost coverage counts');
  if(cv.status==='complete'&&(cv.attemptedStages===0||cv.coveredStages!==cv.attemptedStages))throw Error('Incomplete stage accounting');
  if(cost.tokens){for(const k of ['input_tokens','cached_input_tokens','output_tokens'])if(!Number.isSafeInteger(cost.tokens[k])||cost.tokens[k]<0)throw Error('Invalid token totals');if(cost.tokens.cached_input_tokens>cost.tokens.input_tokens)throw Error('Invalid cached token subset');}
  if(cost.estimatedTotalUsd!=null){const ext=cost.externalCosts;if(cost.estimatedModelUsd==null||!ext||['toolUsd','infrastructureUsd','lookoutProcessingUsd'].some(k=>ext[k]==null))throw Error('Total cost requires all components');const sum=cost.estimatedModelUsd+ext.toolUsd+ext.infrastructureUsd+ext.lookoutProcessingUsd;if(Math.abs(sum-cost.estimatedTotalUsd)>1e-9)throw Error('Inconsistent total cost');}
  const out=[['cost_coverage',cost.coverage.status,'CATEGORICAL']];
  const add=(key,value)=>{if(value==null)return;if(typeof value!=='number'||!Number.isFinite(value)||value<0)throw Error('Invalid cost metric '+key);out.push([key,value,'NUMERIC']);};
  if(cost.tokens!=null&&cost.coverage.status!=='complete')throw Error('Incomplete cost coverage cannot report total tokens');
  for(const key of ['input_tokens','cached_input_tokens','output_tokens'])add('cost_'+key,cost.tokens?.[key]);
  if(cost.estimatedModelUsd!=null&&cost.coverage.status!=='complete')throw Error('Incomplete model cost');
  add('cost_estimated_model_usd',cost.estimatedModelUsd);
  add('cost_estimated_total_usd',cost.estimatedTotalUsd);
  for(const key of ['toolUsd','infrastructureUsd','lookoutProcessingUsd'])add('cost_'+key,cost.externalCosts?.[key]);
  add('cost_attempted_stages',cost.coverage.attemptedStages);add('cost_covered_stages',cost.coverage.coveredStages);
  return out;
}
export function costProvenance(c) {
  if(c==null)return null;
  costValues(c);
  return {schemaVersion:c.schemaVersion,basis:c.basis,currency:c.currency,coverage:c.coverage,pricingPolicyDigest:c.pricingPolicyDigest,billedUsd:null,
    pricing:[...new Map((c.stages||[]).filter(s=>s.pricing).map(s=>[JSON.stringify(s.pricing),s.pricing])).values()],externalCosts:c.externalCosts,limitations:c.limitations};
}
