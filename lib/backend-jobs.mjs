import {validateBackendJob} from '../supabase/functions/agent-gateway/backend-jobs.mjs';
import {callApi} from './api-failure.mjs';
export {BACKEND_TOOLS,BACKEND_OPERATIONS,validateBackendJob} from '../supabase/functions/agent-gateway/backend-jobs.mjs';

// Authenticated browser adapter. Database derives ownership from auth.uid();
// no service-role key, owner field, worker action or lease token is accepted here.
export function createBackendJobsService({rpc,owner}) {
  const action=async(operation,payload={})=>{
    validateBackendJob(operation,payload,{allowHumanConnection:true});
    const id=await owner();
    const response=await rpc('backend_job_action',{operation,payload});
    if(await owner()!==id)throw Error('Account changed');
    return callApi(operation,async()=>response,data=>!!data&&typeof data==='object'&&
      (operation==='backend.jobs.read'?Array.isArray(data.jobs):typeof data.id==='string'));
  };
  return {
    submit:payload=>action('backend.jobs.submit',payload),
    read:(payload={})=>action('backend.jobs.read',payload),
    cancel:payload=>action('backend.jobs.cancel',payload),
  };
}
