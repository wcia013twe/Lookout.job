// Controlled Docker proof only: caller supplies one explicitly isolated fixture
// job. Provider replies are fictional; actual filtering, dedup, staging, fenced
// RPCs and shortlist persistence run unchanged. Never uses real account data.
import {createClient} from '@supabase/supabase-js';
import {workOnce} from './worker.ts';
import {executeCareerTask} from '../../runner/career-tools.mjs';
import type {Payload} from './types.ts';
const jobId=process.env.LOOKOUT_PROOF_JOB_ID,phase=process.env.LOOKOUT_PROOF_PHASE;
if(!jobId||!['interrupt','finish'].includes(phase||'')||process.env.LOOKOUT_PROOF_FIXTURE!=='fictional-3300')throw Error('Explicit fictional fixture required');
const client=createClient(process.env.SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,init)=>fetch(url,{...init,signal:AbortSignal.timeout(20000)})}});
const controller=new AbortController();let verified=0,collected=0,interrupted=false;
const raw=async(name:string,args:Payload)=>await client.rpc(name,args);
const rpc=async(name:string,args:Payload)=>{
 const result=await raw(name,args);
 if(args.operation==='claim'&&result.data?.job?.id!==jobId)throw Error('Fixture claim did not match the explicitly supplied job');
 if(phase==='interrupt'&&args.operation==='dispatch'&&args.payload.operation==='search.progress'&&args.payload.payload.counts.staged===3&&!result.error){interrupted=true;controller.abort(Error('Controlled container-replacement fixture'));}
 return result;
};
const make=(n:number)=>({company:'Example Staging Proof (fictional)',title:n<6?'Backend Engineer':'Senior Backend Engineer',location:'United States (Remote)',employmentType:'FT',url:`https://job-boards.greenhouse.io/lookout-proof/jobs/${n}`,description:n<3?'Build distributed systems and database infrastructure.':'Unrelated sales account management.',postedAt:null,listingIdentity:{ats_provider:'greenhouse',board_slug:'lookout-proof',posting_id:String(n)}});
const execute=async(task:string,input:Payload,options?:{signal?:AbortSignal})=>{
 if(task==='discovery'){
  const index=Number(input.target.id.split('-').at(-1));const jobs=Array.from({length:275},(_,i)=>make(index*275+i));collected+=jobs.length;
  return {status:'ok',available:275,truncated:false,jobs};
 }
 if(task==='verify-discovery-leads'){
  verified+=input.leads.length;const jobs=input.leads.map(({url}:Payload)=>make(Number(url.split('/').at(-1))));
  return {jobs,diagnostics:jobs.map((row:Payload)=>({url:row.url,status:'active',extraction:'parsed',reason:'Fictional official-response fixture; no external request.'}))};
 }
 return executeCareerTask(task,input,options);
};
await workOnce(rpc,{execute,signal:controller.signal});
console.log(JSON.stringify({fixture:'fictional-3300',phase,collectedThisProcess:collected,verifiedThisProcess:verified,interrupted}));
