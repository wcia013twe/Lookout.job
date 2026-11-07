import type {Payload} from './types.ts';
// A thin adapter for a structured aggregate absent from the pinned upstream.
// No employer availability, salary or personal eligibility is inferred here.
const feeds={
 'https://github.com/SimplifyJobs/New-Grad-Positions':{repo:'New-Grad-Positions',employmentType:'FT',terms:null},
 'https://github.com/SimplifyJobs/Summer2027-Internships':{repo:'Summer2027-Internships',employmentType:'Internship',terms:['Summer 2027']},
 'https://github.com/SimplifyJobs/Summer2027-Internships/blob/dev/README-Off-Season.md':{repo:'Summer2027-Internships',employmentType:'Internship',terms:['Fall 2026','Winter 2027','Spring 2027']},
} as const;
export function simplifyFeed(address:unknown){if(typeof address!=='string')return null;return feeds[address.replace(/\/$/,'') as keyof typeof feeds]||null;}
export async function readSimplifyLeads(address:string,{offset=0,limit=25,request=fetch,now=Date.now()}:{offset?:number;limit?:number|null;request?:typeof fetch;now?:number}={}){
 const feed=simplifyFeed(address);if(!feed)throw Error('Only configured official Simplify New Grad, Summer 2027 and off-season feeds are supported');
 if(!Number.isSafeInteger(offset)||offset<0||offset>50000||limit!==null&&(!Number.isSafeInteger(limit)||limit<1||limit>100))throw Error('Bounded Simplify cursor required');
 const response=await request(`https://raw.githubusercontent.com/SimplifyJobs/${feed.repo}/dev/.github/scripts/listings.json`,{redirect:'error',signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error('Simplify structured feed HTTP '+response.status);
 const chunks:Uint8Array[]=[];let size=0;if(!response.body)throw Error('Simplify feed response body missing');
 for await(const chunk of response.body){size+=chunk.length;if(size>32000000){await response.body.cancel().catch(()=>{});throw Error('Simplify feed exceeds 32 MB bound');}chunks.push(chunk);}
 let rows;try{rows=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw Error('Simplify feed is not valid structured JSON');}
 if(!Array.isArray(rows))throw Error('Simplify feed must be an array');
 const candidates=rows.filter((row:Payload)=>row?.active===true&&row.is_visible!==false&&(feed.terms===null||Array.isArray(row.terms)&&feed.terms.some(term=>row.terms.includes(term)))&&typeof row.url==='string'&&typeof row.title==='string'&&typeof row.company_name==='string')
  .sort((a:Payload,b:Payload)=>(Number(b.date_posted)||0)-(Number(a.date_posted)||0)||String(a.id).localeCompare(String(b.id)));
 const leads=candidates.slice(offset,limit===null?undefined:offset+limit).map((row:Payload)=>({url:row.url,title:row.title,company:row.company_name,location:Array.isArray(row.locations)?row.locations.join('; '):null,employmentType:feed.employmentType,sourceListAgeDays:Number.isFinite(row.date_posted)&&row.date_posted>0?Math.max(0,Math.floor((now/1000-row.date_posted)/86400)):null,leadSource:address}));
 const nextOffset=offset+leads.length<candidates.length?offset+leads.length:null;
 return {leads,total:candidates.length,nextOffset,coverage:nextOffset===null?'exhaustive':'truncated',notice:'Aggregate leads only. Availability, details and canonical URLs require employer verification; list dates are not employer posting dates.'};
}
