import {publicUrl} from './public-source.mjs';
export async function verifyDiscoveryLeads(leads){
 if(!Array.isArray(leads)||leads.length>25)throw Error('At most 25 lead URLs required');
 const {resolveAtsApi,checkLivenessViaApi}=await import('./vendor/career-ops/liveness-api.mjs');
 const {normalizeGreenhouseJob}=await import('./vendor/career-ops/browser-extract.mjs');
 const {normalizeUrl}=await import('./vendor/career-ops/url-key.mjs');
 const {makeHttpCtx}=await import('./vendor/career-ops/providers/_http.mjs');
 const ctx=makeHttpCtx(),jobs=[],diagnostics=[];
 for(const lead of leads){const url=typeof lead?.url==='string'?lead.url:'';try{
  publicUrl(url);const resolved=resolveAtsApi(url);
  if(!resolved||resolved.ats!=='greenhouse'){diagnostics.push({url,status:'unsupported',reason:'This source needs a supported official ATS parser or agent research; no arbitrary page was fetched.'});continue;}
  const live=await checkLivenessViaApi(url);
  if(live?.result!=='active'){diagnostics.push({url,status:live?.result==='expired'?'expired':'uncertain',reason:live?.reason||'Official ATS availability was inconclusive.'});continue;}
  const raw=await ctx.fetchJson(resolved.apiUrl,{redirect:'error'});
  const canonical=normalizeUrl(publicUrl(raw.absolute_url||url));
  const parsed=normalizeGreenhouseJob(raw,canonical,60000);
  if(!parsed?.text||!raw.company_name||String(raw.id)!==resolved.parts.id){diagnostics.push({url,status:'uncertain',reason:'Official ATS details lacked matching posting identity/full text.'});continue;}
  const published=typeof raw.first_published==='string'&&Number.isFinite(Date.parse(raw.first_published))?new Date(raw.first_published).toISOString():null;
  jobs.push({url:parsed.url,title:parsed.title,company:raw.company_name,location:raw.location?.name||null,description:parsed.text,postedAt:published,listingIdentity:{ats_provider:'greenhouse',board_slug:resolved.parts.board,posting_id:String(raw.id)},...(raw.requisition_id?{requisitionId:String(raw.requisition_id)}:{}),...(/\bintern(?:ship)?\b/i.test(parsed.title)?{employmentType:'Internship'}:{})});
  diagnostics.push({url,status:'active',reason:'Exact official ATS posting verified and parsed with copied CareerOps code.'});
 }catch{diagnostics.push({url,status:'unavailable',reason:'Official ATS verification failed or exceeded its bounded request; no active role was recorded.'});}}
 return {jobs,diagnostics,provenance:{commit:'c78e14cdfd52f18a92e4a67694efab7ddef59385',verification:'liveness-api.mjs checkLivenessViaApi',parser:'browser-extract.mjs normalizeGreenhouseJob',transport:'providers/_http.mjs'}};
}
