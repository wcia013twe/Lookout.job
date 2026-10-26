// Closed backend work requests. SQL owns ownership, scopes, idempotency and leases.
const uuidPattern='^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$';
const uuid={type:'string',pattern:uuidPattern};
const profile={type:'string',pattern:'^[a-zA-Z0-9_-]{1,80}$',minLength:1,maxLength:80};
const object=(properties,required=Object.keys(properties))=>({type:'object',properties,required,additionalProperties:false});
const input=object({profileId:profile});
const kind={type:'string',enum:['search_ats']};
const eventKey={type:'string',minLength:1,maxLength:160,description:'Stable nonempty retry key for this exact request.'};
const currentVersion={type:'integer',minimum:1};
const execution='Requires a configured Node API, worker and backend-job migration; tool discovery alone does not prove the worker is running. search_ats executes one bounded collect → verify → screen → deduplicate job against the saved owned profile, persists screenings and shortlist IDs in result.shortlist (pipelineVersion 1), and retains diagnostics. Partial source coverage remains explicit. Muse writes reports and four ratings afterward. It never applies, sends messages or runs an LLM.';
export const BACKEND_TOOLS=[
  {name:'submit_backend_job',operation:'backend.jobs.submit',scope:'preferences:write',requiredScopes:['workspace:read','drafts:write'],description:'Queue an authorized bounded ATS search for one saved active profile. Requires workspace:read, preferences:write and drafts:write. Connection identity is derived from the current credential; do not supply connectionId. '+execution,inputSchema:object({kind,input,eventKey})},
  {name:'read_backend_jobs',operation:'backend.jobs.read',scope:'workspace:read',readOnly:true,description:'Read owned backend-job states, versions, results and safe diagnostics; optionally select one job. A queued or running job is not a completed search. No lease secrets are returned. '+execution,inputSchema:object({jobId:uuid},[])},
  {name:'cancel_backend_job',operation:'backend.jobs.cancel',scope:'preferences:write',requiredScopes:['workspace:read','drafts:write'],description:'Request cancellation of an owned queued/running backend job at its current expectedVersion. Requires workspace:read, preferences:write and drafts:write. A completed job cannot be rewritten; cancellation does not retract prior saved work.',inputSchema:object({jobId:uuid,expectedVersion:currentVersion})},
  {name:'save_backend_schedule',operation:'backend.schedules.save',scope:'preferences:write',requiredScopes:['workspace:read','drafts:write'],description:'Only on explicit user authorization, create or update an owned interval ATS-search schedule. Use expectedVersion 0 for creation or the current positive version for updates; preserve the stable eventKey on retries. Requires workspace:read, preferences:write and drafts:write. The credential binds the connection. Enabled schedules run only while the configured worker is running and its connection remains valid; this does not activate existing My Agent routines or grant messaging, browser or application permissions. '+execution,inputSchema:object({id:uuid,kind,input,intervalMinutes:{type:'integer',minimum:15,maximum:10080},enabled:{type:'boolean'},expectedVersion:{type:'integer',minimum:0},eventKey},['kind','input','intervalMinutes','enabled','expectedVersion','eventKey'])},
  {name:'read_backend_schedules',operation:'backend.schedules.read',scope:'workspace:read',readOnly:true,description:'Read owned backend interval schedules and their current versions. Saved enabled state does not prove the worker is running or that a search completed. These are separate from personal-agent runtime schedules.',inputSchema:object({})},
];
export const BACKEND_OPERATIONS=BACKEND_TOOLS.map(tool=>tool.operation);
const isObject=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const isUuid=value=>typeof value==='string'&&new RegExp(uuidPattern).test(value);
export function validateBackendJob(operation,payload,{allowHumanConnection=false}={}) {
  const tool=BACKEND_TOOLS.find(tool=>tool.operation===operation);
  if(!tool)return false;
  if(!isObject(payload))throw Error('Backend job payload must be an object');
  const browserWrite=allowHumanConnection&&['backend.jobs.submit','backend.schedules.save'].includes(operation);
  const allowed=[...Object.keys(tool.inputSchema.properties),...(browserWrite?['connectionId']:[])];
  if(Object.keys(payload).some(key=>!allowed.includes(key))||tool.inputSchema.required.some(key=>!Object.hasOwn(payload,key)))throw Error('Missing or unknown backend job argument');
  if(browserWrite&&!isUuid(payload.connectionId))throw Error('Owned backend connection ID required');
  for(const key of ['id','jobId'])if(Object.hasOwn(payload,key)&&!isUuid(payload[key]))throw Error('Backend record UUID required');
  if(Object.hasOwn(payload,'kind')&&payload.kind!=='search_ats')throw Error('Only bounded search_ats jobs are supported');
  if(Object.hasOwn(payload,'input')&&(!isObject(payload.input)||Object.keys(payload.input).length!==1||!Object.hasOwn(payload.input,'profileId')||typeof payload.input.profileId!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(payload.input.profileId)))throw Error('A saved profile ID is the only backend job input');
  if(Object.hasOwn(payload,'eventKey')&&(typeof payload.eventKey!=='string'||!payload.eventKey.trim()||payload.eventKey.length>160||/[\u0000-\u001f]/.test(payload.eventKey)))throw Error('Stable eventKey required (1–160 characters, no control characters)');
  if(Object.hasOwn(payload,'expectedVersion')&&(!Number.isSafeInteger(payload.expectedVersion)||payload.expectedVersion<(operation==='backend.jobs.cancel'?1:0)))throw Error('Current backend record version required');
  if(operation==='backend.schedules.save') {
    if(!Number.isInteger(payload.intervalMinutes)||payload.intervalMinutes<15||payload.intervalMinutes>10080||typeof payload.enabled!=='boolean')throw Error('Schedule interval must be 15–10080 minutes with explicit enabled state');
    if(payload.id===undefined?payload.expectedVersion!==0:payload.expectedVersion<1)throw Error('New schedules use expectedVersion 0; updates need the current positive version');
  }
  return payload;
}
