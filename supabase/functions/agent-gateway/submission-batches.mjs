const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const object=(properties,required=Object.keys(properties))=>({type:'object',properties,required,additionalProperties:false});
const string={type:'string'};
export const SUBMISSION_SCOPES=['workspace:read','drafts:write','approvals:read','resumes:read'];
const scopes={destructive:true,openWorld:true,scope:'drafts:write',requiredScopes:['workspace:read','approvals:read','resumes:read']};
export const SUBMISSION_TOOLS=[
 {name:'submit_application',operation:'local.submit',...scopes,description:'Execute one saved canonical native Greenhouse application with fresh backend authorization, pinned resume/form checks, atomic claim and one Submit click. No AI decisions run inside Node. Uncertain outcomes block retry. Read saved records after a timeout; do not click again.',inputSchema:object({applicationId:string,attemptId:string})},
 {name:'submit_application_batch',operation:'local.submit_batch',...scopes,description:'Execute 1–10 saved versioned applications sequentially through the same guarded runner. Pass eventKey and applications [{applicationId,expectedRevision}]. Each application is independently authorized; batching grants no consent. Durable per-item checkpoints survive disconnected clients. Read_application_batches before retrying the exact eventKey; an active lease returns busy, an expired lease resumes unfinished items using stable attempt IDs. Partial batches may contain HITL blockers. Correct those through scoped tools or human review, then submit a new eventKey/current revision. No search scheduler or background submission worker is activated.',inputSchema:object({eventKey:string,applications:{type:'array',minItems:1,maxItems:10,items:object({applicationId:string,expectedRevision:{type:'integer',minimum:0}})}})}
];
export const READ_SUBMISSION_BATCH_TOOL={name:'read_application_batches',operation:'submission.batch.read',scope:'workspace:read',readOnly:true,description:'Read up to 100 recent owned submission execution journals, or one batchId. Results come from saved application/attempt state. Running is not submitted; partial requires examining per-item outcomes and Action Board handoffs. No lease tokens, document bytes, or approval are returned.',inputSchema:object({batchId:string},[])};
export function validateSubmissionBatch(payload){
 if(!payload||typeof payload!=='object'||Array.isArray(payload)||Object.keys(payload).some(k=>!['eventKey','applications'].includes(k))||typeof payload.eventKey!=='string'||!payload.eventKey.trim()||payload.eventKey.length>160||/[\u0000-\u001f]/.test(payload.eventKey)||!Array.isArray(payload.applications)||!payload.applications.length||payload.applications.length>10)throw Error('Bounded application batch and stable eventKey required');
 for(const item of payload.applications)if(!item||typeof item!=='object'||Array.isArray(item)||Object.keys(item).some(k=>!['applicationId','expectedRevision'].includes(k))||!uuid(item.applicationId)||!Number.isSafeInteger(item.expectedRevision)||item.expectedRevision<0)throw Error('Versioned application references required');
 if(new Set(payload.applications.map(a=>a.applicationId.toLowerCase())).size!==payload.applications.length)throw Error('Duplicate applications');
 return payload;
}
export function validateSubmissionBatchOperation(operation,payload){
 if(!operation.startsWith('submission.batch.'))return;
 if(operation==='submission.batch.begin')return validateSubmissionBatch(payload);
 const keys=operation==='submission.batch.read'?['batchId']:['batchId','leaseToken','expectedVersion','applicationId'];
 if(!payload||typeof payload!=='object'||Array.isArray(payload)||Object.keys(payload).some(k=>!keys.includes(k))||Object.entries(payload).some(([key,value])=>key!=='expectedVersion'&&!uuid(value)))throw Error('Invalid batch arguments');
 if(operation==='submission.batch.read')return;
 if(!['submission.batch.touch','submission.batch.checkpoint'].includes(operation)||!keys.every(k=>Object.hasOwn(payload,k))||!Number.isSafeInteger(payload.expectedVersion)||payload.expectedVersion<1)throw Error('Versioned batch lease required');
}
