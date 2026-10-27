import {publicUrl} from '../../runner/public-source.mjs';
import {discoveryConstraints} from '../../lib/discovery-filter-contract.mjs';
import {readField} from '../../lib/search-profile.mjs';
import type {Payload} from './types.ts';
const endpoint='https://hiringcafe.com/api/chatgpt/mcp';
export function hiringCafeSource(address:unknown){try{const u=new URL(String(address));return u.protocol==='https:'&&['hiring.cafe','www.hiring.cafe','hiringcafe.com','www.hiringcafe.com'].includes(u.hostname)&&!u.username&&!u.password&&(!u.port||u.port==='443');}catch{return false;}}
export function hiringCafeQueries(source:Payload,profile:Payload={},days=3){
 const filters=profile.filters||{},constraints=discoveryConstraints(profile);
 const role=readField(profile.instructions||'','Role preferences','Roles');if(role.conflict)throw Error('Resolve duplicate Roles before searching');
 const words=Array.isArray(source.keywords)&&source.keywords.length?source.keywords:role.value?[role.value]:[''];
 const locations=String(filters.Location||'').split(/[;,]/).map(s=>s.trim()).filter(Boolean);if(!locations.length)locations.push('');
 const types=constraints.employment.values.length?constraints.employment.values.map((v:string)=>({'FT':'Full Time','Part-time':'Part Time'}[v]||v)):[''];
 const queries:Payload[]=[];
 for(const search of words)for(const location of locations)for(const type of types){
  const q:Payload={posted_within_days:Math.max(1,Math.min(30,Number(days)||3))};
  if(search)q.search=String(search).slice(0,500);if(location)q.location=location;if(type)q.employment_types=[type];
  if(filters['Experience level']==='Entry-level')q.seniority_levels=['No Prior Experience Required','Entry Level'];
  if(constraints.workArrangement.strength==='required'&&constraints.workArrangement.values.length)q.workplace_types=constraints.workArrangement.values.map((v:string)=>({'remote':'Remote','hybrid':'Hybrid','on-site':'Onsite'}[v]));
  queries.push(q);
 }
 return {queries:queries.slice(0,4),omittedQueries:Math.max(0,queries.length-4)};
}
async function boundedJson(response:Response){if(!response.ok)throw Error(`HiringCafe HTTP ${response.status}${response.status===429?'; rate limited; retry later':''}`);return JSON.parse(await boundedText(response));}
async function boundedText(response:Response){if(!response.body)throw Error('HiringCafe response body missing');const chunks:Uint8Array[]=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>2000000)throw Error('HiringCafe response exceeds 2 MB');chunks.push(chunk);}return Buffer.concat(chunks).toString('utf8');}
function employerUrl(value:unknown){try{const u=publicUrl(value);return hiringCafeSource(u)?null:u;}catch{return null;}}
export async function resolveHiringCafeEmployer(job:Payload,request:typeof fetch=fetch){
 const direct=employerUrl(job.applyUrl);if(direct)return direct;
 if(!hiringCafeSource(job.applyUrl))throw Error('HiringCafe supplied no public job link');
 const u=new URL(job.applyUrl);if(!u.pathname.startsWith('/job/'))throw Error('HiringCafe supplied no job-page link');
 const response=await request(u.href,{redirect:'error',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error(`HiringCafe job page HTTP ${response.status}; employer link unresolved`);
 const html=await boundedText(response);const links=new Set<string>();
 // Only explicit external Apply anchors, never unrelated links or arbitrary script URLs.
 for(const match of html.matchAll(/<a\b([^>]*?)>([\s\S]*?)<\/a>/gi)){
  const label=match[2].replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();if(!/^apply(?:\s+(?:now|for\b.*|on\b.*|to\b.*))?$/i.test(label))continue;
  const href=match[1].match(/\bhref\s*=\s*(["'])(.*?)\1/i)?.[2];if(!href)continue;
  const url=employerUrl(href.replace(/&amp;/g,'&'));if(url)links.add(url);
 }
 if(links.size!==1)throw Error('HiringCafe employer link missing or ambiguous');return [...links][0];
}
export async function readHiringCafeLeads(source:Payload,{profile={},days=3,request=fetch,limit=25}:{profile?:Payload;days?:number;request?:typeof fetch;limit?:number}={}){
 if(!hiringCafeSource(source.careers_url))throw Error('HiringCafe source required');
 if(!Number.isInteger(limit)||limit<1||limit>25)throw Error('Bounded HiringCafe limit required');
 const deadline=AbortSignal.timeout(75000),originalRequest=request;request=(url,init={})=>originalRequest(url,{...init,signal:AbortSignal.any([deadline,...(init.signal?[init.signal]:[])])});
 const plan=hiringCafeQueries(source,profile,days),leads:Payload[]=[],diagnostics:{url:string;status:string;reason:string;extraction:string}[]=[],queries:Payload[]=[];const seen=new Set<string>();let total=0,examined=0;
 for(const [index,args] of plan.queries.entries()){
  if(examined>=limit||deadline.aborted)break;
  let response:Response;try{response=await request(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream'},redirect:'error',signal:AbortSignal.timeout(30000),body:JSON.stringify({jsonrpc:'2.0',id:index+1,method:'tools/call',params:{name:'search_hiringcafe_jobs',arguments:args}})});}catch(error){if(!queries.length)throw error;diagnostics.push({url:endpoint,status:'uncertain',reason:'HiringCafe query interrupted; earlier results retained',extraction:'not-attempted'});break;}
  if(!response.ok&&queries.length){diagnostics.push({url:endpoint,status:'uncertain',reason:`HiringCafe HTTP ${response.status}; earlier results retained`,extraction:'not-attempted'});break;}
  const envelope=await boundedJson(response);if(envelope.error||envelope.result?.isError)throw Error('HiringCafe search tool failed');
  const result=envelope.result?.structuredContent;if(!Array.isArray(result?.jobs)||!Number.isInteger(result.total_matches)||result.total_matches<result.jobs.length)throw Error('HiringCafe search response schema changed');
  queries.push({filters:args,reportedMatches:result.total_matches,returned:result.jobs.length});total+=result.total_matches;
  for(const job of result.jobs){
   if(examined>=limit||deadline.aborted)break;if(typeof job.id!=='string'||!job.id||typeof job.title!=='string'||typeof job.company!=='string')throw Error('HiringCafe job response schema changed');if(seen.has(job.id))continue;seen.add(job.id);examined++;
   let detail=job;
   try{
    if(!job.applyUrl){const res=await request(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream'},redirect:'error',signal:AbortSignal.timeout(15000),body:JSON.stringify({jsonrpc:'2.0',id:100+examined,method:'tools/call',params:{name:'get_hiringcafe_job_details',arguments:{job_id:job.id}}})});const body=await boundedJson(res);if(body.error||body.result?.isError||body.result?.structuredContent?.job?.id!==job.id)throw Error('HiringCafe details unavailable or identity changed');detail=body.result.structuredContent.job;}
    const url=await resolveHiringCafeEmployer(detail,request);leads.push({url,title:job.title,company:job.company,location:job.location||null,employmentType:args.employment_types?.length===1?({'Full Time':'FT','Part Time':'Part-time'}[args.employment_types[0] as string]||args.employment_types[0]):undefined,sourceListAgeDays:Number.isFinite(Date.parse(job.datePosted))?Math.max(0,Math.floor((Date.now()-Date.parse(job.datePosted))/86400000)):null});
   }catch(error){diagnostics.push({url:typeof detail.applyUrl==='string'?detail.applyUrl:`https://hiringcafe.com/job/${encodeURIComponent(job.id)}`,status:'uncertain',reason:error instanceof Error?error.message:'HiringCafe employer link unresolved',extraction:'not-attempted'});}
  }
 }
 // Provider returns one role per company and rounded freshness windows; always a bounded sample.
 return {leads,diagnostics,total,examined,queries,omittedQueries:plan.omittedQueries,coverage:'truncated' as const,endpoint};
}
