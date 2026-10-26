import pg from 'pg';
import type {Query,Report,Store} from './types.ts';
const columns='id,source_type,source_id,source_revision,content_kind,title,resource_links,contexts,post_references,company,role,stage,insight,experience_date,provenance,uncertainty,sharing_status,processing_version,embedding_model,created_at,updated_at,extensions.vector_dims(embedding) as embedding_dimensions';
export function databaseStore(query:Query):Store {
 return {
 async get(type,id){return (await query('select source_revision,content_hash,processing_version,embedding_model from intelligence_demo.intelligence_reports where source_type=$1 and source_id=$2',[type,id])).rows[0];},
 async save(r:Report,vector:number[]){await query(`insert into intelligence_demo.intelligence_reports(source_type,source_id,source_revision,company,role,stage,insight,experience_date,provenance,uncertainty,content_hash,processing_version,embedding_text,embedding,embedding_model,content_kind,title,resource_links,contexts,post_references)
 values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::extensions.vector,$15,$16,$17,$18::jsonb,$19::jsonb,$20::jsonb)
 on conflict(source_type,source_id) do update set source_revision=excluded.source_revision,company=excluded.company,role=excluded.role,stage=excluded.stage,insight=excluded.insight,experience_date=excluded.experience_date,provenance=excluded.provenance,uncertainty=excluded.uncertainty,content_hash=excluded.content_hash,processing_version=excluded.processing_version,embedding_text=excluded.embedding_text,embedding=excluded.embedding,embedding_model=excluded.embedding_model,content_kind=excluded.content_kind,title=excluded.title,resource_links=excluded.resource_links,contexts=excluded.contexts,post_references=excluded.post_references,updated_at=now()`,
 [r.sourceType,r.sourceId,r.sourceRevision,r.company,r.role,r.stage,r.insight,r.experienceDate,r.provenance,r.uncertainty,r.contentHash,r.processingVersion,r.embeddingText,JSON.stringify(vector),r.embeddingModel,r.contentKind,r.title,JSON.stringify(r.resourceLinks),JSON.stringify(r.contexts),JSON.stringify(r.postReferences)]);},
 async list(limit){if(!Number.isInteger(limit)||limit<1||limit>50)throw Error('INVALID_LIMIT');const rows=(await query(`select ${columns} from intelligence_demo.intelligence_reports order by source_type,source_id limit $1`,[limit])).rows;
  // These are typed pointers/snapshots only. This projection never resolves private records.
  return rows.map(row=>({...row,references:[
   ...row.contexts.map((context:Record<string,unknown>)=>({kind:'application_context',...context})),
   ...row.resource_links.map((resource:Record<string,unknown>)=>({kind:'resource',...resource})),
   ...row.post_references.map((post:Record<string,unknown>)=>({kind:'post',resolved:false,...post})),
  ]}));}
 };
}
export function localPool(url:string){
 const u=new URL(url);
 if(!['postgres:','postgresql:'].includes(u.protocol)||!['localhost','127.0.0.1','host.docker.internal'].includes(u.hostname)||u.pathname!=='/lookout_intelligence_demo')throw Error('LOCAL_DEMO_DATABASE_REQUIRED');
 return new pg.Pool({connectionString:url,max:3,connectionTimeoutMillis:5000});
}
export async function lockedIngest<T>(pool:pg.Pool,run:(store:Store)=>Promise<T>){
 const client=await pool.connect();
 try{
  const lock=await client.query('select pg_try_advisory_lock(19842761) as locked');
  if(!lock.rows[0].locked)return {status:'already_running'};
  try{return await run(databaseStore((sql,values)=>client.query(sql,values)));}
  finally{await client.query('select pg_advisory_unlock(19842761)');}
 }finally{client.release();}
}
