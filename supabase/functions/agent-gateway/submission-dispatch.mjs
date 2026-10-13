import { authorizeSubmission } from './submission-authorization.mjs';
const errors = { '28000':401,'42501':403,'40001':409,'P0002':404,'22023':400 };
const rejected = error => ({status:errors[error?.code] || 400,error:'Submission operation rejected; refresh current state before retrying.'});
export async function submissionDispatch({operation,payload,credentialHash,rpc}) {
  if (operation==='submission.finish') {
    const result=await rpc('runner_submission_transition',{credential_hash:credentialHash,operation:'finish',p_payload:payload});
    return result.error ? rejected(result.error) : {status:200,data:result.data};
  }
  const read=await rpc('runner_submission_context',{credential_hash:credentialHash,app_id:payload.applicationId});
  if(read.error) return rejected(read.error);
  const context=read.data, decision=authorizeSubmission(context);
  if(operation==='submission.context') return {status:200,data:{application:context.application,job:context.job,resume:context.resume,approval:context.approval,personalVersion:context.personalVersion,...decision}};
  if(!decision.allowed) return {status:409,error:decision.reason};
  if(context.application.revision!==payload.expectedRevision || context.personalVersion!==payload.expectedPersonalVersion) return {status:409,error:'Application or settings changed; reload before execution.'};
  const result=await rpc('runner_submission_transition',{credential_hash:credentialHash,operation:operation==='submission.claim'?'claim':'start',p_payload:payload,expected_context:context,execution_authorization:decision.authorization});
  return result.error ? rejected(result.error) : {status:200,data:result.data};
}
