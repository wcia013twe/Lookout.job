export {RESUME_PARSE_TOOL,validateResumeParse} from '../supabase/functions/agent-gateway/resume-parse.mjs';
import {validateResumeParse} from '../supabase/functions/agent-gateway/resume-parse.mjs';
const present=value=>Array.isArray(value)?value.length>0:typeof value==='string'?!!value.trim():value!==undefined&&value!==null;
export function profileImportChoices(current,proposed) {
 return Object.entries(proposed).filter(([key,value])=>present(value)&&JSON.stringify(current[key])!==JSON.stringify(value)).map(([key,value])=>({key,value,existing:current[key],selected:!present(current[key])}));
}
// Only explicitly selected sections are replaced. Existing sections default off.
export function selectedProfileFields(choices,selected) {
 return Object.fromEntries(choices.filter(choice=>selected.includes(choice.key)).map(({key,value})=>[key,value]));
}
export function resumeParserUrl(base) {
 if(!base)throw Error('Resume autofill is not configured yet. Your uploaded file is saved.');
 const url=new URL(base);
 if(url.username||url.password||url.search||url.hash||!['https:','http:'].includes(url.protocol)||(url.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw Error('Resume autofill requires HTTPS or a local development API.');
 return new URL('/v1/resume-import',url).href;
}
export async function requestResumeParse({client,getOwner,resumeId,apiUrl,request=fetch}) {
 validateResumeParse({resumeId});
 const owner=getOwner();const check=()=>{if(!owner||getOwner()!==owner)throw Error('Account changed. Start the import again.');};check();
 const {data,error}=await client.auth.getSession();check();
 if(error||!data.session?.access_token)throw Error('Sign in before importing a resume.');
 let response;
 try{response=await request(resumeParserUrl(apiUrl),{method:'POST',headers:{Authorization:'Bearer '+data.session.access_token,'Content-Type':'application/json'},body:JSON.stringify({resumeId}),signal:AbortSignal.timeout(60000),redirect:'error'});}catch(e){check();if(e.message?.includes('configured')||e.message?.includes('HTTPS'))throw e;throw Error('Resume autofill could not connect. Your file is saved; try again when the local backend is available.');}
 check();const body=await response.json();check();
 if(!response.ok)throw Error(body.error||'Resume parsing failed. Your uploaded file is saved.');
 if(!body.data?.facts||body.data.resumeId!==resumeId||(body.data.profileUpdatedAt!==null&&typeof body.data.profileUpdatedAt!=='string'))throw Error('Invalid resume extraction response.');
 return body.data;
}
