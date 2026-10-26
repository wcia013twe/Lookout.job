import {createHash} from 'node:crypto';
import {validateResumeParse} from '../../lib/resume-import.mjs';
import {verifyResumeBytes} from '../../supabase/functions/agent-gateway/profile-setup.mjs';
import {validateFieldUpdate} from '../../supabase/functions/agent-gateway/field-updates.mjs';
import type {Payload} from './types.ts';
export class ResumeParseError extends Error {status:number;constructor(status:number,message:string){super(message);this.status=status;}}
const text=(value:any)=>typeof value==='string'?value.trim().slice(0,20000):'';
const clean=(record:Payload)=>Object.fromEntries(Object.entries(record).filter(([,v])=>v!==undefined&&v!==''));
const list=(value:any)=>Array.isArray(value)?value.slice(0,50):[];
const location=(value:any)=>text(value?.raw)||text(value?.formatted);
function month(value:any,warnings:Set<string>){
 if(!value?.date)return '';
 if(value.precision==='year'){warnings.add('Some dates specify only a year. Their month fields were left blank; check them in My Profile.');return '';}
 return ['month','day'].includes(value.precision)&&/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(value.date)?value.date.slice(0,7):'';
}
function website(value:any){try{const raw=text(value);if(!raw)return '';const url=new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw)?raw:'https://'+raw);return url.protocol==='https:'&&!url.username&&!url.password?url.href:'';}catch{return '';}}
export function mapAffindaResponse(body:Payload){
 if(body?.meta?.schemaVersion!=='1.0'||!body?.data||typeof body.data!=='object'||Array.isArray(body.data))throw new ResumeParseError(502,'The parser returned an unsupported response. Your file is saved.');
 const d=body.data,warnings=new Set<string>();const facts:Payload={};
 if(body.meta.document?.classification?.label==='not_resume')throw new ResumeParseError(422,'This document was not recognized as a resume. Choose a resume or fill your profile manually.');
 if(body.meta.document?.classification?.label==='uncertain')warnings.add('The parser was unsure whether this document is a resume. Review every proposed value.');
 if(body.meta.document?.extractionQuality?.band==='low')warnings.add('The document was difficult to read. Some details may be missing or incorrect.');
 if(body.meta.ocr?.truncated||body.meta.document?.warnings?.some((w:Payload)=>w.code==='ocr_truncated'))warnings.add('Only the first three scanned pages were read. Later pages may be missing.');
 if(body.meta.document?.warnings?.some((w:Payload)=>['low_text_quality','degenerate_ocr'].includes(w.code)))warnings.add('Text extraction reported a quality warning. Compare the result with your resume.');
 facts.firstName=text(d.person?.name?.given);facts.lastName=text(d.person?.name?.family);
 facts.name=[text(d.person?.name?.given),text(d.person?.name?.middle),text(d.person?.name?.family)].filter(Boolean).join(' ');
 facts.email=text(d.contact?.emails?.[0]);const phone=d.contact?.phoneNumbers?.[0];facts.phone=text(phone?.raw)||text(phone?.formatted);
 facts.location=location(d.person?.location);facts.introduction=text(d.summary);
 for(const link of list(d.contact?.websites)){const url=website(link?.url);if(!url)continue;const host=new URL(url).hostname.toLowerCase();const key=host==='linkedin.com'||host==='www.linkedin.com'?'linkedin':host==='github.com'||host==='www.github.com'?'github':'portfolio';if(!facts[key])facts[key]=url;}
 facts.skills=list(d.skills).map(s=>text(s.text)||text(s.name)).filter(Boolean).join('\n');facts.languages=list(d.languages).map(s=>text(s.name)).filter(Boolean).join('\n');
 for(const key of ['workExperience','education','projects'])if(Array.isArray(d[key])&&d[key].length>50)warnings.add('Some history exceeds the 50-entry profile limit and was omitted.');
 facts.workExperience=list(d.workExperience).map(r=>clean({title:text(r.jobTitle),company:text(r.organization),location:location(r.location),employmentType:text(r.employmentType),startDate:month(r.dateRange?.start,warnings),endDate:month(r.dateRange?.end,warnings),current:r.dateRange?.end?.current===true?true:undefined,description:text(r.description)})).filter(r=>Object.keys(r).length);
 facts.education=list(d.education).map(r=>clean({school:text(r.institution),degree:text(r.qualification),fieldOfStudy:list(r.fieldsOfStudy).map(text).filter(Boolean).join(', '),gpa:text(r.grade?.value),startDate:month(r.dateRange?.start,warnings),endDate:month(r.dateRange?.end,warnings)})).filter(r=>Object.keys(r).length);
 facts.projects=list(d.projects).map(r=>clean({name:text(r.name),role:text(r.role),url:website(r.url),startDate:month(r.dateRange?.start,warnings),endDate:month(r.dateRange?.end,warnings),description:text(r.description)})).filter(r=>Object.keys(r).length);
 const output=Object.fromEntries(Object.entries(facts).filter(([,v])=>Array.isArray(v)?v.length:!!v));
 if(!Object.keys(output).length)throw new ResumeParseError(422,'No supported profile details were found. Try another resume or enter your details manually.');
 try{validateFieldUpdate('profile.fields.update',{fields:output,expectedUpdatedAt:'2026-01-01T00:00:00Z'});}catch{throw new ResumeParseError(422,'The extracted profile exceeds supported limits. Try a shorter resume.');}
 return {facts:output,warnings:[...warnings],provider:'affinda',reviewRequired:true};
}
export function affindaConfig(env:NodeJS.ProcessEnv=process.env){
 const base=env.AFFINDA_BASE_URL||'https://resume-parser.us1.affinda.com';
 if(!['https://resume-parser.affinda.com','https://resume-parser.us1.affinda.com','https://resume-parser.eu1.affinda.com'].includes(base))throw new ResumeParseError(503,'Resume parser region is not configured correctly.');
 if(!env.AFFINDA_API_KEY?.trim())throw new ResumeParseError(503,'Resume autofill is not configured yet. Your uploaded file is saved.');
 const url=new URL('/v1/resumes/parse',base);if(env.AFFINDA_ORGANIZATION)url.searchParams.set('organization',env.AFFINDA_ORGANIZATION);
 return {url:url.href,key:env.AFFINDA_API_KEY};
}
// Only sanitized proposals are cached, privately per owner/checksum, for 15 minutes.
// This is process-local cost suppression, not durable exactly-once billing.
export function createResumeParser({client,request=fetch,config=()=>affindaConfig(),now=Date.now}: {client:any;request?:typeof fetch;config?:()=>{url:string;key:string};now?:()=>number}){
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
    try{response=await request(settings.url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(35000),headers:{Authorization:'Bearer '+settings.key,'Content-Type':extension==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','Content-Disposition':`attachment; filename="resume.${extension}"`},body:blob});}catch{throw new ResumeParseError(502,'Resume parsing was interrupted. Your file is saved. Retrying may use another parse credit.');}
    if(!response.ok){await response.body?.cancel();throw new ResumeParseError(response.status===429?429:response.status===422?422:502,response.status===402?'Resume autofill has no credits available. Your file is saved.':response.status===422?'The resume could not be read. Remove any password or try a clearer file.':'Resume parsing is unavailable. Your file is saved; try again later.');}
    const reader=response.body?.getReader();if(!reader)throw new ResumeParseError(502,'Empty parser response.');let size=0;const parts:Uint8Array[]=[];
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8*1024*1024){await reader.cancel();throw new ResumeParseError(502,'Parser response exceeded supported limits.');}parts.push(value);}
    try{return mapAffindaResponse(JSON.parse(Buffer.concat(parts).toString('utf8')));}catch(e){if(e instanceof ResumeParseError)throw e;throw new ResumeParseError(502,'Invalid parser response. Your file is saved.');}
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
