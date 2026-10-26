// Local account evaluation entrypoint. Never imports fictional source data or vector generators.
import {pathToFileURL} from 'node:url';
import {accountSourceLoader} from './account-sources.ts';
import {localPool} from './store.ts';
import {openAIProvider} from './pipeline.ts';
import {scheduleIngestion} from './schedule.ts';
import {ingestionService,httpServer} from './service.ts';
import {INGEST_TOOL} from './contract.ts';

export function accountEmbeddingProvider(mode='pending',key?:string){
 if(mode==='pending')return undefined;
 if(mode==='fixture')throw Error('FIXTURE_EMBEDDINGS_NOT_ALLOWED');
 if(mode!=='openai')throw Error('INVALID_EMBEDDING_MODE');
 if(!key)throw Error('OPENAI_KEY_REQUIRED');
 return openAIProvider(key);
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const ownerId=process.env.INTELLIGENCE_ACCOUNT_ID;
 if(!ownerId)throw Error('INTELLIGENCE_ACCOUNT_ID_REQUIRED');
 if(process.env.INTELLIGENCE_VECTOR_MODE==='fixture'||process.argv.includes('--fixture-vectors'))throw Error('FIXTURE_EMBEDDINGS_NOT_ALLOWED');
 const pool=localPool(process.env.INTELLIGENCE_SOURCE_DATABASE_URL||'postgresql://postgres:postgres@127.0.0.1:54322/postgres','postgres');
 const account=await pool.query('select email from auth.users where id=$1',[ownerId]);
 if(!account.rows[0]?.email?.endsWith('@example.test')){await pool.end();throw Error('LOCAL_TEST_ACCOUNT_REQUIRED');}
 const provider=accountEmbeddingProvider(process.env.INTELLIGENCE_VECTOR_MODE,process.env.OPENAI_API_KEY);
 const loader=accountSourceLoader((sql,values)=>pool.query(sql,values),ownerId);
 const call=ingestionService(pool,provider,loader,{kind:'account',ownerId});
 if(process.argv.includes('--schedule')){
  const stop=scheduleIngestion(()=>call(INGEST_TOOL),result=>console.log(JSON.stringify({trigger:'scheduled',...result})));
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{stop();void pool.end();});
 }else if(process.argv.includes('--once')){try{console.log(JSON.stringify(await call(INGEST_TOOL)));}finally{await pool.end();}}
 else{const server=httpServer(call);server.listen(8091,process.env.INTELLIGENCE_HOST||'127.0.0.1');for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close(()=>void pool.end()));}
}
