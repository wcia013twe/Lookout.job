import type {Payload} from './types.ts';

export interface Listing {sourceId:string;url:string;company:string;title:string;location:string|null;checkedAt:string;liveness:'active';evidence:string;employerPostedAt:string|null;sourceListAgeDays:null;description:string;atsIdentity:string;requisitionId?:string;employmentType?:string}
export interface SourceResult {listings:Listing[];coverage:'exhaustive'|'truncated'|'inaccessible';blocker:string;total:number}
const text=(v:unknown,max:number)=>typeof v==='string'?v.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,max):'';
const date=(v:unknown)=>typeof v==='string' && Number.isFinite(Date.parse(v))?new Date(v).toISOString():null;
export function sourceEndpoint(source:Payload):{provider:'greenhouse'|'lever';slug:string;url:URL}|null {
  let url;try{url=new URL(source.api||source.careers_url);}catch{return null;}
  if(url.protocol!=='https:' || url.username || url.password || url.port)return null;
  let slug;
  if(['boards.greenhouse.io','job-boards.greenhouse.io'].includes(url.hostname))slug=url.pathname.split('/')[1];
  else if(url.hostname==='boards-api.greenhouse.io')slug=url.pathname.match(/^\/v1\/boards\/([\w-]+)\/jobs\/?$/)?.[1];
  if(slug && /^[\w-]{1,100}$/.test(slug))return {provider:'greenhouse',slug,url:new URL(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`)};
  if(url.hostname==='jobs.lever.co')slug=url.pathname.split('/')[1];
  else if(url.hostname==='api.lever.co')slug=url.pathname.match(/^\/v0\/postings\/([\w-]+)\/?$/)?.[1];
  else return null;
  return slug && /^[\w-]{1,100}$/.test(slug)?{provider:'lever',slug,url:new URL(`https://api.lever.co/v0/postings/${slug}?mode=json&limit=100&skip=0`)}:null;
}
export function canonicalUrl(value:string):string {
  const url=new URL(value);if(url.protocol!=='https:' || url.username || url.password)throw Error('Invalid application URL');
  url.hash='';for(const key of [...url.searchParams.keys()])if(/^utm_/i.test(key)||['gh_src','lever-source','ref','source'].includes(key))url.searchParams.delete(key);
  return url.toString();
}
export function deduplicate(listings:Listing[],seen=new Set<string>()):Listing[]{
  return listings.filter(row=>{
    const identity='url:'+canonicalUrl(row.url);
    const match='match:'+`${row.company}|${row.title}|${row.location||''}`.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}|]/gu,'');
    if(seen.has(identity)||seen.has(match))return false;seen.add(identity);seen.add(match);return true;
  });
}
async function fetchJson(url:URL,request:typeof fetch){
  const response=await request(url,{redirect:'error',signal:AbortSignal.timeout(10000),headers:{Accept:'application/json','User-Agent':'Lookout-Discovery/1.0'}});
  if(!response.ok)throw Error('ATS source unavailable');
  const reader=response.body?.getReader();if(!reader)throw Error('Empty ATS response');
  let total=0;const chunks:Uint8Array[]=[];
  while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>8*1024*1024){await reader.cancel();throw Error('ATS response exceeds bounded source size');}chunks.push(value);}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export async function fetchSource(sourceId:string,source:Payload,{request=fetch,now=()=>new Date()}: {request?:typeof fetch;now?:()=>Date}={}):Promise<SourceResult>{
  const endpoint=sourceEndpoint(source);
  if(!endpoint)return {listings:[],coverage:'inaccessible',blocker:'This source needs an agent or an unsupported source connector.',total:0};
  try{
    const listings:Listing[]=[];let total=0;let coverage:SourceResult['coverage']='exhaustive';
    for(let page=0;page<(endpoint.provider==='lever'?3:1);page++){
      if(endpoint.provider==='lever')endpoint.url.searchParams.set('skip',String(page*100));
      const data=await fetchJson(endpoint.url,request);
      const rows=endpoint.provider==='greenhouse'?data.jobs:data;
      if(!Array.isArray(rows))throw Error('Unsupported ATS response');
      total+=rows.length;
      for(const row of rows.slice(0,500-listings.length)){
        try{
          const url=canonicalUrl(endpoint.provider==='greenhouse'?row.absolute_url:row.hostedUrl);
          const title=text(endpoint.provider==='greenhouse'?row.title:row.text,500);
          if(!title||row.id===undefined)continue;
          listings.push({sourceId,url,company:text(source.name,200)||endpoint.slug,title,location:text(endpoint.provider==='greenhouse'?row.location?.name:row.categories?.location,500)||null,checkedAt:now().toISOString(),liveness:'active',evidence:`Published posting ${row.id} returned by the employer's ${endpoint.provider} job board API.`,employerPostedAt:date(row.first_published),sourceListAgeDays:null,description:text(endpoint.provider==='greenhouse'?row.content:row.descriptionPlain||row.description,4500),atsIdentity:`${endpoint.provider}:${endpoint.slug}:${row.id}`,...(row.requisition_id?{requisitionId:String(row.requisition_id).slice(0,200)}:{})});
        }catch{/* Invalid individual listings never become verified discoveries. */}
      }
      if(endpoint.provider==='greenhouse'){if(rows.length>500 || listings.length<rows.length)coverage='truncated';break;}
      if(rows.length<100)break;
      if(page===2)coverage='truncated';
    }
    if(total && !listings.length)throw Error('No usable canonical postings');
    return {listings,coverage,blocker:coverage==='truncated'?'Source exceeds the bounded fetch or contains malformed postings.':'',total};
  }catch{return {listings:[],coverage:'inaccessible',blocker:'Source fetch failed or exceeded the bounded response; retry or use an agent.',total:0};}
}
