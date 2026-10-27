import {createHash} from 'node:crypto';
import {submitApplication} from '../runner/submit.mjs';
import {validateSubmissionBatch} from '../supabase/functions/agent-gateway/submission-batches.mjs';
export function submissionAttemptId(batchId,applicationId){return 'batch_'+createHash('md5').update(batchId+':'+applicationId.toLowerCase()).digest('hex');}
export async function submitApplicationBatch({payload,gateway,getPage}){
 validateSubmissionBatch(payload);
 const begun=await gateway.call('submission.batch.begin',payload);
 let batch=begun.batch;
 if(!begun.acquired)return {batch,busy:batch.status==='running',replayed:true};
 const leaseToken=begun.leaseToken;
 let current;
 const touch=async()=>{batch=await gateway.call('submission.batch.touch',{batchId:batch.id,leaseToken,expectedVersion:batch.version,applicationId:current.applicationId});};
 const scoped={
  loadSubmissionContext:async(id)=>{await touch();const context=await gateway.loadSubmissionContext(id);if(context.application.revision!==current.expectedRevision)return {...context,allowed:false,reason:'Draft changed after batching. Review the current revision before a new batch.'};return context;},
  call:async(operation,args)=>{if(['submission.claim','submission.start'].includes(operation))await touch();return gateway.call(operation,args);}
 };
 for(const item of batch.input){
  current=item;
  if(batch.results[item.applicationId.toLowerCase()])continue;
  await submitApplication({applicationId:item.applicationId,attemptId:submissionAttemptId(batch.id,item.applicationId),gateway:scoped,getPage});
  batch=await gateway.call('submission.batch.checkpoint',{batchId:batch.id,leaseToken,expectedVersion:batch.version,applicationId:item.applicationId});
 }
 return {batch,busy:false};
}
