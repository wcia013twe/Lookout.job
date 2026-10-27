// Fictional read-only execution journals. They never invoke browsers or accounts.
export function readDemoSubmissionBatches({batchId}={}){
 const states=[['completed','Submitted','confirmed'],['partial','Needs you','uncertain'],['running','Not submitted',null]];
 return {batches:states.map(([status,itemStatus,attemptState],index)=>({id:`demo-submission-batch-${index}`,fictional:true,status,version:1,input:[{applicationId:`demo-application-${index}`,expectedRevision:1}],results:status==='running'?{}:{[`demo-application-${index}`]:{applicationId:`demo-application-${index}`,status:itemStatus,attemptState,revision:1,reason:attemptState==='uncertain'?'Fictional timeout; verify before retry.':''}}})).filter(batch=>!batchId||batch.id===batchId)};
}
