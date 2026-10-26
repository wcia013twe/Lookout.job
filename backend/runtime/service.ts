import {submitSearchLeads,readSearchSourceLeads} from './search-intake.ts';
import {screenSearchDiscoveries} from '../../lib/search-screening.mjs';
import {ResumeParseError} from './resume-parser.ts';
import {createHash} from 'node:crypto';
import {validateRequest} from '../../supabase/functions/agent-gateway/contract.mjs';
import {guideDispatch,guideDiscoveryDispatch} from '../../supabase/functions/agent-gateway/guides.mjs';
import {databaseFailure,validationMessage} from '../../supabase/functions/agent-gateway/request-errors.mjs';
import {operationService} from '../../lib/mcp-services.mjs';
import type {Rpc, Payload} from './types.ts';

export type Reply = {status: number; data?: any; error?: string};
export const credentialHash = (token: string) => createHash('sha256').update(token).digest('hex');
export function createDispatch({rpc,supabaseUrl,request=fetch,parseResume}: {rpc: Rpc; supabaseUrl: string; request?: typeof fetch;parseResume?:(token:string,payload:Payload)=>Promise<any>}) {
  const gateway=new URL('/functions/v1/agent-gateway',supabaseUrl);
  if(!['https:','http:'].includes(gateway.protocol) || (gateway.protocol==='http:' && !['127.0.0.1','localhost','kong','host.docker.internal'].includes(gateway.hostname))) throw Error('Use HTTPS Supabase or an explicit local development host');
  return async (token: string, operation: string, payload: Payload): Promise<Reply> => {
    if(!/^jb_agent_[a-f0-9]{64}$/.test(token))return {status:401,error:'Agent credential required'};
    try {validateRequest({operation,payload});}catch(error){return {status:400,error:validationMessage(error)};}
    const service=operationService(operation);
    if(!service)return {status:400,error:'No service owns this operation'};
    if(service.handler==='edge' && service.owner==='human connection management')return {status:403,error:'Use the human-authenticated connection management service'};
    const hash=credentialHash(token);
    const authorize=(_operation: string,_payload: Payload)=>rpc('agent_dispatch',{credential_hash:hash,operation:_operation,payload:_payload});
    try {
      if(operation==='resumes.parse'){
        if(!parseResume)return {status:503,error:'Resume parsing requires a configured Node service.'};
        try{return {status:200,data:await parseResume(token,payload)};}catch(e){return {status:e instanceof ResumeParseError?e.status:503,error:e instanceof ResumeParseError?e.message:'Resume parsing is unavailable.'};}
      }
      let result;
      if(service.handler==='queue-rpc')result=await rpc('backend_job_dispatch',{credential_hash:hash,operation,payload});
      else if(service.handler==='credential-rpc')result=await authorize(operation,payload);
      else if(operation==='search.source.leads')result=await readSearchSourceLeads(authorize,payload);
      else if(operation==='search.leads.submit')result=await submitSearchLeads(authorize,payload);
      else if(operation==='search.discoveries.screen')result=await screenSearchDiscoveries(authorize,payload);
      else if(operation==='guides.read')result=await guideDispatch(payload.id,authorize);
      else if(operation==='guides.discover')result=await guideDiscoveryDispatch(authorize);
      else {
        // Existing domain operations retain their exact gateway behavior during migration.
        const response=await request(gateway,{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({operation,payload})});
        const body=await response.json();
        return response.ok?{status:200,data:body.data}:{status:response.status,error:'Gateway operation rejected; read current state before retrying'};
      }
      if(result.error){const [status,error]=databaseFailure(result.error);return {status,error};}
      return {status:200,data:result.data};
    }catch{return {status:503,error:'Backend unavailable; read current state before retrying a write'};}
  };
}
