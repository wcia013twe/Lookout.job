import {initializeTracing, shutdownTracing, traceWork} from './tracing.ts';
import {setTimeout as delay} from 'node:timers/promises';
import {createClient} from '@supabase/supabase-js';
import {createResumeParser} from './resume-parser.ts';
import {createApi} from './api.ts';
// Temporarily disabled: Muse owns live application browser work.
// import {createSubmissionService} from './submission.ts';
// import {SUBMISSION_TOOLS} from '../../supabase/functions/agent-gateway/submission-batches.mjs';
import {createDispatch} from './service.ts';
import {createRecommendationLogger} from './recommendation-log.mjs';
// import {createApplicationExecutor} from './application-worker.ts';
import {runWorker,drainWorker} from './worker.ts';
import {cloudRunWakeup,maintenanceAuthorization} from './google-cloud.ts';
import {createMaintenance} from './maintenance.ts';
import type {Rpc} from './types.ts';

import {createOAuth,loadOAuthConfig} from './oauth.mjs';
import {createEvents} from './mcp-events.mjs';
import {startEventDelivery} from './mcp-event-delivery.mjs';

initializeTracing();
const url=process.env.SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw Error('SUPABASE_URL and server-only SUPABASE_SERVICE_ROLE_KEY are required');
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:init?.signal??AbortSignal.timeout(20000)})}});
const rpc:Rpc=async(name,args)=>await client.rpc(name,args);
const controller=new AbortController();
process.once('SIGTERM',()=>controller.abort());process.once('SIGINT',()=>controller.abort());
const mode=process.env.LOOKOUT_PROCESS||'api';
if(mode==='worker'||mode==='worker-once'){
  if(process.env.LOOKOUT_EXECUTION_ENABLED==='true'){
    console.log('Lookout worker started; durable queue polling enabled.');
    // AI Apply is picked up by Muse through the change feed, never by this worker.
    // Restore createApplicationExecutor only with an explicit orchestration change.
    if(mode==='worker-once'){
      try{await drainWorker(rpc,AbortSignal.any([controller.signal,AbortSignal.timeout(29*60*1000)]));}
      finally{await shutdownTracing();}
    }
    else await runWorker(rpc,controller.signal);
  }else{
    if(mode==='worker-once')throw Error('Finite discovery execution is disabled');
    console.log('Lookout worker is idle; backend execution awaits service approval.');
    while(!controller.signal.aborted){try{await delay(30000,undefined,{signal:controller.signal});}catch{break;}}
  }
}else if(mode==='api'){
  const port=Number(process.env.PORT||8080);
  if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid PORT');
  const allowedHosts=(process.env.LOOKOUT_ALLOWED_HOSTS||'localhost,127.0.0.1,[::1]').split(',').map(s=>s.trim()).filter(Boolean);
  const allowedOrigins=(process.env.LOOKOUT_ALLOWED_ORIGINS||'http://localhost:3000,http://127.0.0.1:3000').split(',').map(s=>s.trim()).filter(Boolean);
  const parser=createResumeParser({client});
  const requestBound=process.env.LOOKOUT_EVENT_DELIVERY_MODE==='request';
  if(process.env.LOOKOUT_EVENT_DELIVERY_MODE&&!['request','realtime'].includes(process.env.LOOKOUT_EVENT_DELIVERY_MODE))throw Error('Invalid event delivery mode');
  const wakeWorker=requestBound?cloudRunWakeup({project:process.env.LOOKOUT_GCP_PROJECT||'',region:process.env.LOOKOUT_GCP_REGION||'',job:process.env.LOOKOUT_CLOUD_RUN_JOB||''}):undefined;
  const authorizeMaintenance=requestBound?maintenanceAuthorization(process.env.LOOKOUT_MAINTENANCE_AUDIENCE||'',process.env.LOOKOUT_SCHEDULER_EMAIL||''):undefined;
  const dataDispatch=createDispatch({rpc,supabaseUrl:url,parseResume:parser.agent,recordExchange:createRecommendationLogger()??undefined,wakeWorker});
  // Deterministic submission remains implemented in submission.ts; registration is paused.
  // const dispatch=createSubmissionService({dispatch:dataDispatch,projectUrl:url});
  // const executionTools=SUBMISSION_TOOLS;
  let wakeEvents=()=>{};
  const events=createEvents({rpc,wake:()=>wakeEvents()});
  if(!requestBound)wakeEvents=startEventDelivery({client,events,signal:controller.signal});
  const maintenance=wakeWorker&&authorizeMaintenance?{authorize:authorizeMaintenance,run:createMaintenance({rpc,wakeWorker,deliver:()=>events.deliver()})}:undefined;
  const oauthConfig=await loadOAuthConfig();
  const oauth=oauthConfig?await createOAuth({config:oauthConfig,rpc,authenticateHuman:async(token:string)=>{
    // The verified existing human session is used only inside Lookout consent.
    let claims;try{claims=JSON.parse(Buffer.from(token.split('.')[1]||'','base64url').toString());}catch{return null;}
    if(claims.client_id||claims.role!=='authenticated'||claims.iss!==url+'/auth/v1')return null;
    const {data,error}=await client.auth.getUser(token);return error?null:data.user;
  }}):null;
  const server=createApi({maintenance,oauth,events:events.handle,readCount:(watchId:string)=>rpc('agent_pending_count',{watch_id:watchId}),dispatch:dataDispatch,executionTools:[],parseHuman:(token,payload)=>traceWork('parse-resume',{channel:'human'},()=>parser.human(token,payload),{type:'tool',summarize:()=>({status:'completed',reviewRequired:true})}),allowedHosts,allowedOrigins});
  server.listen(port,'0.0.0.0',()=>console.log(`Lookout MCP API listening on port ${port}.`));
  controller.signal.addEventListener('abort',()=>{server.close();server.closeIdleConnections();setTimeout(()=>server.closeAllConnections(),25000).unref();},{once:true});
}else throw Error('LOOKOUT_PROCESS must be api, worker or worker-once');
