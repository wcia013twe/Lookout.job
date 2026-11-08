import {publicUrl} from '../../runner/public-source.mjs';
import type {Payload} from './types.ts';
import type {SourceResult} from './ats.ts';
const feeds={
 'https://github.com/jobright-ai/2026-Software-Engineer-New-Grad':{repo:'2026-Software-Engineer-New-Grad',employmentType:'FT'},
 'https://github.com/jobright-ai/2026-Software-Engineer-Internship':{repo:'2026-Software-Engineer-Internship',employmentType:'Internship'},
} as const;
export function jobrightFeed(address:unknown){return typeof address==='string'?feeds[address.replace(/\/$/,'') as keyof typeof feeds]||null:null;}
const text=(s:string)=>s.replace(/<[^>]*>/g,'').replace(/\*\*/g,'').replace(/&amp;/g,'&').trim();
function jobrightId(address:string){try{const u=new URL(address);return u.protocol==='https:'&&u.hostname==='jobright.ai'&&!u.username&&!u.password&&(!u.port||u.port==='443')?u.pathname.match(/^\/jobs\/info\/([a-f0-9]{24})$/)?.[1]:null;}catch{return null;}}
async function boundedText(response:Response,max:number){
 if(!response.ok)throw Error('Jobright HTTP '+response.status);
 if(!response.body)throw Error('Jobright response body missing');
 const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw Error('Jobright response exceeds size bound');}chunks.push(value);}}finally{reader.releaseLock();}
 return Buffer.concat(chunks).toString('utf8');
}
export function parseJobrightList(markdown:string,employmentType:string,address:string){
 const leads:Payload[]=[];let company='';const seen=new Set<string>();
 for(const line of markdown.split('\n')){
  if(!line.trim().startsWith('|'))continue;
  const cells=line.trim().replace(/^\||\|$/g,'').split(/(?<!\\)\|/);if(cells.length<5)continue;
  const companyCell=cells[0].trim();if(companyCell!=='↳')company=text(companyCell.replace(/\[([^\]]+)\]\([^)]*\)/g,'$1'));
  const link=cells[1].match(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/);if(!company||!link)continue;
  let url:string;try{url=publicUrl(link[2].replace(/&amp;/g,'&'));}catch{continue;}
  const id=jobrightId(url);if(new URL(url).hostname==='jobright.ai'&&!id)continue;
  if(id)url='https://jobright.ai/jobs/info/'+id;
  if(seen.has(url))continue;seen.add(url);
  leads.push({url,title:text(link[1]),company,location:text(cells[2]),employmentType,leadSource:address,sourceListedDate:text(cells[4]),sourceWorkSetting:text(cells[3])});
 }
 return leads;
}
// Only explicit same-posting application fields are accepted. Company websites,
// unrelated links and Jobright's own summary are never employer verification.
export function jobrightEmployerUrl(html:string,id:string){
 const raw=html.match(/<script\b(?=[^>]*\bid=["']__NEXT_DATA__["'])[^>]*>([\s\S]*?)<\/script>/i)?.[1];
 if(!raw)throw Error('Jobright public posting data unavailable');
 const row=JSON.parse(raw)?.props?.pageProps?.dataSource?.jobResult;
 if(row?.jobId!==id)throw Error('Jobright posting identity mismatch');
 if(row.isDeleted===true)throw Error('Jobright posting is marked deleted');
 const urls=new Set<string>();
 for(const value of [row.applyLink,row.originalUrl])if(typeof value==='string'&&value.trim()){
  const url=publicUrl(value),host=new URL(url).hostname;
  if(host==='jobright.ai'||host.endsWith('.jobright.ai'))throw Error('Jobright application URL is not an employer link');
  urls.add(url);
 }
 if(urls.size!==1)throw Error(urls.size?'Jobright employer application link is ambiguous':'Jobright does not expose a public employer application link');
 return [...urls][0];
}
export async function readJobrightLeads(address:string,{request=fetch,select,onRetained,resolve=true}:{request?:typeof fetch;select?:(rows:Payload[])=>Promise<Payload[]>;onRetained?:(rows:Payload[])=>Promise<void>;resolve?:boolean}={}){
 const feed=jobrightFeed(address);if(!feed)throw Error('Only configured official Jobright repositories are supported');
 const markdown=await boundedText(await request(`https://raw.githubusercontent.com/jobright-ai/${feed.repo}/master/README.md`,{redirect:'error',signal:AbortSignal.timeout(30000)}),8000000);
 const rows=parseJobrightList(markdown,feed.employmentType,address);
 if(!rows.length)throw Error('Jobright list has no recognizable job rows; format may have changed');
 // Apply the existing title gate before spending network calls on detail pages.
 const retained:Payload[]=rows.map(row=>({...row,resolution:'pending'}));
 await onRetained?.(retained);
 const selected=select?await select(rows):rows;
 const selectedUrls=new Set(selected.map(row=>row.url));
 for(const row of retained)if(!selectedUrls.has(row.url))row.resolution='filtered-title';
 if(!resolve)return {leads:[],retained,total:rows.length,examined:0,prefilterExcluded:rows.length-selected.length,diagnostics:[]};
 const leads:Payload[]=[],diagnostics:NonNullable<SourceResult['diagnostics']>=[];let index=0;
 await Promise.all(Array.from({length:Math.min(6,selected.length)},async()=>{
  while(index<selected.length){const lead=selected[index++],id=jobrightId(lead.url);
   try{const url=id?jobrightEmployerUrl(await boundedText(await request('https://jobright.ai/jobs/info/'+id,{redirect:'error',signal:AbortSignal.timeout(20000)}),2000000),id):lead.url;leads.push({...lead,url});Object.assign(retained.find(row=>row.url===lead.url)!,{resolution:'resolved',employerUrl:url});}
   catch(error){const reason=error instanceof Error?error.message:'Jobright employer link unresolved';Object.assign(retained.find(row=>row.url===lead.url)!,{resolution:'unresolved',reason});diagnostics.push({url:lead.url,status:'uncertain',reason});}
  }
 }));
 await onRetained?.(retained);
 leads.sort((a,b)=>a.url.localeCompare(b.url));
 return {leads,retained,total:rows.length,examined:selected.length,prefilterExcluded:rows.length-selected.length,diagnostics};
}
