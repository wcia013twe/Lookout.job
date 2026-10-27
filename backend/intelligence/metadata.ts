import type {MetadataFilters} from './types.ts';
export const METADATA_TOOL='search_demo_intelligence_metadata';
export const metadataTool={name:METADATA_TOOL,description:'Retrieve current permitted local reports by exact posting ID or company and role, with optional stage and reported-date bounds. Recent reported experiences first; unknown dates last. No embeddings or generated answers.',inputSchema:{type:'object',properties:{jobId:{type:'string',minLength:1,maxLength:200},company:{type:'string',minLength:1,maxLength:200},role:{type:'string',minLength:1,maxLength:200},stage:{type:'string',minLength:1,maxLength:200},fromDate:{type:'string',format:'date'},toDate:{type:'string',format:'date'},limit:{type:'integer',minimum:1,maximum:50}},anyOf:[{required:['jobId']},{required:['company','role']}],additionalProperties:false}} as const;
export function validateMetadataArgs(args:unknown):MetadataFilters&{limit:number}{
 if(!args||typeof args!=='object'||Array.isArray(args))throw Error('INVALID_ARGUMENT');
 if(Object.keys(args).some(k=>!Object.hasOwn(metadataTool.inputSchema.properties,k)))throw Error('UNKNOWN_ARGUMENT');
 const input=args as Record<string,unknown>,out:MetadataFilters={};
 for(const key of ['jobId','company','role','stage'] as const){
  if(input[key]===undefined)continue;
  if(typeof input[key]!=='string'||!(input[key] as string).trim()||(input[key] as string).length>200)throw Error('INVALID_METADATA_FILTER');
  out[key]=(input[key] as string).normalize('NFKC').trim().replace(/\s+/g,' ');
 }
 if(out.jobId&&!/^[a-zA-Z0-9][a-zA-Z0-9:_.-]{0,199}$/.test(out.jobId))throw Error('INVALID_JOB_ID');
 if(!out.jobId&&!(out.company&&out.role))throw Error('POSTING_SCOPE_REQUIRED');
 for(const key of ['fromDate','toDate'] as const){
  if(input[key]===undefined)continue;
  const value=input[key];
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw Error('INVALID_DATE');
  out[key]=value;
 }
 if(out.fromDate&&out.toDate&&out.fromDate>out.toDate)throw Error('INVALID_DATE_RANGE');
 const limit=input.limit??20;
 if(typeof limit!=='number'||!Number.isInteger(limit)||limit<1||limit>50)throw Error('INVALID_LIMIT');
 return {...out,limit};
}
// Internal SQL construction only: every caller value is bound, never interpolated.
// All context fields must match a single attachment, not unrelated attachments on one post.
export function metadataPredicate(filters:MetadataFilters,args:any[]){
 const conditions:string[]=[],root:string[]=[],context:string[]=[];
 const parameter=(v:unknown)=>`$${args.push(v)}`;
 if(filters.sourceKeys){
  conditions.push(`exists(select 1 from jsonb_to_recordset(${parameter(JSON.stringify(filters.sourceKeys))}::jsonb) as k("sourceType" text,"sourceId" text) where k."sourceType"=reports.source_type and k."sourceId"=reports.source_id)`);
 }
 if(filters.jobId)context.push(`ctx->>'jobId'=${parameter(filters.jobId)}`);
 for(const key of ['company','role','stage'] as const){
  if(filters[key]===undefined)continue;
  const p=parameter(filters[key]!.toLowerCase());
  root.push(`lower(reports.${key})=${p}`);
  context.push(`lower(${key==='stage'?"coalesce(ctx->>'stage',reports.stage)":`ctx->>'${key}'`})=${p}`);
 }
 if(context.length){
  const match=`exists(select 1 from jsonb_array_elements(reports.contexts) ctx where ${context.join(' and ')})`;
  conditions.push(filters.jobId?match:`((${root.join(' and ')}) or ${match})`);
 }
 if(filters.fromDate)conditions.push(`reports.experience_date>=${parameter(filters.fromDate)}::date`);
 if(filters.toDate)conditions.push(`reports.experience_date<=${parameter(filters.toDate)}::date`);
 return conditions.length?conditions.join(' and '):'true';
}
