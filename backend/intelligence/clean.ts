import {createHash} from 'node:crypto';
import type {Observation,Report} from './types.ts';
export const PROCESSING_VERSION='clean-v1';
export function redact(text:string,identities:string[]=[]):string {
 let value=text.normalize('NFKC');
 for(const identity of identities.filter(Boolean).sort((a,b)=>b.length-a.length))value=value.replace(new RegExp(identity.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'),'[person]');
 return value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email]')
 .replace(/https?:\/\/[^\s<>]+/gi,'[link]')
 .replace(/(?:\+?\d[\d(). -]{7,}\d)/g,match=>match.replace(/\D/g,'').length>=10?'[phone]':match)
 .replace(/\s+/g,' ').trim();
}
export function clean(input:Observation,model:string,identities:string[]=[]):Report {
 const text=(value:unknown,max:number,nullable=false):string|null=>{
  if(nullable&&(value===null||value===undefined))return null;
  if(typeof value!=='string'||!value.trim()||value.length>max)throw Error('INVALID_TEXT');
  return redact(value,identities);
 };
 if(!['circle_post','application_update'].includes(input.sourceType)||!Number.isSafeInteger(input.sourceRevision)||input.sourceRevision<1)throw Error('INVALID_SOURCE');
 if(typeof input.sourceId!=='string'||!/^[a-zA-Z0-9:_-]{1,200}$/.test(input.sourceId))throw Error('INVALID_SOURCE_ID');
 if(!['employer_verified','user_confirmed','agent_observed','agent_inferred','unknown'].includes(input.provenance))throw Error('INVALID_PROVENANCE');
 const date=input.experienceDate;
 if(date!==null&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date))throw Error('INVALID_DATE');
 const r:Observation={sourceType:input.sourceType,sourceId:input.sourceId,sourceRevision:input.sourceRevision,
 company:text(input.company,200)!,role:text(input.role,200,true),stage:text(input.stage,200,true),insight:text(input.insight,4000)!,experienceDate:date,
 provenance:input.provenance,uncertainty:text(input.uncertainty,1000,true)};
 if(!r.insight.replace(/\[(?:person|email|phone|link)\]/g,'').trim())throw Error('EMPTY_INSIGHT');
 const embeddingText=[r.company,r.role,r.stage,r.insight,r.uncertainty].filter(Boolean).join(' | ');
 return {...r,contentHash:createHash('sha256').update(JSON.stringify(r)).digest('hex'),processingVersion:PROCESSING_VERSION,embeddingText,embeddingModel:model};
}
