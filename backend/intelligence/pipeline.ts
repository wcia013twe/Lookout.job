import type {Store,EmbeddingProvider} from './types.ts';
import type {Candidate} from './types.ts';
import {clean} from './clean.ts';
export function validVector(v:unknown):v is number[]{return Array.isArray(v)&&v.length===1536&&v.every(x=>typeof x==='number'&&Number.isFinite(x))&&v.some(x=>x!==0);}
export async function ingest(store:Store,provider:EmbeddingProvider|undefined,candidates:Candidate[]){
 const result={inserted:0,updated:0,skipped:0,failed:0,pendingEmbeddings:0,errors:[] as {index:number;code:string}[]};
 for(const [index,c] of candidates.entries()){
  try{
   const r=clean(c.observation,provider?.model??null,c.identities),old=await store.get(r.sourceType,r.sourceId);
   if(old&&r.sourceRevision<old.source_revision){result.skipped++;continue;}
   if(old&&r.sourceRevision===old.source_revision&&r.processingVersion===old.processing_version&&r.contentHash!==old.content_hash)throw Error('SOURCE_REVISION_CONFLICT');
   if(old&&r.contentHash===old.content_hash&&r.processingVersion===old.processing_version&&(!provider||r.embeddingModel===old.embedding_model)){result.skipped++;if(old.embedding_model===null)result.pendingEmbeddings++;continue;}
   const vector=provider?await provider.embed(r.embeddingText):null;
   if(provider&&!validVector(vector))throw Error('INVALID_VECTOR');
   await store.save(r,vector);result[old?'updated':'inserted']++;if(!provider)result.pendingEmbeddings++;
  }catch(error){result.failed++;const code=error instanceof Error&&/^[A-Z_]{1,60}$/.test(error.message)?error.message:'PROCESSING_FAILED';result.errors.push({index,code});}
 }
 return result;
}
export function openAIProvider(key:string|undefined,request:typeof fetch=fetch):EmbeddingProvider{
 return {model:'text-embedding-3-small',async embed(input){
  if(!key)throw Error('OPENAI_KEY_MISSING');
  const response=await request('https://api.openai.com/v1/embeddings',{method:'POST',signal:AbortSignal.timeout(30000),headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:'text-embedding-3-small',dimensions:1536,input})});
  if(!response.ok)throw Error('EMBEDDING_PROVIDER_FAILED');
  const body=await response.json() as any;
  if(!validVector(body.data?.[0]?.embedding))throw Error('INVALID_VECTOR');
  return body.data[0].embedding;
 }};
}
