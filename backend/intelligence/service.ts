import {createServer} from 'node:http';
import {pathToFileURL} from 'node:url';
import {databaseStore,localPool,lockedIngest} from './store.ts';
import {ingest,openAIProvider,fixtureProvider} from './pipeline.ts';
import {scheduleIngestion} from './schedule.ts';
import {demoCandidates} from './fixtures.ts';
export const INGEST_TOOL='ingest_demo_intelligence',LIST_TOOL='list_demo_intelligence_reports';
export function demoService(pool:any,provider:any){return async(operation:string,args:Record<string,unknown>={})=>{
 if(operation===INGEST_TOOL){if(Object.keys(args).length)throw Error('UNKNOWN_ARGUMENT');return lockedIngest(pool,async store=>({embeddingModel:provider.model,...await ingest(store,provider,demoCandidates())}));}
 if(operation===LIST_TOOL){if(Object.keys(args).some(k=>k!=='limit'))throw Error('UNKNOWN_ARGUMENT');return {items:await databaseStore((sql,values)=>pool.query(sql,values)).list((args.limit??20) as number)};}
 throw Error('UNKNOWN_OPERATION');
};}
export function httpServer(call:(op:string,args:any)=>Promise<any>){return createServer(async(req,res)=>{
 res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
 try{
  if(req.headers.origin)throw Error('BROWSER_REQUEST_DENIED');
  if(req.method==='GET'&&req.url==='/healthz'){res.end(JSON.stringify({demo:true}));return;}
  if(req.method!=='POST'||req.url!=='/demo/intelligence') {res.writeHead(404).end('{}');return;}
  let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>4096)throw Error('REQUEST_TOO_LARGE');}
  const p=JSON.parse(body);if(!p||typeof p!=='object'||Object.keys(p).some(k=>!['operation','arguments'].includes(k))||!p.arguments||typeof p.arguments!=='object'||Array.isArray(p.arguments))throw Error('INVALID_REQUEST');
  res.end(JSON.stringify(await call(p.operation,p.arguments)));
 }catch(error){const code=error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:'BACKEND_FAILED';res.writeHead(code==='BACKEND_FAILED'?503:400).end(JSON.stringify({error:code}));}
});}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const pool=localPool(process.env.INTELLIGENCE_DATABASE_URL||'postgresql://postgres:postgres@127.0.0.1:54322/lookout_intelligence_demo');
 const call=demoService(pool,(process.argv.includes('--fixture-vectors')||process.env.INTELLIGENCE_VECTOR_MODE==='fixture')?fixtureProvider():openAIProvider(process.env.OPENAI_API_KEY));
 if(process.argv.includes('--schedule')){const stop=scheduleIngestion(()=>call(INGEST_TOOL,{}),result=>console.log(JSON.stringify({trigger:'scheduled',...result})));for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{stop();void pool.end();});}
 else if(process.argv.includes('--once')){try{console.log(JSON.stringify(await call(INGEST_TOOL,{})));}finally{await pool.end();}}
 else{const server=httpServer(call);server.listen(8091,process.env.INTELLIGENCE_HOST||'127.0.0.1',()=>console.error('Intelligence demo backend listening on 127.0.0.1:8091'));for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>server.close(()=>void pool.end()));}
}
