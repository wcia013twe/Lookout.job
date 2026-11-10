// Agent-owned AI Apply pickup over the existing backend job journal.
const uuid={type:'string',format:'uuid'};
const version={type:'integer',minimum:1};
const revision={type:'integer',minimum:0};
const object=(properties,required=Object.keys(properties))=>({type:'object',properties,required,additionalProperties:false});
const scopes={scope:'drafts:write',requiredScopes:['workspace:read','preferences:write','approvals:read','resumes:read']};
const base={jobId:uuid,expectedVersion:version,expectedRevision:revision,eventKey:{type:'string',minLength:1,maxLength:160}};
export const APPLICATION_REQUEST_TOOLS=[
 {name:'claim_application_request',operation:'applications.request.claim',...scopes,description:'Claim the exact queued AI Apply request bound to this connection before host computer use. Read_backend_jobs and read_application_record first. Only one claim succeeds; no timed takeover or automatic retry. Use one host/subagent writer per application. Returns the saved running job, never full draft verification, browser credentials, approval or permission to submit. Retry an ambiguous call only with identical eventKey/payload; reread on conflict. Host workers sharing this connection must serialize across processes. Never reclaim terminal work.',inputSchema:object(base)},
 {name:'report_application_request',operation:'applications.request.report',...scopes,description:'Save the current owned AI Apply request outcome after verifying saved application work (an inspected full prepare_draft response may replace its immediate application read). For a real blocker, first save the owning application blocker/questions through report_application_failure or prepare_draft and verify its Need your input card with read_action_board; a blocked job report alone does not create that card. Always verify read_action_board before a human handoff. Use the post-blocker application revision; never reopen terminal requests. Pass current job/application versions and prepared, completed, blocked or uncertain plus a factual summary. Completed means agent task finished, never verified submission. Does not approve, create a submission receipt, or change application status. Uncertainty requires human verification; never requeue automatically. Reuse exact eventKey/payload on retry.',inputSchema:object({...base,outcome:{type:'string',enum:['prepared','completed','blocked','uncertain']},summary:{type:'string',minLength:1,maxLength:1000}})},
];
export function validateApplicationRequest(operation,p){
 const tool=APPLICATION_REQUEST_TOOLS.find(t=>t.operation===operation);if(!tool)return false;
 const schema=tool.inputSchema;
 if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).some(k=>!Object.hasOwn(schema.properties,k))||schema.required.some(k=>!Object.hasOwn(p,k))||!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(p.jobId||'')||!Number.isSafeInteger(p.expectedVersion)||p.expectedVersion<1||!Number.isSafeInteger(p.expectedRevision)||p.expectedRevision<0||typeof p.eventKey!=='string'||!p.eventKey.trim()||p.eventKey.length>160||/[\u0000-\u001f]/.test(p.eventKey))throw Error('Exact application request, versions and stable eventKey required');
 if(operation==='applications.request.report'&&(!['prepared','completed','blocked','uncertain'].includes(p.outcome)||typeof p.summary!=='string'||!p.summary.trim()||p.summary.length>1000))throw Error('Saved application outcome and factual summary required');
 return true;
}
