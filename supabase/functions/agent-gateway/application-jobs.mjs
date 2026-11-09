import {canonicalSubmissionTarget} from '../../../lib/submission-targets.mjs';
const object=(properties,required=Object.keys(properties))=>({type:'object',properties,required,additionalProperties:false});
const text={type:'string',minLength:1,maxLength:200};
export const APPLICATION_JOB_TOOL={name:'queue_application_job',operation:'applications.submit_job',scope:'drafts:write',requiredScopes:['workspace:read','preferences:write','approvals:read','resumes:read'],description:'Request Muse application work for one selected posting. Saves a durable queued job and change-feed pointer; no deterministic worker opens, fills or submits it. Muse must claim_application_request and read the saved draft. Reuse current preparation; call existing prepare_draft for missing/incomplete preparation, newly observed questions or relevant changed facts/materials. Preserve human answers and unchanged approvals. Then use authorized host computer use and report_application_request after saving an outcome or blocker. The click grants task intent, never approval. Reuse the exact eventKey/payload on retry. Requires the application-request migration and an independently configured Muse watcher/browser.',inputSchema:object({posting:object({id:text,url:{type:'string',maxLength:2048},company:text,title:text,employmentType:{type:'string',enum:['FT','Internship']},location:{type:'string',maxLength:1000}}),profileId:{type:'string',maxLength:80},expectedRevision:{type:'integer',minimum:0},eventKey:{type:'string',minLength:1,maxLength:160}},['posting','expectedRevision','eventKey'])};
export function validateApplicationJob(p){
 if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).some(k=>!['posting','profileId','expectedRevision','eventKey'].includes(k)))throw Error('One selected posting and stable eventKey required');
 const j=p.posting;
 if(!j||typeof j!=='object'||Array.isArray(j)||Object.keys(j).some(k=>!['id','url','company','title','employmentType','location'].includes(k))||['id','company','title'].some(k=>typeof j[k]!=='string'||!j[k].trim()||j[k].length>200)||!['FT','Internship'].includes(j.employmentType)||typeof j.location!=='string'||j.location.length>1000)throw Error('Bounded public employer facts required');
 if(typeof j.url!=='string'||j.url.length>2048)throw Error('Canonical employer URL required');
 canonicalSubmissionTarget(j.url);
 if(p.profileId!==undefined&&(typeof p.profileId!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(p.profileId)))throw Error('Saved profile ID required');
 if(!Number.isSafeInteger(p.expectedRevision)||p.expectedRevision<0||typeof p.eventKey!=='string'||!p.eventKey.trim()||p.eventKey.length>160||/[\u0000-\u001f]/.test(p.eventKey))throw Error('Current revision and stable eventKey required');
 return p;
}
