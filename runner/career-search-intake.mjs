import {assertPostingLiveness} from '../lib/discovery-liveness-contract.mjs';
import {publicUrl} from './public-source.mjs';
import {checkDiscoveryLiveness} from './career-liveness.mjs';

const text=v=>typeof v==='string'?v.trim():'';
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}/.test(v)&&Number.isFinite(Date.parse(v))?new Date(v).toISOString():null;
function ownedBoardCompany(source,url){
 if(!source?.name||!source.careers_url)return '';
 try{const a=new URL(publicUrl(source.careers_url)),b=new URL(publicUrl(url));
  const boardHost=h=>h.replace(/^boards\.greenhouse\.io$/,'job-boards.greenhouse.io');
  if(boardHost(a.hostname)!==boardHost(b.hostname))return '';
  const path=v=>v.replace(/^\/[a-z]{2}-[A-Z]{2}(?=\/)/,'').replace(/\/$/,'');
  const root=path(a.pathname),posting=path(b.pathname);
  if(root&&posting!==root&&!posting.startsWith(root+'/'))return '';
  return text(source.name);
 }catch{return '';}
}
export async function verifyDiscoveryLeads(leads,{check=checkDiscoveryLiveness,fetchJson,fetchJd,source}={}){
 if(!Array.isArray(leads)||leads.length>25)throw Error('At most 25 lead URLs required');
 const {resolveAtsApi,JD_TEXT_API_ATS}=await import('./vendor/career-ops/liveness-api.mjs');
 const {normalizeGreenhouseJob,fetchJdViaKnownApi}=await import('./vendor/career-ops/browser-extract.mjs');
 const {normalizeUrl}=await import('./vendor/career-ops/url-key.mjs');
 const {makeHttpCtx}=await import('./vendor/career-ops/providers/_http.mjs');
 const ctx=makeHttpCtx(),json=fetchJson||ctx.fetchJson,jobs=[],diagnostics=[];
 const verdicts=await check(leads);
 if(!Array.isArray(verdicts)||verdicts.length!==leads.length)throw Error('Every lead requires a liveness verdict');
 for(let i=0;i<leads.length;i++){
  const url=publicUrl(leads[i].url),live=assertPostingLiveness(verdicts[i]);
  if(live.url!==url)throw Error('Liveness verdict order changed');
  const diagnostic={url,status:live.result,code:live.code,reason:live.reason,checkedAt:live.checkedAt,method:live.method,extraction:'not-attempted'};
  diagnostics.push(diagnostic);
  if(live.result!=='active')continue;
  let resolved=resolveAtsApi(url);
  if(!resolved||!JD_TEXT_API_ATS.has(resolved.ats)){
   diagnostic.extraction='unsupported';diagnostic.extractionReason='Posting is active; the pinned Career Ops JD dispatcher has no parser for this source.';continue;
  }
  try{
   // The original dispatcher owns API retrieval and full-text normalization for
   // every supported ATS. Metadata below only maps official fields into Lookout.
   let parsed,raw;
   if(resolved.ats==='greenhouse'){
    raw=await json(resolved.apiUrl,{redirect:'error'});
    parsed=normalizeGreenhouseJob(raw,normalizeUrl(publicUrl(raw.absolute_url||url)),60000);
   }else{
    parsed=await (fetchJd||fetchJdViaKnownApi)(url,60000,15000);
    if(!parsed?.text){diagnostic.extraction='failed';diagnostic.extractionReason='Career Ops could not retrieve a complete official description.';continue;}
    if(resolved.ats==='greenhouse-embedded'){
     const redirect=await fetch(resolved.apiUrl,{redirect:'manual',signal:AbortSignal.timeout(15000)});
     const api=await resolved.followEmbed(redirect,resolved.parts);
     if(!api)throw Error('Unresolved embedded board');
     raw=await json(api,{redirect:'error'});
     resolved=resolveAtsApi(raw.absolute_url||'');
     parsed={...parsed,url:raw.absolute_url};
     if(!resolved||resolved.ats!=='greenhouse')throw Error('Embedded posting identity missing');
    }else raw=await json(resolved.apiUrl,{redirect:'error'});
   }
   const ats=resolved.ats,parts=resolved.parts;
   let record=raw,company='',location='',postedAt=null,requisitionId,postingId=parts.id||parts.jobId||parts.jobPath,board=parts.board||parts.slug||parts.org||parts.tenant||parts.company;
   if(ats==='ashby'){
    record=raw.jobs?.find(j=>String(j.id).toLowerCase()===String(parts.jobId).toLowerCase());if(!record||record.isListed===false)throw Error('Posting identity missing');
    company=text(raw.companyName)||text(raw.organization?.name);location=text(record.location);postedAt=date(record.publishedAt);board=parts.org;
   }else if(ats==='lever'){
    if(String(raw.id)!==parts.id)throw Error('Posting identity mismatch');company=text(raw.company?.name)||text(raw.companyName);location=text(raw.categories?.location);postedAt=typeof raw.createdAt==='number'?new Date(raw.createdAt).toISOString():null;
   }else if(ats==='workday'){
    record=raw.jobPostingInfo;if(!record||record.canApply===false)throw Error('Posting identity missing');company=text(record.hiringOrganization?.name)||text(raw.hiringOrganization?.name)||text(record.companyName);location=text(record.location);requisitionId=text(record.jobReqId);postingId=parts.jobPath;const {postedAtFromDetail}=await import('./vendor/career-ops/providers/workday.mjs');const posted=postedAtFromDetail(raw);postedAt=Number.isFinite(posted)?new Date(posted).toISOString():null;
   }else if(ats==='smartrecruiters'){
    if(String(raw.id)!==parts.id||raw.active===false)throw Error('Posting identity mismatch or closed');company=text(raw.company?.name);location=text(raw.location?.fullLocation)||[text(raw.location?.city),text(raw.location?.country)].filter(Boolean).join(', ');postedAt=date(raw.releasedDate);
   }else if(ats==='greenhouse'){
    if(String(raw.id)!==parts.id)throw Error('Posting identity mismatch');company=text(raw.company_name);location=text(raw.location?.name);postedAt=date(raw.first_published);requisitionId=text(raw.requisition_id);
   }
   const configuredCompany=ownedBoardCompany(source,url);company=company||configuredCompany;
   // Aggregate labels and board slugs are never promoted to employer facts.
   if(!company||!parsed?.title||!parsed.text||!postingId||!board){diagnostic.extraction='failed';diagnostic.extractionReason='Description retrieved, but employer name or posting identity could not be established from official metadata or a matching owned board.';continue;}
   if(ats==='greenhouse'){const canonical=resolveAtsApi(parsed.url);if(!canonical||canonical.ats!=='greenhouse'||canonical.parts.id!==parts.id||canonical.parts.board!==parts.board)throw Error('Canonical posting identity mismatch');}
   location=parsed.text.match(/^Location: (.+)$/m)?.[1]||location;
   const employment=text(record.employmentType||record.categories?.commitment||record.timeType).toLowerCase().replaceAll('_','-');
   const employmentType=({'full-time':'FT','fulltime':'FT','part-time':'Part-time','contract':'Contract','temporary':'Temporary','internship':'Internship','intern':'Internship'})[employment]||(/\bintern(?:ship)?\b/i.test(parsed.title)?'Internship':null);
   jobs.push({leadUrl:url,url:normalizeUrl(publicUrl(parsed.url||url)),title:parsed.title,company,location:location||null,description:parsed.text,postedAt,listingIdentity:{ats_provider:ats,board_slug:board,posting_id:String(postingId)},...(requisitionId?{requisitionId}:{}),...(employmentType?{employmentType}:{}),metadataSource:configuredCompany&&company===configuredCompany?'matching-owned-board-and-official-posting':'official-posting'});
   diagnostic.extraction='parsed';
  }catch{diagnostic.extraction='failed';diagnostic.extractionReason='Official description or metadata retrieval failed; confirmed liveness is unchanged.';}
 }
 return {jobs,diagnostics,provenance:{commit:'c78e14cdfd52f18a92e4a67694efab7ddef59385',verification:'liveness-api.mjs + liveness-browser.mjs + liveness-core.mjs',parser:'browser-extract.mjs normalizeGreenhouseJob + fetchJdViaKnownApi',transport:'providers/_http.mjs + original JD fetchers'}};
}
