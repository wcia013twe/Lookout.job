import {createHash} from 'node:crypto';
import {isIP} from 'node:net';
import {publicContextUrl} from '../../supabase/functions/agent-gateway/context-attachments.mjs';
import type {Observation,Report,ResourceLink,MatchingContext} from './types.ts';
export const PROCESSING_VERSION='clean-v2';
export function redact(text:string,identities:string[]=[]):string {
 let value=text.normalize('NFKC');
 for(const identity of identities.filter(Boolean).sort((a,b)=>b.length-a.length))value=value.replace(new RegExp(identity.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'),'[person]');
 return value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email]')
 .replace(/https?:\/\/[^\s<>]+/gi,'[link]')
 .replace(/(?:\+?\d[\d(). -]{7,}\d)/g,match=>match.replace(/\D/g,'').length>=10?'[phone]':match)
 .replace(/\s+/g,' ').trim();
}
// Preserve citations as structured metadata, never as credential-bearing free text.
function publicResourceUrl(value:unknown):string {
 if(typeof value!=='string'||!publicContextUrl(value))throw Error('INVALID_RESOURCE_URL');
 const url=new URL(value);
 const hostname=url.hostname.replace(/^\[|\]$/g,'');
 if(isIP(hostname)||!hostname.includes('.')||hostname.endsWith('.localhost')||hostname.endsWith('.local'))throw Error('INVALID_RESOURCE_URL');
 for(const key of [...url.searchParams.keys()]){
  if(/^(?:token|access_token|auth|authorization|apikey|api_key|key|signature|sig|code|email|credential|policy|expires|awsaccesskeyid)$|^x-amz-/i.test(key))throw Error('INVALID_RESOURCE_URL');
  if(/^utm_|^(?:gclid|fbclid)$/i.test(key))url.searchParams.delete(key);
 }
 return url.href;
}

export function clean(input:Observation,model:string,identities:string[]=[]):Report {
 const text=(value:unknown,max:number,nullable=false):string|null=>{
  if(nullable&&(value===null||value===undefined))return null;
  if(typeof value!=='string'||!value.trim()||value.length>max)throw Error('INVALID_TEXT');
  return redact(value,identities);
 };
 const contentKind=input.contentKind??'observation';
 if(!['observation','resource'].includes(contentKind))throw Error('INVALID_CONTENT_KIND');
 const resource=contentKind==='resource';
 if(!['circle_post','application_update'].includes(input.sourceType)||!Number.isSafeInteger(input.sourceRevision)||input.sourceRevision<1)throw Error('INVALID_SOURCE');
 if(typeof input.sourceId!=='string'||!/^[a-zA-Z0-9:_-]{1,200}$/.test(input.sourceId))throw Error('INVALID_SOURCE_ID');
 if(!['employer_verified','user_confirmed','agent_observed','agent_inferred','unknown'].includes(input.provenance))throw Error('INVALID_PROVENANCE');
 const date=input.experienceDate;
 if(date!==null&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date))throw Error('INVALID_DATE');
 const title=text(input.title,200,true);
 if(resource&&!title)throw Error('RESOURCE_TITLE_REQUIRED');
 const rawLinks=input.resourceLinks??[];
 if(!Array.isArray(rawLinks)||rawLinks.length>16||(!resource&&rawLinks.length))throw Error('INVALID_RESOURCE_LINKS');
 const links=new Map<string,ResourceLink>();
 for(const link of rawLinks){
  if(!link||typeof link!=='object'||Object.keys(link).some(key=>!['url','label'].includes(key)))throw Error('INVALID_RESOURCE_LINKS');
  const url=publicResourceUrl(link.url),label=text(link.label,200)!;
  if(!links.has(url))links.set(url,{url,label});
 }
 const resourceLinks=[...links.values()].sort((a,b)=>a.url.localeCompare(b.url));
 const rawContexts=input.contexts??[];
 if(!Array.isArray(rawContexts)||rawContexts.length>6)throw Error('INVALID_CONTEXTS');
 const contexts:MatchingContext[]=rawContexts.map(context=>{
  if(!context||typeof context!=='object'||Object.keys(context).some(key=>!['label','company','role','stage','jobId','jobUrl'].includes(key)))throw Error('INVALID_CONTEXTS');
  const item:MatchingContext={label:text(context.label,200)!};
  for(const key of ['company','role','stage','jobId'] as const)if(context[key]!==undefined)item[key]=text(context[key],200)!;
  if(context.jobUrl!==undefined)item.jobUrl=publicResourceUrl(context.jobUrl);
  return item;
 });
 const insight=resource&&typeof input.insight==='string'&&!input.insight.trim()?'':text(input.insight,resource?16000:4000)!;
 const r={sourceType:input.sourceType,sourceId:input.sourceId,sourceRevision:input.sourceRevision,contentKind,title,resourceLinks,contexts,
  company:text(input.company,200,resource),role:text(input.role,200,true),stage:text(input.stage,200,true),insight,experienceDate:date,
  provenance:input.provenance,uncertainty:text(input.uncertainty,1000,true)};
 if(!r.insight.replace(/\[(?:person|email|phone|link)\]/g,'').trim()&&!(resource&&resourceLinks.length))throw Error('EMPTY_INSIGHT');
 const contextText=contexts.map(context=>[context.label,context.company,context.role,context.stage,context.jobId].filter(Boolean).join(' / '));
 const embeddingText=[r.title,r.company,r.role,r.stage,r.insight,...resourceLinks.map(link=>link.label),...contextText,r.uncertainty].filter(Boolean).join(' | ');
 return {...r,contentHash:createHash('sha256').update(JSON.stringify(r)).digest('hex'),processingVersion:PROCESSING_VERSION,embeddingText,embeddingModel:model};
}
