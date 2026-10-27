import {createGatewayClient} from '../../runner/gateway-client.mjs';
import {createLocalRuntime,createBrowserProvider} from '../../runner/runtime.mjs';
import {SUBMISSION_SCOPES,SUBMISSION_TOOLS} from '../../supabase/functions/agent-gateway/submission-batches.mjs';
import type {Payload} from './types.ts';
import type {Reply} from './service.ts';
type Dispatch=(token:string,operation:string,payload:Payload)=>Promise<Reply>;
// Each request owns its browser and token. No shared account page or stored credentials.
export function createSubmissionService({dispatch,projectUrl,browserFactory=()=>createBrowserProvider({headless:true,executablePath:process.env.LOOKOUT_CHROMIUM_EXECUTABLE}),gatewayFactory=(token:string)=>createGatewayClient({token,projectUrl})}:{dispatch:Dispatch;projectUrl:string;browserFactory?:()=>any;gatewayFactory?:(token:string)=>any}){
 let active=0;
 return async(token:string,operation:string,payload:Payload):Promise<Reply>=>{
  if(!SUBMISSION_TOOLS.some((tool:any)=>tool.operation===operation))return dispatch(token,operation,payload);
  const auth=await dispatch(token,'credentials.verify',{});
  if(auth.status!==200)return auth;
  if(!SUBMISSION_SCOPES.every((scope:string)=>auth.data?.scopes?.includes(scope)))return {status:403,error:'Submission scopes required'};
  if(active>=2)return {status:429,error:'Submission capacity busy; inspect saved batch state before retrying.'};
  active++;let browser;
  try{browser=browserFactory();return await createLocalRuntime({gateway:gatewayFactory(token),...browser}).forward(token,operation,payload);}
  catch{return {status:503,error:'Submission response unavailable; read saved application/batch state before retrying.'};}
  finally{try{await browser?.close();}catch{}finally{active--;}}
 };
}
