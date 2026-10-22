// Closed product actions. Shared by gateway validation and MCP discovery.
const string = {type:'string', maxLength:2000};
const timestamp = {type:['string','null'],description:'Exact updated_at from the current record, or null when creating.'};
const object = properties => ({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const json = {type:'object'};
export const PLATFORM_TOOLS = [
 ['replace_resume_source','resumes.source.replace','resumes:write','Replace a resume source with a newly uploaded owned immutable file ID. Requires resumes:write AND preferences:write. Preserves the display name, advances version, remaps saved defaults/role assignments, and keeps old application files intact. Upload/finalize the replacement first; pass the current old version. Does not approve or submit anything.',{resumeId:string,replacementId:string,expectedVersion:{type:'integer',minimum:1}}],
 ['add_resume_reference','resumes.reference.add','resumes:write','Save an owned HTTPS resume reference. This does not download a file or make it eligible for automatic submission.',{id:string,name:string,variant:string,version:{type:'integer',minimum:1},url:string}],
 ['create_resume_upload','resumes.upload.begin','resumes:write','Create an owned immutable PDF/DOCX upload intent and a short-lived signed upload URL. Upload bytes outside MCP, then finalize. Never log the URL.',{id:string,name:string,variant:string,version:{type:'integer',minimum:1},fileType:{type:'string',enum:['pdf','docx']},sizeBytes:{type:'integer',minimum:1,maximum:10485760},sha256:{type:'string',maxLength:64}}],
 ['finalize_resume_upload','resumes.upload.complete','resumes:write','Verify uploaded size, file signature and SHA-256 before registering the immutable owned resume.',{id:string}],
 ['list_contacts','contacts.read','workspace:read','Read owned contacts and outreach drafts. This tool never sends messages.',{}],
 ['save_contact','contacts.save','network:write','Create/update an owned contact and outreach draft under revision checking. Never sends outreach.',{id:string,record:json,expectedRevision:{type:'integer',minimum:0}}],
 ['delete_contact','contacts.delete','network:write','Soft-delete an owned contact at its current revision after the user requests removal.',{id:string,expectedRevision:{type:'integer',minimum:1}}],
 ['record_application_progress','applications.progress','tracking:write','Record a user-reported application outcome with source and note. Never creates an employer-confirmed receipt or human approval.',{applicationId:string,expectedRevision:{type:'integer',minimum:0},status:{type:'string',enum:['Submitted','Interview','Offer','Rejected','Withdrawn']},note:string,eventKey:string}],
 ['save_profile_facts','profile.save','profile:write','Save user-provided personal facts as unverified. Human verification is separate.',{facts:json,expectedUpdatedAt:timestamp}],
 ['save_saved_answer','answers.save','answers:write','Create/update an owned answer as unverified and always-ask. Cannot grant autofill consent.',{id:string,question:string,answer:string,companyScope:{type:['string','null']},expectedUpdatedAt:timestamp}],
 ['delete_saved_answer','answers.delete','answers:write','Delete an owned saved answer only after the user requests deletion; stale records reject.',{id:string,expectedUpdatedAt:timestamp}],
 ['save_company_tiers','preferences.tiers.save','preferences:write','Update company rankings under the user’s instructions, preserving other settings.',{tierLists:{type:'array',items:json,maxItems:20},activeTierListId:{type:['string','null']},expectedUpdatedAt:timestamp}],
 ['save_notification_preferences','preferences.notifications.save','preferences:write','Save delivery/schedule preferences. Does not create runtime schedules or send notifications.',{settings:json,expectedUpdatedAt:timestamp}],
 ['save_theme_preferences','preferences.theme.save','preferences:write','Save theme preferences, including pack texture and message templates, while preserving unrelated theme fields. Never alters application semantics.',{theme:json,expectedUpdatedAt:timestamp}],
 ['save_resume_preferences','preferences.resumes.save','preferences:write','Set owned resume defaults/rules. Does not upload or modify resume files.',{defaultResumeId:{type:['string','null']},resumeRules:{type:'array',items:json,maxItems:50},expectedUpdatedAt:timestamp}],
 ['list_jobs','jobs.list','workspace:read','Browse the shared catalog with bounded pagination. These are catalog records, not a live employer verification.',{limit:{type:'integer',minimum:1,maximum:100},offset:{type:'integer',minimum:0}}],
 ['read_batch','batches.read','workspace:read','Read an owned batch and its jobs. Null batchId reads the latest owned batch.',{batchId:{type:['string','null']}}],
 ['mark_batch_item','batches.item.mark','activity:write','Record that the user opened or saved an owned batch item. This is not application submission.',{batchId:string,jobId:string,action:{type:'string',enum:['opened','saved']}}],
 ['read_leaderboard','leaderboard.read','workspace:read','Read opted-in aliases and public aggregate metrics, never private candidate records.',{limit:{type:'integer',minimum:1,maximum:100}}],
 ['reconsider_opportunity','selection.reconsider.simple','activity:write','Record the user’s request to reconsider a previously skipped owned opportunity.',{id:string}],
 ['request_human_action','human.request','workspace:read','Return a specific website handoff for verification, approval, permissions, sharing, or account management. Does not execute the action.',{action:{type:'string',enum:['verify-profile','verify-answer','approve-application','resolve-submission','application-permission','community-sharing','manage-connections','sign-in','sign-out','configure-schedule','connect-social-source','send-outreach']},recordId:{type:['string','null']}}],
].map(([name,operation,scope,description,properties])=>({name,operation,scope,description,inputSchema:object(properties),readOnly:['contacts.read','jobs.list','batches.read','leaderboard.read','human.request'].includes(operation)}));
export function validatePlatformPayload(operation,payload) {
 const tool=PLATFORM_TOOLS.find(t=>t.operation===operation);
 if(!tool)return false;
 const {properties,required}=tool.inputSchema;
 if(Object.keys(payload).some(k=>!Object.hasOwn(properties,k)) || required.some(k=>!Object.hasOwn(payload,k)))throw Error('Missing or unknown product argument');
 for(const [key,schema] of Object.entries(properties)) {
  const value=payload[key], types=Array.isArray(schema.type)?schema.type:[schema.type];
  const type=value===null?'null':Array.isArray(value)?'array':typeof value==='number'&&Number.isInteger(value)?'integer':typeof value;
  if(!types.includes(type)||schema.enum&&!schema.enum.includes(value)||schema.maxLength&&value.length>schema.maxLength||schema.maxItems&&value.length>schema.maxItems||schema.minimum!==undefined&&value<schema.minimum||schema.maximum!==undefined&&value>schema.maximum)throw Error('Invalid '+key);
 }
 if(JSON.stringify(payload).length>100000)throw Error('Product payload too large');
 if(payload.expectedUpdatedAt!==undefined&&payload.expectedUpdatedAt!==null&&!Number.isFinite(Date.parse(payload.expectedUpdatedAt)))throw Error('Current timestamp required');
 if(operation==='resumes.source.replace' && (!['resumeId','replacementId'].every(k=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(payload[k]))||payload.resumeId===payload.replacementId))throw Error('Distinct owned resume IDs required');
 if(operation==='resumes.reference.add') { const url=new URL(payload.url); if(url.protocol!=='https:'||url.username||url.password)throw Error('HTTPS resume reference required'); }
 if(operation==='contacts.save' && (typeof payload.record.company!=='string'||!payload.record.company.trim()||payload.record.company.length>200))throw Error('Contact company required');
 if(operation==='resumes.upload.begin' && (!/^[a-f0-9]{64}$/i.test(payload.sha256) || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(payload.id)))throw Error('Resume ID and SHA-256 required');
 if(operation==='preferences.notifications.save'&&Object.keys(payload.settings).some(k=>!['quietMode','schedule'].includes(k)))throw Error('Only notification settings may be edited');
 return true;
}
