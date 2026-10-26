import {createHash} from 'node:crypto';
import {validateResumeParse} from '../../lib/resume-import.mjs';
import {verifyResumeBytes} from '../../supabase/functions/agent-gateway/profile-setup.mjs';
import {validateFieldUpdate} from '../../supabase/functions/agent-gateway/field-updates.mjs';
import type {Payload} from './types.ts';
export class ResumeParseError extends Error {status:number;constructor(status:number,message:string){super(message);this.status=status;}}
const text=(value:any)=>typeof value==='string'?value.trim().slice(0,20000):'';
const clean=(record:Payload)=>Object.fromEntries(Object.entries(record).filter(([,v])=>v!==undefined&&v!==''));
const list=(value:any)=>Array.isArray(value)?value.slice(0,50):[];
// APILayer returns a flat object; live date fields may be strings or string arrays.
// Preserve those dates as source text rather than inventing month precision or ranges.
export function mapApilayerResponse(body:Payload){
 const object=(v:any)=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 const validDates=(v:any)=>v==null||typeof v==='string'||Array.isArray(v)&&v.every(d=>typeof d==='string');
 if(!object(body)||!['name','email','skills','education','experience'].some(k=>Object.hasOwn(body,k))||
  ['name','email'].some(k=>body[k]!=null&&typeof body[k]!=='string')||
  (body.skills!=null&&(!Array.isArray(body.skills)||body.skills.some((v:any)=>typeof v!=='string')))||
  ['education','experience'].some(k=>body[k]!=null&&(!Array.isArray(body[k])||body[k].some((r:any)=>!object(r)||Object.entries(r).some(([field,v])=>field==='dates'?!validDates(v):['name','title','location','organization','date_start','date_end'].includes(field)&&v!=null&&typeof v!=='string')))))throw new ResumeParseError(502,'The parser returned an unsupported response. Your file is saved.');
 const warnings=new Set<string>(['Scanned-resume OCR support is unverified. Check the extracted details against your original document.']);
 const dates=(row:Payload)=>{const raw=(Array.isArray(row.dates)?list(row.dates).map(text).filter(Boolean).join('; '):text(row.dates))||[text(row.date_start)&&'Start: '+text(row.date_start),text(row.date_end)&&'End: '+text(row.date_end)].filter(Boolean).join('; ');if(!raw)return '';warnings.add('Dates returned by the parser may be normalized or incomplete. They are preserved in descriptions; check the original resume before filling date fields.');return 'Dates returned by parser: '+raw;};
 if(!text(body.name))warnings.add('No name was extracted. Keep your saved name or enter it manually.');
 if(!text(body.email))warnings.add('No email was extracted. Keep your saved email or enter it manually.');
 for(const key of ['skills','education','experience'])if(Array.isArray(body[key])&&body[key].length>50)warnings.add('Some extracted entries exceed the 50-entry limit and were omitted.');
 const facts=clean({
  name:text(body.name),email:text(body.email),skills:list(body.skills).map(text).filter(Boolean).join('\n'),
  workExperience:list(body.experience).map(r=>clean({title:text(r.title),company:text(r.organization),location:text(r.location),description:dates(r)})).filter(r=>Object.keys(r).length),
  education:list(body.education).map(r=>clean({school:text(r.name),description:dates(r)})).filter(r=>Object.keys(r).length),
 });
 const output=Object.fromEntries(Object.entries(facts).filter(([,v])=>Array.isArray(v)?v.length:!!v));
 if(!Object.keys(output).length)throw new ResumeParseError(422,'No supported profile details were found. Try a text-based PDF or DOCX resume, or enter your details manually.');
 try{validateFieldUpdate('profile.fields.update',{fields:output,expectedUpdatedAt:'2026-01-01T00:00:00Z'});}catch{throw new ResumeParseError(422,'The extracted profile exceeds supported limits. Try a shorter resume.');}
 return {facts:output,warnings:[...warnings],provider:'apilayer',reviewRequired:true};
}
export function apilayerConfig(env:NodeJS.ProcessEnv=process.env){
 if(!env.APILAYER_API_KEY?.trim())throw new ResumeParseError(503,'Resume autofill is not configured yet. Your uploaded file is saved.');
 return {url:'https://api.apilayer.com/resume_parser/upload',key:env.APILAYER_API_KEY.trim()};
}
// Only sanitized proposals are cached, privately per owner/checksum, for 15 minutes.
// This is process-local cost suppression, not durable exactly-once billing.
export function createResumeParser({client,request=fetch,config=()=>apilayerConfig(),now=Date.now}: {client:any;request?:typeof fetch;config?:()=>{url:string;key:string};now?:()=>number}){
 const cache=new Map<string,{expires:number;promise:Promise<any>}>();
 async function owned(owner:string,resumeId:string){
  const {data:resume,error}=await client.from('resumes').select('id,user_id,object_path,content_hash,superseded_by').eq('id',resumeId).eq('user_id',owner).maybeSingle();
  if(error)throw new ResumeParseError(503,'Resume lookup is unavailable. Try again later.');
  if(!resume||resume.superseded_by||!new RegExp('^'+owner+'/[a-f0-9-]+\\.(pdf|docx)$','i').test(resume.object_path||'')||!/^[a-f0-9]{64}$/.test(resume.content_hash||''))throw new ResumeParseError(404,'Choose a current uploaded private PDF or DOCX resume. Document links cannot be parsed.');
  const {data:profile,error:profileError}=await client.from('profiles').select('updated_at,facts').eq('user_id',owner).maybeSingle();
  if(profileError)throw new ResumeParseError(503,'Profile lookup is unavailable. Try again later.');
  return {resume,profile:profile||{facts:{},updated_at:null}};
 }
 async function parse(owner:string,payload:Payload,recheck:()=>Promise<void>){
  validateResumeParse(payload);const settings=config();const before=await owned(owner,payload.resumeId);
  for(const [key,value]of cache)if(value.expires<=now())cache.delete(key);
  const key=owner+':'+before.resume.content_hash;let hit=cache.get(key);
  if(!hit){
   if(cache.size>=20)throw new ResumeParseError(429,'Resume autofill is busy. Please try again in a few minutes.');
   const promise=(async()=>{
    const {data:blob,error}=await client.storage.from('resumes').download(before.resume.object_path);
    if(error||!blob||blob.size<1||blob.size>10*1024*1024)throw new ResumeParseError(422,'The uploaded resume could not be read. Upload it again.');
    const extension=before.resume.object_path.endsWith('.pdf')?'pdf':'docx';
    try{await verifyResumeBytes(blob,{extension,bytes:blob.size,sha256:before.resume.content_hash});}catch{throw new ResumeParseError(422,'Resume contents do not match the saved file. Upload the resume again.');}
    await recheck();
    let response;
    try{response=await request(settings.url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(35000),headers:{apikey:settings.key,'Content-Type':'application/octet-stream'},body:blob});}catch{throw new ResumeParseError(502,'Resume parsing was interrupted. Your file is saved. Retrying may use another API request.');}
    if(!response.ok){
     await response.body?.cancel();
     const status=response.status;
     throw new ResumeParseError(status===429?429:[400,415,422].includes(status)?422:[401,403].includes(status)?503:502,
      status===429||status===402?'Resume autofill has reached its API request allowance. Your file is saved; check your APILayer subscription.':
      [401,403].includes(status)?'Resume autofill is not configured correctly. Check the APILayer key and Resume Parser subscription.':
      [400,415,422].includes(status)?'The resume could not be read. Try a text-based PDF or DOCX without a password.':'Resume parsing is unavailable. Your file is saved; try again later.');
    }
    const reader=response.body?.getReader();if(!reader)throw new ResumeParseError(502,'Empty parser response.');let size=0;const parts:Uint8Array[]=[];
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8*1024*1024){await reader.cancel();throw new ResumeParseError(502,'Parser response exceeded supported limits.');}parts.push(value);}
    try{return mapApilayerResponse(JSON.parse(Buffer.concat(parts).toString('utf8')));}catch(e){if(e instanceof ResumeParseError)throw e;throw new ResumeParseError(502,'Invalid parser response. Your file is saved.');}
   })();
   hit={expires:now()+15*60*1000,promise};cache.set(key,hit);promise.catch(()=>{if(cache.get(key)?.promise===promise)cache.delete(key);});
  }
  const proposal=await hit.promise;await recheck();const after=await owned(owner,payload.resumeId);
  if(after.resume.content_hash!==before.resume.content_hash)throw new ResumeParseError(409,'Resume changed. Start the import again.');
  return {...proposal,resumeId:payload.resumeId,profileUpdatedAt:after.profile.updated_at,profileFacts:after.profile.facts};
 }
 return {
  async human(token:string,payload:Payload){
   validateResumeParse(payload);const authenticate=async()=>{const {data,error}=await client.auth.getUser(token);if(error||!data.user||data.user.is_anonymous)throw new ResumeParseError(401,'Sign in before importing a resume.');return data.user.id;};
   const owner=await authenticate();return parse(owner,payload,async()=>{if(await authenticate()!==owner)throw new ResumeParseError(401,'Account changed.');});
  },
  async agent(token:string,payload:Payload){
   validateResumeParse(payload);const hash=createHash('sha256').update(token).digest('hex');
   const authorize=async()=>{const auth=await client.rpc('agent_dispatch',{credential_hash:hash,operation:'credentials.verify',payload:{}});if(auth.error)throw new ResumeParseError(401,'Agent credential invalid, expired or revoked.');if(!['workspace:read','resumes:read','profile:write'].every(s=>auth.data?.scopes?.includes(s)))throw new ResumeParseError(403,'Resume import requires workspace:read, resumes:read and profile:write.');const row=await client.rpc('agent_dispatch',{credential_hash:hash,operation:'resumes.read',payload:{resumeId:payload.resumeId}});if(row.error||!row.data?.user_id)throw new ResumeParseError(404,'Owned resume not found.');return row.data.user_id;};
   const owner=await authorize();return parse(owner,payload,async()=>{if(await authorize()!==owner)throw new ResumeParseError(401,'Account changed.');});
  },
 };
}
