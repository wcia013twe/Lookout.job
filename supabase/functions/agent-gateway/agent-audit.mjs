// Observation storage and explicit self-checks only; no independent grading or authority.
const text={type:'string'};
const json={type:'object'};
export const AUDIT_FEATURES=['action_board','discover','applications','network','toolkit','setup','other'];
export const AUDIT_DIMENSIONS=['personalization','decision_quality','consistency','performance','safety'];
const benchmarkFields={schemaVersion:{type:'integer',enum:[1,2]},feature:{type:'string',enum:AUDIT_FEATURES},dimension:{type:'string',enum:AUDIT_DIMENSIONS},scenarioId:{type:'string',minLength:1,maxLength:200},checkId:{type:'string',minLength:1,maxLength:200}};
const object=(properties,required=[])=>({type:'object',properties,required,additionalProperties:false});
export const AUDIT_TOOLS=[
 {name:'start_agent_audit_run',operation:'audit.start',scope:'activity:write',requiredScopes:['workspace:read'],description:'Start a private immutable run log for an authorized task. Save task, area, live/controlled mode and available model/prompt/code/context versions in metadata. Stable eventKey replays identical requests; changed content rejects. Redact credentials and signed URLs. Logging grants no execution or approval authority.',inputSchema:object({eventKey:text,task:text,area:{type:'string',enum:AUDIT_FEATURES},mode:{type:'string',enum:['live','controlled']},metadata:json},['eventKey','task','area','mode'])},
 {name:'append_agent_audit_events',operation:'audit.append',scope:'activity:write',requiredScopes:['workspace:read'],description:'Append 1-25 private run events atomically, at most 200 KB/request and 128 KB/event data. Each stable eventKey replays exact content; changed retry rejects the batch. Use schemaVersion 2 with feature, optional dimension/scenarioId/checkId and structured data for context.loaded, decision, assertion and usage. Assertions are agent self-checks, never independent grades; read agent-audit for required payload fields. Legacy events remain supported. Never private chain-of-thought, credentials or signed URLs. Events are agent observations, never verified receipts. Large evidence needs redacted chunks with stable keys and chunk metadata.',inputSchema:object({runId:text,events:{type:'array',minItems:1,maxItems:25,items:object({...benchmarkFields,eventKey:text,kind:text,summary:text,toolName:text,occurredAt:{type:['string','null']},data:json},['eventKey','kind'])}},['runId','events'])},
 {name:'read_agent_audit_run',operation:'audit.read',scope:'workspace:read',readOnly:true,description:'Read an owned run and ordered immutable events, up to 20/page. Continue afterSequence=nextSequence while hasMore. Server sequence/time and connection identity record ingestion; event content and occurredAt remain agent-reported. Read back after uncertain logging writes. Actor is server-set agent on this API; assertions are self-checks. No independent grading or product-state changes.',inputSchema:object({runId:text,afterSequence:{type:'integer',minimum:0},limit:{type:'integer',minimum:1,maximum:20}},['runId'])},
];
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const bounded=(value,max,min=1)=>typeof value==='string'&&value.trim().length>=min&&value.length<=max;
function safe(value){
 if(typeof value==='string')return !/(jb_agent_[a-f0-9]{64}|Bearer [A-Za-z0-9._-]+|\/storage\/v1\/object\/sign\/|[?&]token=)/i.test(value);
 if(Array.isArray(value))return value.every(safe);
 if(plain(value))return Object.entries(value).every(([key,item])=>!['authorization','credential','credentialhash','apikey','accesstoken','refreshtoken','servicerolekey','signedurl','signedurls','password','secret','tokenhash'].includes(key.toLowerCase().replaceAll('_',''))&&safe(item));
 return true;
}
export function validateAudit(operation,payload){
 if(!operation.startsWith('audit.'))return;
 const tool=AUDIT_TOOLS.find(t=>t.operation===operation);
 if(!tool||!plain(payload)||Object.keys(payload).some(key=>!Object.hasOwn(tool.inputSchema.properties,key))||tool.inputSchema.required.some(key=>!Object.hasOwn(payload,key))||new TextEncoder().encode(JSON.stringify(payload)).length>200000)throw Error('Bounded audit arguments required');
 if(operation!=='audit.read'&&!safe(payload))throw Error('Redact credentials and signed URLs before logging');
 if(operation==='audit.start'){
  if(!bounded(payload.eventKey,200)||!bounded(payload.task,10000)||!AUDIT_FEATURES.includes(payload.area)||!['live','controlled'].includes(payload.mode)||payload.metadata!==undefined&&(!plain(payload.metadata)||new TextEncoder().encode(JSON.stringify(payload.metadata)).length>128000))throw Error('Invalid audit run');
  return;
 }
 if(!uuid(payload.runId))throw Error('Audit run UUID required');
 if(operation==='audit.read'){
  if(payload.afterSequence!==undefined&&(!Number.isSafeInteger(payload.afterSequence)||payload.afterSequence<0)||payload.limit!==undefined&&(!Number.isInteger(payload.limit)||payload.limit<1||payload.limit>20))throw Error('Invalid audit cursor or limit');
  return;
 }
 if(!Array.isArray(payload.events)||!payload.events.length||payload.events.length>25)throw Error('Audit event batch 1-25 required');
 for(const event of payload.events){
  if(!plain(event)||Object.keys(event).some(key=>!['eventKey','kind','summary','toolName','occurredAt','data',...Object.keys(benchmarkFields)].includes(key))||!bounded(event.eventKey,200)||typeof event.kind!=='string'||!/^[a-z][a-z0-9_.-]{0,79}$/.test(event.kind)||event.summary!==undefined&&!bounded(event.summary,4000,0)||event.toolName!==undefined&&!bounded(event.toolName,160)||event.occurredAt!=null&&(typeof event.occurredAt!=='string'||!/^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:\d{2})$/.test(event.occurredAt)||!Number.isFinite(Date.parse(event.occurredAt)))||event.data!==undefined&&(!plain(event.data)||new TextEncoder().encode(JSON.stringify(event.data)).length>128000))throw Error('Invalid audit event');
  validateBenchmarkEvent(event);
 }
}

function validateBenchmarkEvent(event){
 const version=event.schemaVersion??1, data=event.data??{};
 const refs=value=>Array.isArray(value)&&value.length<=50&&value.every(v=>bounded(v,200));
 if(![1,2].includes(version)||event.schemaVersion===null)throw Error('Audit schemaVersion 1 or 2 required');
 if(version===1){
  if(['feature','dimension','scenarioId','checkId'].some(k=>Object.hasOwn(event,k)))throw Error('Benchmark fields require schemaVersion 2');
  return;
 }
 if(!AUDIT_FEATURES.includes(event.feature)||event.dimension!==undefined&&!AUDIT_DIMENSIONS.includes(event.dimension)||['scenarioId','checkId'].some(k=>event[k]!==undefined&&!bounded(event[k],200)))throw Error('Invalid benchmark event envelope');
 if(event.kind==='context.loaded'&&(!Array.isArray(data.contextRefs)||data.contextRefs.length>50))throw Error('context.loaded requires contextRefs');
 if(event.kind==='decision'&&(!bounded(data.chosenAction,4000)||!bounded(data.justification,4000)||!Array.isArray(data.preferencesApplied)||data.preferencesApplied.length>50||!Array.isArray(data.evidenceRefs)||data.evidenceRefs.length>50))throw Error('Decision requires chosenAction, justification, preferencesApplied and evidenceRefs');
 if(event.kind==='assertion'&&(!event.dimension||!bounded(event.scenarioId,200)||!bounded(event.checkId,200)||data.evaluationSource!=='self_check'||!['pass','fail','not_applicable','not_evaluated'].includes(data.status)||!bounded(data.expected,4000)||!bounded(data.observed,4000)||!bounded(data.rubricVersion,200)||!refs(data.evidenceEventKeys)||['pass','fail'].includes(data.status)&&!data.evidenceEventKeys.length))throw Error('Assertion requires dimension, scenario/check IDs, self_check, status, expected, observed, rubricVersion and evidenceEventKeys');
 if(event.kind==='usage'){
  if(!['task','audit'].includes(data.metricsScope))throw Error('Usage requires task or audit metricsScope');
  for(const key of ['durationMs','toolCallCount','inputTokens','outputTokens','costUsd'])if(data[key]!=null&&(typeof data[key]!=='number'||!Number.isFinite(data[key])||data[key]<0||key!=='costUsd'&&!Number.isSafeInteger(data[key])))throw Error('Usage values must be nonnegative numbers (integer counts/time), or null');
 }
}
