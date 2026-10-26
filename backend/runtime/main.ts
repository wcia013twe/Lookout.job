import {setTimeout as delay} from 'node:timers/promises';
import {createClient} from '@supabase/supabase-js';
import {createResumeParser} from './resume-parser.ts';
import {createApi} from './api.ts';
import {createDispatch} from './service.ts';
import {runWorker} from './worker.ts';
import type {Rpc} from './types.ts';

const url=process.env.SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw Error('SUPABASE_URL and server-only SUPABASE_SERVICE_ROLE_KEY are required');
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:init?.signal??AbortSignal.timeout(20000)})}});
const rpc:Rpc=async(name,args)=>await client.rpc(name,args);
const controller=new AbortController();
process.once('SIGTERM',()=>controller.abort());process.once('SIGINT',()=>controller.abort());
const mode=process.env.LOOKOUT_PROCESS||'api';
if(mode==='worker'){
  if(process.env.LOOKOUT_EXECUTION_ENABLED==='true'){
    console.log('Lookout worker started; durable queue polling enabled.');
    await runWorker(rpc,controller.signal);
  }else{
    console.log('Lookout worker is idle; backend execution awaits service approval.');
    while(!controller.signal.aborted){try{await delay(30000,undefined,{signal:controller.signal});}catch{break;}}
  }
}else if(mode==='api'){
  const port=Number(process.env.PORT||8080);
  if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid PORT');
  const allowedHosts=(process.env.LOOKOUT_ALLOWED_HOSTS||'localhost,127.0.0.1,[::1]').split(',').map(s=>s.trim()).filter(Boolean);
  const allowedOrigins=(process.env.LOOKOUT_ALLOWED_ORIGINS||'http://localhost:3000,http://127.0.0.1:3000').split(',').map(s=>s.trim()).filter(Boolean);
  const parser=createResumeParser({client});
  const server=createApi({dispatch:createDispatch({rpc,supabaseUrl:url,parseResume:parser.agent}),parseHuman:parser.human,allowedHosts,allowedOrigins});
  server.listen(port,'0.0.0.0',()=>console.log(`Lookout MCP API listening on port ${port}.`));
  controller.signal.addEventListener('abort',()=>{server.close();server.closeIdleConnections();setTimeout(()=>server.closeAllConnections(),25000).unref();},{once:true});
}else throw Error('LOOKOUT_PROCESS must be api or worker');
