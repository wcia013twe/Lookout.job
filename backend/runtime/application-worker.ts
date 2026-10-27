import {createHash} from 'node:crypto';
import {submissionDispatch} from '../../supabase/functions/agent-gateway/submission-dispatch.mjs';
import {prepareDraftWithPrefill} from '../../lib/application-prefill-service.mjs';
import {submitApplication} from '../../runner/submit.mjs';
import {createBrowserProvider} from '../../runner/runtime.mjs';
import {inspectBrowserForm} from '../../runner/browser.mjs';
import {openApplicationForm} from '../../runner/ats.mjs';
import {identifyJob} from '../../runner/forms.mjs';
import type {Rpc,Payload,Claim} from './types.ts';
type Browser={getPage:()=>Promise<any>;close:()=>Promise<void>};
type Download=(resume:Payload)=>Promise<Buffer>;
export function createApplicationExecutor({download,browserFactory=()=>createBrowserProvider({headless:true,executablePath:process.env.LOOKOUT_CHROMIUM_EXECUTABLE})}:{download:Download;browserFactory?:()=>Browser}){
 return async(claim:Claim,rpc:Rpc)=>{
  const {job}=claim,applicationId=job.input.applicationId;
  const fenced:Rpc=(name,args)=>{
   const {credential_hash,...safe}=args;
   return rpc('backend_worker',{operation:'application_dispatch',payload:{jobId:job.id,leaseToken:claim.leaseToken,expectedVersion:job.version,name,args:safe}});
  };
  const call=async(operation:string,payload:Payload={})=>{
   if(operation.startsWith('submission.')){
    const result=await submissionDispatch({operation,payload,credentialHash:claim.credentialHash,rpc:fenced});
    if(result.status!==200)throw Error(result.error);return result.data;
   }
   const result=await fenced('agent_dispatch',{operation,payload});if(result.error)throw Error('Application operation rejected');return result.data;
  };
  let browser:Browser|undefined;
  try{
   const raw=await fenced('runner_submission_context',{app_id:applicationId});
   if(raw.error||!raw.data?.application)throw Error('Application unavailable');
   let current=raw.data;
   // A resumed job reconciles its stable attempt before doing any new preparation.
   // Fresh jobs must match the revision requested by the user/agent.
   if(job.attempts===1&&current.application.revision!==job.input.expectedRevision)return {status:'partial',result:{summary:'Application changed before execution. Review the current draft before requesting another job.'}};
   browser=browserFactory();
   const draft=current.application.draft||{};
   if(!['Submitted','Interview','Offer','Rejected','Withdrawn','Blocked','Approved'].includes(current.application.status)&&(!draft.formFingerprint||!draft.resumeSha256||!draft.questions?.length)){
    const target=identifyJob(current.job.canonical_url);
    if(target.ats!=='greenhouse')throw Error('Unsupported application target');
    const page=await browser.getPage();await page.goto(target.url,{waitUntil:'domcontentloaded',timeout:30000});
    const entry=await openApplicationForm(page);if(entry.status==='Blocked')throw Error('Employer form unavailable');
    const form=await inspectBrowserForm(page);
    if(form.blockers.length)throw Error('Unsupported employer form');
    const questions=form.questions.flatMap((q:Payload)=>q.fields.map((field:Payload)=>({fieldId:field.id,fieldType:field.type,question:q.question,required:q.required,options:field.options||[],answer:''})));
    const prepared=await prepareDraftWithPrefill((operation:string,payload:Payload)=>fenced('agent_dispatch',{operation,payload}),{jobId:current.application.job_id,expectedRevision:current.application.revision,draft:{...draft,url:target.url,formFingerprint:form.formFingerprint,questions,inspectedAt:new Date().toISOString(),inspectionComplete:true},responseMode:'full'},{loadJob:async()=>current.job,loadApplication:async()=>current.application});
    if(prepared.error)throw Error('Draft preparation needs review');
   }
   const gateway={call,loadSubmissionContext:async(id:string)=>{
    const context=await call('submission.context',{applicationId:id});
    if(!context.allowed)return context;
    const resume=await call('resumes.read',{resumeId:context.application.draft.resumeId});
    if(resume.id!==context.resume?.id||!resume.object_path||!resume.object_path.startsWith(context.application.user_id+'/'))throw Error('Owned uploaded resume required');
    const bytes=await download(resume);
    if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>10*1024*1024||createHash('sha256').update(bytes).digest('hex')!==resume.content_hash)throw Error('Resume bytes changed');
    return {...context,resumeBytes:bytes};
   }};
   const outcome=await submitApplication({applicationId,attemptId:'job-'+job.id,gateway,getPage:browser.getPage});
   return {status:outcome.status==='Submitted'||outcome.status==='Already submitted'?'completed':'partial',result:{applicationId,outcome:outcome.status,reported:outcome.reported??true,summary:outcome.status==='Submitted'?'Employer confirmation recorded.':outcome.status==='Already submitted'?'Already recorded submitted; no new Submit click.':outcome.reason||outcome.message||'Application needs review. Read its current draft and Action Board before another attempt.'}};
  }catch{
   // No new click on recovery. Existing submitApplication owns uncertain outcomes.
   const raw=await fenced('runner_submission_context',{app_id:applicationId});
   if(!raw.error&&Number.isInteger(raw.data?.application?.revision)){
    const app=raw.data.application;
    if(!['Submitted','Interview','Offer','Rejected','Withdrawn','Blocked'].includes(app.status))await call('runner.report_failure',{applicationId,eventKey:'job-failure:'+job.id,expectedRevision:app.revision,stage:'playwright',outcome:'blocked',reason:'Application job could not complete its preparation or pre-click checks.',nextAction:'Muse should inspect the saved draft and resolve supported answers; review any personal choices in the Action Board.',attempts:[{stage:'playwright',status:'failed'}]}).catch(()=>{});
   }
   return {status:'partial',result:{applicationId,summary:'Application needs preparation or review. No confirmed submission was recorded; inspect the saved attempt before retrying.'}};
  }finally{await browser?.close().catch(()=>{});}
 };
}
