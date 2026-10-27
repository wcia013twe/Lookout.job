import {assertPostingLiveness} from '../lib/discovery-liveness-contract.mjs';
import {publicUrl} from './public-source.mjs';
import {checkDiscoveryLiveness} from './career-liveness.mjs';
export async function verifyDiscoveryLeads(leads,{check=checkDiscoveryLiveness,fetchJson}={}){
 if(!Array.isArray(leads)||leads.length>25)throw Error('At most 25 lead URLs required');
 const {resolveAtsApi}=await import('./vendor/career-ops/liveness-api.mjs');
 const {normalizeGreenhouseJob}=await import('./vendor/career-ops/browser-extract.mjs');
 const {normalizeUrl}=await import('./vendor/career-ops/url-key.mjs');
 const {makeHttpCtx}=await import('./vendor/career-ops/providers/_http.mjs');
 const ctx=makeHttpCtx(),jobs=[],diagnostics=[];
 const verdicts=await check(leads);
 if(!Array.isArray(verdicts)||verdicts.length!==leads.length)throw Error('Every lead requires a liveness verdict');
 for(let i=0;i<leads.length;i++){
  const url=leads[i].url,live=assertPostingLiveness(verdicts[i]);
  if(live.url!==url)throw Error('Liveness verdict order changed');
  const diagnostic={url,status:live.result,code:live.code,reason:live.reason,checkedAt:live.checkedAt,method:live.method,extraction:'not-attempted'};
  diagnostics.push(diagnostic);
  if(live.result!=='active')continue;
  const resolved=resolveAtsApi(url);
  if(!resolved||resolved.ats!=='greenhouse'){
   diagnostic.extraction='unsupported';diagnostic.extractionReason='Posting is active; no supported full-description parser is configured for this source.';
   continue;
  }
  try{
   const raw=await (fetchJson||ctx.fetchJson)(resolved.apiUrl,{redirect:'error'});
   const canonical=normalizeUrl(publicUrl(raw.absolute_url||url));
   const parsed=normalizeGreenhouseJob(raw,canonical,60000);
   if(!parsed?.text||!raw.company_name||String(raw.id)!==resolved.parts.id){diagnostic.extraction='failed';diagnostic.extractionReason='Employer details lacked matching identity, company or description.';continue;}
   const published=typeof raw.first_published==='string'&&Number.isFinite(Date.parse(raw.first_published))?new Date(raw.first_published).toISOString():null;
   jobs.push({leadUrl:url,url:parsed.url,title:parsed.title,company:raw.company_name,location:raw.location?.name||null,description:parsed.text,postedAt:published,listingIdentity:{ats_provider:'greenhouse',board_slug:resolved.parts.board,posting_id:String(raw.id)},...(raw.requisition_id?{requisitionId:String(raw.requisition_id)}:{}),...(/\bintern(?:ship)?\b/i.test(parsed.title)?{employmentType:'Internship'}:{})});
   diagnostic.extraction='parsed';
  }catch{diagnostic.extraction='failed';diagnostic.extractionReason='Description retrieval or parsing failed; confirmed liveness is unchanged.';}
 }
 return {jobs,diagnostics,provenance:{commit:'c78e14cdfd52f18a92e4a67694efab7ddef59385',verification:'liveness-api.mjs + liveness-browser.mjs + liveness-core.mjs',parser:'browser-extract.mjs normalizeGreenhouseJob',transport:'providers/_http.mjs'}};
}
