import pg from 'pg';
import {validVector} from './pipeline.ts';
import type {Query,Report,Store,StoreTarget} from './types.ts';
const columns=`id,source_type,source_id,source_revision,content_kind,title,resource_links,contexts,post_references,company,role,stage,insight,experience_date,provenance,uncertainty,sharing_status,processing_version,embedding_model,created_at,updated_at,extensions.vector_dims(embedding) as embedding_dimensions,case when embedding is null then 'pending' else 'ready' end as embedding_status`;
export function databaseStore(query:Query,target:StoreTarget):Store {
 if(!target||!['demo','account'].includes(target.kind))throw Error('INVALID_STORE_TARGET');
 if(target.kind==='account'&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target.ownerId))throw Error('INVALID_OWNER');
 const table=target.kind==='account'?'private.intelligence_reports':'intelligence_demo.intelligence_reports';
 const owner=target.kind==='account'?target.ownerId:null;
 return {
 async get(type,id){return (await query(`select source_revision,content_hash,processing_version,embedding_model from ${table} where source_type=$1 and source_id=$2${owner?' and owner_id=$3':''}`,owner?[type,id,owner]:[type,id])).rows[0];},
 async save(r:Report,vector:number[]|null){
  if(owner&&r.embeddingModel?.startsWith('fixture-'))throw Error('FIXTURE_EMBEDDINGS_NOT_ALLOWED');
  await query(`insert into ${table}(source_type,source_id,source_revision,company,role,stage,insight,experience_date,provenance,uncertainty,content_hash,processing_version,embedding_text,embedding,embedding_model,content_kind,title,resource_links,contexts,post_references${owner?',owner_id':''})
 values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::extensions.vector,$15,$16,$17,$18::jsonb,$19::jsonb,$20::jsonb${owner?',$21':''})
 on conflict(${owner?'owner_id,':''}source_type,source_id) do update set source_revision=excluded.source_revision,company=excluded.company,role=excluded.role,stage=excluded.stage,insight=excluded.insight,experience_date=excluded.experience_date,provenance=excluded.provenance,uncertainty=excluded.uncertainty,content_hash=excluded.content_hash,processing_version=excluded.processing_version,embedding_text=excluded.embedding_text,embedding=excluded.embedding,embedding_model=excluded.embedding_model,content_kind=excluded.content_kind,title=excluded.title,resource_links=excluded.resource_links,contexts=excluded.contexts,post_references=excluded.post_references,updated_at=now()`,
 [r.sourceType,r.sourceId,r.sourceRevision,r.company,r.role,r.stage,r.insight,r.experienceDate,r.provenance,r.uncertainty,r.contentHash,r.processingVersion,r.embeddingText,(vector===null?null:JSON.stringify(vector)),r.embeddingModel,r.contentKind,r.title,JSON.stringify(r.resourceLinks),JSON.stringify(r.contexts),JSON.stringify(r.postReferences),...(owner?[owner]:[])]);},
 async list(limit,current,search){
  if(!Number.isInteger(limit)||limit<1||limit>50)throw Error('INVALID_LIMIT');
  // Account reads require freshly authorized source fingerprints. Filter before LIMIT.
  if(owner&&!current)throw Error('CURRENT_SOURCES_REQUIRED');
  const visibility=owner?` where owner_id=$2 and exists (
   select 1 from jsonb_to_recordset($3::jsonb) as current(source_type text,source_id text,content_hash text,processing_version text)
   where current.source_type=reports.source_type and current.source_id=reports.source_id
    and current.content_hash=reports.content_hash and current.processing_version=reports.processing_version)` : '';
  const fingerprints=current?.map(r=>({source_type:r.sourceType,source_id:r.sourceId,content_hash:r.contentHash,processing_version:r.processingVersion}));
  const args:any[]=owner?[limit,owner,JSON.stringify(fingerprints)]:[limit];
  let filter=visibility, projection=columns, order='source_type,source_id';
  if(search){
   if(!validVector(search.vector))throw Error('INVALID_VECTOR');
   if(!Number.isFinite(search.minSimilarity)||search.minSimilarity<0||search.minSimilarity>1)throw Error('INVALID_SIMILARITY');
   const v=args.push(JSON.stringify(search.vector)),m=args.push(search.model),cutoff=args.push(search.minSimilarity);
   const score=`(1 - (embedding OPERATOR(extensions.<=>) $${v}::extensions.vector))`;
   filter+=`${owner?' and':' where'} embedding is not null and embedding_model=$${m} and ${score}>=$${cutoff}`;
   projection+=`, ${score} as similarity`;
   order='similarity desc,source_type,source_id';
  }
  const rows=(await query(`select ${projection} from ${table} as reports${filter} order by ${order} limit $1`,args)).rows;
  // These are typed pointers/snapshots only. This projection never resolves private records.
  return rows.map(row=>({...row,references:[
   ...row.contexts.map((context:Record<string,unknown>)=>({kind:'application_context',...context})),
   ...row.resource_links.map((resource:Record<string,unknown>)=>({kind:'resource',...resource})),
   ...row.post_references.map((post:Record<string,unknown>)=>({kind:'post',resolved:false,...post})),
  ]}));}
 };
}
export function localPool(url:string,database='lookout_intelligence_demo'){
 let u:URL;try{u=new URL(url);}catch{throw Error('LOCAL_DEMO_DATABASE_REQUIRED');}
 if(!['postgres:','postgresql:'].includes(u.protocol)||!['localhost','127.0.0.1','host.docker.internal'].includes(u.hostname)||!['lookout_intelligence_demo','postgres'].includes(database)||u.pathname!==`/${database}`)throw Error('LOCAL_DEMO_DATABASE_REQUIRED');
 return new pg.Pool({connectionString:url,max:3,connectionTimeoutMillis:5000});
}
export async function lockedIngest<T>(pool:pg.Pool,run:(store:Store)=>Promise<T>,target:StoreTarget){
 const client=await pool.connect();
 try{
  const lock=await client.query('select pg_try_advisory_lock(19842761) as locked');
  if(!lock.rows[0].locked)return {status:'already_running'};
  try{return await run(databaseStore((sql,values)=>client.query(sql,values),target));}
  finally{await client.query('select pg_advisory_unlock(19842761)');}
 }finally{client.release();}
}
