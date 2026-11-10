import {APPLICATION_AGENT_TOOLS} from '../agent-gateway/application-agent.mjs';
import {APPLICATION_REQUEST_TOOLS} from '../agent-gateway/application-requests.mjs';
import {mockRejection} from './mock-diagnostics.mjs';
import {PERMISSIONS_HANDOFF_TOOL} from '../agent-gateway/connection-permissions.mjs';
import {ACCESS_TOOLS,DEFAULT_TOOL_NAMES,toolWorkflow,publicTool,validAccessArguments} from './tool-surface.mjs';
import {AUDIT_TOOLS} from '../agent-gateway/agent-audit.mjs';
import {enabledMcpOperation} from '../../../lib/feature-scope.mjs';
import {APPLICATION_JOB_TOOL} from '../agent-gateway/application-jobs.mjs';
import {MUSE_CHANGE_TOOLS} from '../agent-gateway/muse-changes.mjs';
import {READ_SUBMISSION_BATCH_TOOL} from '../agent-gateway/submission-batches.mjs';
import {ACTION_BOARD_TOOL,TRACKER_ACTION_PROGRESS_TOOL} from '../agent-gateway/action-board.mjs';
import {ACTION_INBOX_TOOL} from '../agent-gateway/action-inbox.mjs';
import {WORK_EXPERIENCE_TOOL} from '../agent-gateway/work-experience.mjs';
import {SEARCH_INTAKE_TOOLS} from '../agent-gateway/search-intake.mjs';
import {SCREENING_TOOLS} from '../agent-gateway/search-screening.mjs';
import {requiredToolScopes,completeToolScopes} from './tool-scopes.mjs';
import {OPERATIONS,validateRequest} from '../agent-gateway/contract.mjs';
export {requiredToolScopes,CONDITIONAL_TOOL_SCOPES} from './tool-scopes.mjs';
import {BACKEND_TOOLS} from '../agent-gateway/backend-jobs.mjs';
import runtimeVersion from '../agent-gateway/runtime-version.json' with {type:'json'};
import {validateSearch} from '../agent-gateway/search.mjs';
import {IMPORT_TOOLS} from '../agent-gateway/simplify-import.mjs';
import { bootstrapInstructions } from '../agent-gateway/operating-guide.mjs';
import {RESET_HANDOFF_TOOL} from '../agent-gateway/workspace-reset.mjs';
import {BRIEF_TOOL} from '../agent-gateway/user-brief.mjs';
import {FIELD_UPDATE_TOOLS} from '../agent-gateway/field-updates.mjs';
import {MOCK_TOOLS,validateMock} from '../agent-gateway/mock-interviews.mjs';
import {ARTIFACT_TOOLS,validateArtifact} from '../agent-gateway/artifacts.mjs';
import {SEARCH_TOOLS} from '../agent-gateway/search.mjs';
import {profileFactsSchema,proposedAnswersSchema,resumeUploadSchema,batchSchema,activitySchema} from '../agent-gateway/write-schemas.mjs';
import { KNOWLEDGE_TOOLS } from '../agent-gateway/knowledge.mjs';
import { ONBOARDING_TOOLS } from "../agent-gateway/onboarding.mjs";
import { PLATFORM_TOOLS } from '../agent-gateway/platform-tools.mjs';
import { BUG_TOOL } from '../agent-gateway/bug-report.mjs';
import { BUG_STATUS_TOOL } from '../agent-gateway/bug-status.mjs';
// Stateless Streamable HTTP adapter. Gateway owns credential and payload policy;
// this module owns only MCP framing. No browser, SQL, shell, or management tools.
export const VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26'];
const object = (properties = {}, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const string = { type: 'string' };
const json = { type: 'object' };
export const TOOLS = [...APPLICATION_AGENT_TOOLS,...APPLICATION_REQUEST_TOOLS,ACTION_BOARD_TOOL,TRACKER_ACTION_PROGRESS_TOOL,...AUDIT_TOOLS,APPLICATION_JOB_TOOL,...MUSE_CHANGE_TOOLS,READ_SUBMISSION_BATCH_TOOL,ACTION_INBOX_TOOL,WORK_EXPERIENCE_TOOL,BUG_TOOL,BUG_STATUS_TOOL,...SEARCH_INTAKE_TOOLS,...SCREENING_TOOLS,...BACKEND_TOOLS,...IMPORT_TOOLS,RESET_HANDOFF_TOOL,PERMISSIONS_HANDOFF_TOOL,BRIEF_TOOL,...FIELD_UPDATE_TOOLS,...MOCK_TOOLS,...ARTIFACT_TOOLS,...SEARCH_TOOLS,
  {name:'read_toolkit_context',operation:'toolkit.context',scope:'workspace:read',readOnly:true,description:'Read owned profile, source preferences, applications with employer records, real milestones and toolkit history for executable scanners and analytics. Coverage limits are explicit; no signed file URLs.',inputSchema:object({applicationId:string})},
  {name:'read_toolkit_results',operation:'toolkit.results',scope:'workspace:read',readOnly:true,description:'Read the latest 100 owned toolkit results, optionally for an application/kind. Outputs are agent observations, never approvals or submission proof.',inputSchema:object({applicationId:string,kind:string})},
  {name:'record_toolkit_result',operation:'toolkit.record',scope:'drafts:write',description:'Save an owned scan/evaluation/analytics/ATS/document/source_config/compensation result with a stable eventKey. Exact retries replay; changed payload rejects. Evaluation requires owned application, score 1-5 and requirements [{requirement,match:met/partial/missing/unknown,evidence}]. Outputs never establish human verification or submission.',inputSchema:object({applicationId:string,kind:string,eventKey:string,result:json},['kind','eventKey','result'])},
  {name:'begin_career_document_upload',operation:'toolkit.file.begin',scope:'drafts:write',description:'Reserve an immutable private generated PDF. kind resume/cover_letter; resume also needs profile:write. Server chooses file ID/path. Never grants approval or changes the default resume.',inputSchema:object({applicationId:string,eventKey:string,kind:string,fileName:string,variant:string,sha256:string,bytes:{type:'integer'}},['eventKey','kind','fileName','sha256','bytes'])},
  {name:'complete_career_document_upload',operation:'toolkit.file.complete',scope:'drafts:write',description:'Verify actual PDF bytes/hash before finalizing an owned reservation. Resume registration is unverified and never selects a default.',inputSchema:object({fileId:string},['fileId'])},
  {name:'read_career_document',operation:'toolkit.file.read',scope:'workspace:read',readOnly:true,description:'Read an owned completed generated document and a 60-second private link. Never put the secret link in routine logs or shared job data.',inputSchema:object({fileId:string},['fileId'])},

  ...KNOWLEDGE_TOOLS,
  ...ONBOARDING_TOOLS,
  {name:'save_search_targets',operation:'preferences.targets.save',scope:'preferences:write',description:'Replace your private source list after a user asks to add, edit or remove targets. Read preferences.search.targets and targetsVersion first; pass the complete list and current version (0 if absent). Each target has id, name, kind (board/careers/social), address (HTTPS URL or social @handle). Does not enable scanners or sharing.',inputSchema:object({expectedVersion:{type:'integer',minimum:0},targets:{type:'array',maxItems:100,items:object({id:string,name:string,kind:{type:'string',enum:['board','careers','social']},address:string},['id','name','kind','address'])}},['expectedVersion','targets'])},
  ...PLATFORM_TOOLS,
  {name:'save_search_profile',operation:'preferences.profile.save',scope:'preferences:write',description:'Create or update an owned search profile after a user asks to change preferences. Read personal context first. Pass current profile version, or 0 for a new profile. Profile contains id, name, active, filters, priorities, instructions. For What your agent knows notes, first read_guide career-find-jobs and follow its four-section decision-brief constraint. Does not change submission permission or human approvals.',inputSchema:object({expectedVersion:{type:'integer',minimum:0},profile:json},['expectedVersion','profile'])},
  {name:'read_application_round_stats',operation:'applications.round_stats',scope:'workspace:read',readOnly:true,description:'Read exact round counts across the owned deduplicated native/imported board, shared with Stats: pending/scheduled/completed/cancelled, by Screen/Interview and round type. Applications are not counted once per round. No guessed rounds from statuses or notes.',inputSchema:object()},
  {name:'read_application_timeline',operation:'applications.timeline',scope:'workspace:read',readOnly:true,description:'Read an owned application and immutable process milestones, including email evidence and unknown dates. Milestones do not prove submission or human approval.',inputSchema:object({applicationId:string},['applicationId'])},
  {name:'record_application_milestone',operation:'applications.milestone',scope:'activity:write',description:'Automatically save relevant process updates during authorized conversations or email checks. source is email with messageId/subject/excerpt/receivedAt, or user_reported with note containing what the candidate said; never use source user. Preserve scheduled/completed/received. Leave occurredAt null unless exact date/time/timezone is confirmed and source.timestampConfirmed=true. For a correction or reschedule, read the timeline and set supersedesId to the current event being replaced. Optional round metadata assigns SCREEN/INTERVIEW and a process type such as oa or take_home; cancelled rounds do not promote stage. Old evidence stays in history. Reuse eventKey and identical content on retry. Never writes submission receipt, approval, or status. Interview reflections use save_artifact kind notes with purpose Interview debrief [applicationId] Interview note; list/read existing notes before saving a new UUID (expectedVersion 0) or current version edit. Keep notes private.',inputSchema:object({applicationId:string,eventKey:string,kind:string,label:string,round:object({stage:{type:'string',enum:['SCREEN','INTERVIEW']},type:{type:'string',enum:['recruiter','oa','take_home','technical','system_design','behavioral','hiring_manager','onsite','other']},cancelled:{type:'boolean'}},['stage','type']),occurredAt:{type:['string','null']},phase:string,source:json,supersedesId:string,practiceCategory:{type:'string',enum:['general','coding','systems','behavioral','sql','ml']},timeZone:string,proposedAt:{type:['string','null']}},['applicationId','eventKey','kind','label','phase','source'])},
  {name:'discover_toolkit',operation:'guides.discover',scope:'workspace:read',readOnly:true,description:'Discover instruction guides, not executable tool schemas (use discover_tools for those). Discover Lookout workflows automatically for career goals: job search and fit, profile/resume improvement, cover letters, applications, interview practice/preparation, outreach/follow-ups, offers/negotiation, career growth and recurring work. Call when the guide index is missing; select matching descriptions/examples and load read_guide. No skill names, downloads or copied prompts required. Returns metadata and runtime requirements, not execution or new permissions.',inputSchema:object()},
  {name:'read_guide',operation:'guides.read',scope:'workspace:read',readOnly:true,description:'Load instructions for a workflow selected automatically from discover_toolkit or read_developer_context.guides for the current goal. The user need not name a skill. Guides do not grant permissions.',inputSchema:object({id:string},['id'])},
  {name:'reconsider_skipped_opportunity',operation:'selection.reconsider',scope:'activity:write',description:'Request reconsideration of an owned skipped role. Read skipped opportunities first; pass expectedReconsideredAt as its timestamp or empty string when absent. Does not change preferences or apply.',inputSchema:object({decisionId:string,expectedReconsideredAt:string},['decisionId','expectedReconsideredAt'])},
  {name:'read_quiet_mode',operation:'quiet.read',scope:'workspace:read',readOnly:true,description:'Read quiet delivery settings and personalVersion for a subsequent scoped update.',inputSchema:object()},
  {name:'update_quiet_mode',operation:'quiet.update',scope:'profile:write',description:'Change only quiet delivery settings, preserving all unrelated search preferences. Requires current personalVersion. settings: cadence immediate/daily/weekly, IANA timezone, digestHour 0-23, digestDay 0-6, urgentDeadlineHours 1-168. Does not send messages or schedule background work.',inputSchema:object({settings:json,expectedPersonalVersion:{type:'integer'}},['settings','expectedPersonalVersion'])},
  {name:'open_human_application_action',operation:'applications.human_action',scope:'workspace:read',readOnly:true,description:'Return an owned Muse board link for human-only approve or resolve_submission. Never grants approval, resolves an uncertain attempt, submits or retries. The signed-in user must inspect the exact version and act.',inputSchema:object({applicationId:string,action:string},['applicationId','action'])},
  {name:'read_preparation_planner',operation:'preparation.planner.read',scope:'workspace:read',readOnly:true,description:'Read the owned Monday–Sunday calendar (optional weekOf Monday YYYY-MM-DD, current week by default), all seven days and other pending undated/over-budget tasks, with coverage-optimized prep sessions within the saved daily budget. Includes current application rounds without requiring prep plans, dated imported next actions, scheduled Toolkit mocks (public logistics only), learningGoals, saved artifact references, missing-material indicators and versioned interview or learning targets. Interviews use the shared budget first. Create useful supporting artifacts during authorized planning.',inputSchema:object({weekOf:{type:'string',pattern:'^[0-9]{4}-[0-9]{2}-[0-9]{2}$',description:'Optional Monday YYYY-MM-DD; omit for the current week in the saved timezone.'}})},
  {name:'save_preparation_budget',operation:'preparation.budget',scope:'preferences:write',description:'Set the shared daily preparation budget, 0 (pause) to 240 minutes, using the current settings version from read_preparation_planner.',inputSchema:object({dailyMinutes:{type:'integer',minimum:0,maximum:240},expectedVersion:{type:'integer',minimum:0}},['dailyMinutes','expectedVersion'])},
  {name:'complete_preparation_session',operation:'preparation.session.complete',scope:'drafts:write',description:'Record a user-reported prep session once across its covered interview or learning tasks. Supply exactly one applicationId or goalId per target. Copy targets and minutes from the planner, with each plan version. Reuse sessionId UUID on retries. Atomic, respects remaining daily budget, credits partial practice, never establishes submission or approval.',inputSchema:object({sessionId:string,minutes:{type:'integer',minimum:1,maximum:240},targets:{type:'array',minItems:1,maxItems:100,items:object({applicationId:string,goalId:string,taskId:string,expectedVersion:{type:'integer',minimum:0}},['taskId','expectedVersion'])}},['sessionId','minutes','targets'])},
  {name:'read_preparation_plan',operation:'preparation.read',scope:'workspace:read',readOnly:true,description:'Read an owned application, employer requirements and versioned preparation plan.',inputSchema:object({applicationId:string},['applicationId'])},
  {name:'update_preparation_plan',operation:'preparation.update',scope:'drafts:write',description:'Build or update personalized preparation. For a confirmed canonical interview pass roundId and omit deadline; its date/category are derived automatically. Legacy standalone plans use an evidenced deadline. Pass expectedVersion 0 when absent. deadline {date:YYYY-MM-DD,stage,confirmed,source:{kind:email,messageId,subject,excerpt,receivedAt,url}}. Uncertain dates remain unscheduled. Preserves completed tasks.',inputSchema:object({applicationId:string,expectedVersion:{type:'integer'},roundId:string,deadline:json,dailyMinutes:{type:'integer'},resourceGuides:{type:'array',items:json,maxItems:10}},['applicationId','expectedVersion'])},
  {name:'complete_preparation_task',operation:'preparation.complete',scope:'drafts:write',description:'Update a preparation task only after the user reports completing it; optimistic version required.',inputSchema:object({applicationId:string,expectedVersion:{type:'integer'},taskId:string,completed:{type:'boolean'}},['applicationId','expectedVersion','taskId','completed'])},
  {name:'record_selection_decision',operation:'selection.record',scope:'activity:write',description:'Record why a canonical role was skipped. Current server policy supplies firm exclusion reasons; discretionary fit judgments must be uncertain. preference excludedCompanies/employmentTypes/locations/categories/targetYear/fit. Reuse eventKey for retries.',inputSchema:object({jobId:string,eventKey:string,reason:string,preference:string,evidence:string,certainty:string},['jobId','eventKey','reason','preference','evidence','certainty'])},
  {name:'read_skipped_opportunities',operation:'selection.read',scope:'workspace:read',readOnly:true,description:'Inspect private skipped roles and user reconsideration requests. Keep skips out of routine notifications unless requested.',inputSchema:object()},
  {name:'read_delivery_policy',operation:'notifications.read',scope:'workspace:read',readOnly:true,description:'Read quiet-mode delivery advice and unacknowledged activity. Returns due/defer, immediate decisions or a digest, using stored delivery history. Continue other authorized work. Delivery uses your own runtime.',inputSchema:object()},
  {name:'acknowledge_delivery',operation:'notifications.ack',scope:'activity:write',description:'After successful delivery only, save event IDs and kind digest/immediate. Reuse eventKey after uncertain acknowledgment delivery. Never acknowledge a message that was not sent.',inputSchema:object({eventKey:string,kind:string,eventIds:{type:'array',items:string,maxItems:500}},['eventKey','kind','eventIds'])},
  {name:'read_application_record',operation:'applications.record',scope:'workspace:read',readOnly:true,description:'Inspect immutable submission attempts, resume version, exact answers, timestamps and observed confirmation. User-reported progress is distinct from confirmation.',inputSchema:object({applicationId:string},['applicationId'])},
  {name:'read_outreach_workspace',operation:'outreach.read',scope:'workspace:read',readOnly:true,description:'Read owned queued outreach requests and contacts with revisions. Load read_guide with id cold-outreach before preparing messages. Check every connected run.',inputSchema:object()},
  {name:'save_outreach_package',operation:'outreach.prepare',scope:'drafts:write',description:'Save complete researched contacts and copy-ready messages for an owned queued request. Reuse eventKey for identical retries. Include id/expectedRevision for edits. Preserves human status; never sends messages.',inputSchema:object({requestId:string,eventKey:string,contacts:{type:'array',minItems:1,maxItems:100,items:json}},['requestId','eventKey','contacts'])},
  { name: 'save_profile_package', operation: 'profile.import', scope: 'profile:write', description: 'Save extracted candidate facts, proposed saved answers and an owned uploaded default PDF resume in your private profile. Read personal context first and supply its expectedPersonalVersion. Reuse eventKey and exactly the same payload for retries. Facts merge; supplied history arrays replace those sections. Answers are unverified ask-by-default proposals, even when requestedPolicy is auto. Never creates human verification or application approval. Missing/conflicting facts stay unresolved.', inputSchema: object({eventKey:string,expectedPersonalVersion:{type:'integer'},facts:profileFactsSchema,answers:proposedAnswersSchema,defaultResumeId:string,source:string},['eventKey','expectedPersonalVersion']) },
  { name: 'begin_resume_upload', operation: 'resumes.begin_upload', scope: 'profile:write', description: 'Start an immutable private PDF/DOCX upload (up to 10 MB), or reuse the same owned variant/checksum. Supply local file SHA-256 and bytes. Returns resume if already registered, otherwise uploadId and secret uploadUrl: PUT exact file bytes with returned contentType, then call complete_resume_upload. Reuse eventKey for retries. No public URLs or caller-supplied object paths.', inputSchema: resumeUploadSchema },
  { name: 'complete_resume_upload', operation: 'resumes.complete_upload', scope: 'profile:write', description: 'Verify the uploaded private resume size, file signature and SHA-256, register immutable metadata and return its resume ID. Retrying the same uploadId is safe. Only registered resumes can be selected as default in save_profile_package.', inputSchema: object({uploadId:string},['uploadId']) },
  { name: 'report_submission_result', operation: 'submission.finish', scope: 'drafts:write', description: 'Retry an existing runner attempt result report only. Never re-click Submit. Confirmation is labelled runner-observed employer evidence; unknown outcomes remain blocked. Requires all runner scopes.', inputSchema: object({applicationId:string,claimId:string,outcome:string,receipt:json},['applicationId','claimId','outcome']) },
  { name: 'read_application_policy', operation: 'applications.policy', scope: 'workspace:read', readOnly: true, description: 'Evaluate your current auto-apply/review threshold for a canonical job. Pass profileId for the selected active application profile and its saved company-list/review rules. Omit only for legacy policies. Returns auto-apply, review or skip, plus current execution limits. Never grants approval or submits.', inputSchema: object({ jobId: string, profileId: string }, ['jobId']) },
  { name: 'report_application_failure', operation: 'runner.report_failure', scope: 'drafts:write', description: 'Send an unresolved Playwright/agent failure to Needs you. Requires current revision; preserves the draft, invalidates approval, and records a deduplicated failure with a human next action. Uncertain submission outcomes must never automatically retry.', inputSchema: object({ applicationId: string, eventKey: string, expectedRevision: { type: 'integer' }, stage: string, outcome: string, reason: string, nextAction: string, attempts: { type: 'array', maxItems: 3, items: json } }, ['applicationId','eventKey','expectedRevision','stage','outcome','reason','nextAction','attempts']) },
  { name: 'check_context_versions', operation: 'context.versions', scope: 'workspace:read', description: 'First call each run: returns only personalVersion and developerVersion. Compare with your retained per-connection versions. Fetch only changed context; first run or lost memory requires both sections. When developerVersion changes, also refresh tools/list; this is pull refresh, not push delivery.', inputSchema: object(), readOnly: true },
  { name: 'read_personal_context', operation: 'context.personal', scope: 'workspace:read', description: 'Load owned preferences, profile, saved answers and resume metadata with their personalVersion. Read on bootstrap or personal-version changes; no applications or file bytes.', inputSchema: object(), readOnly: true },
  { name: 'read_developer_context', operation: 'context.developer', scope: 'workspace:read', description: 'Read the small core instructions and versioned workflow index. Load task procedures with read_guide; discover_toolkit lists additional career skills. Retain per connection only while content is available; reload after developerVersion changes or context loss. No personal reads or activation.', inputSchema: object(), readOnly: true },
  { name: 'workspace_read', operation: 'workspace.read', scope: 'workspace:read', description: 'Read your private profile, preferences, saved answers, resume references, and recent applications.', inputSchema: object(), readOnly: true },
  { name: 'publish_batch', operation: 'batches.publish', scope: 'batches:write', description: 'Publish a private morning batch and return its board link. Reuse eventKey for safe retries. Each jobs item is {jobId,recommendation?} or {canonicalUrl,employer,recommendation?}. Employer postings are public; personal fit notes belong in recommendation. New jobs copy the latest saved owned JD; employer.description is ignored and missing captures remain empty. Existing catalog descriptions are unchanged. Before writing per-job analysis, read_guide career-find-jobs and follow its connected narrative and four-fit-score contract.', inputSchema: batchSchema },
  { name: 'prepare_draft', operation: 'drafts.prepare', scope: 'drafts:write', description: 'Prepare a draft with a direct-fill pass from current owned profile facts, selected resume and exact permitted saved answers. Uses explicit application answers from the selected searchProfileId. Returns a compact unresolved-only handoff with choices/limits/relevant evidence by default, not the full draft. For follow-up answers send draft.answerUpdates [{fieldId,answer}] at the returned revision; the server merges stored fields. Keep compact by default. responseMode full supports intentional saved-draft inspection: inspect returned ID/revision, resume, questions/answers/options, blocker and readiness to replace only the immediate application read. Still read_action_board before a human handoff; reread current records after conflicts, ambiguous writes or context loss. Agent writes cannot create human answer-confirmed events; the person uses Confirm answer in the job preview. Preserves supplied answers and returns prefill counts/escapes for unresolved fields; no model call, approval or submission. Requires workspace:read too. Use expectedRevision -1 for a new application; changes invalidate approval. draft contains resumeId, questionsReviewed, questions [{id,question,answer}] and optional runner inspection metadata. Include searchProfileId for the selected active application profile; policy is rechecked from its saved settings, never from draft rank claims.', inputSchema: object({ jobId: string, expectedRevision: { type: 'integer' }, draft: json, blocker: string,responseMode:{type:'string',enum:['compact','full'],default:'compact'} }, ['jobId', 'expectedRevision', 'draft']) },
  { name: 'append_activity', operation: 'activity.append', scope: 'activity:write', description: 'Record an agent observation, never evidence of submission. Reuse eventKey for safe retries.', inputSchema: activitySchema },
  { name: 'read_approval', operation: 'approvals.read', scope: 'approvals:read', description: 'Read the exact human approval matching the current draft revision. Null means no current approval. Recheck immediately before any separate runner action.', inputSchema: object({ applicationId: string }, ['applicationId']), readOnly: true },
  { name: 'read_resume', operation: 'resumes.read', scope: 'resumes:read', description: 'Read an owned resume reference and a short-lived private download URL. Treat returned URLs as secrets; do not put them in job records or logs.', inputSchema: object({ resumeId: string }, ['resumeId']), readOnly: true },
].map(completeToolScopes);
const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Allow': 'POST, GET', 'Vary': 'Origin' };
const reply = (body, status = 200) => new Response(body === null ? null : JSON.stringify(body), { status, headers });
const error = (id, code, message, status = 200) => reply({ jsonrpc: '2.0', id, error: { code, message } }, status);
const result = (id, data) => reply({ jsonrpc: '2.0', id, result: data });
async function readBody(request) {
  const reader = request.body?.getReader(); if (!reader) throw new Error('Missing body');
  const chunks = []; let length = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    length += value.length;
    if (length > 262144) { await reader.cancel(); const e = new Error('Too large'); e.status = 413; throw e; }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}
function validArgs(tool, args, onFailure=()=>{}) {
  try {
    if (!args || typeof args !== 'object' || Array.isArray(args)) return false;
    const schema = tool.inputSchema;
    const properties=schema.properties||{};
    if(Object.keys(args).some(key=>!Object.hasOwn(properties,key))||(schema.required||[]).some(key=>!Object.hasOwn(args,key)))return false;
    const shape=Object.entries(args).every(([key,value])=>{
      const type=properties[key].type;
      if(Array.isArray(type))return type.includes(value===null?'null':typeof value);
      if(type==='object')return value!==null&&typeof value==='object'&&!Array.isArray(value);
      if(type==='array')return Array.isArray(value)&&value.length<=(properties[key].maxItems||100);
      if(type==='integer')return Number.isSafeInteger(value);
      return typeof value===type;
    });
    if(!shape)return false;
    // Fixed product tools share the full nested gateway validator. Custom local
    // runner extras retain their own validation boundary and cannot add SQL ops.
    if(OPERATIONS.includes(tool.operation))validateRequest({operation:tool.operation,payload:args});
    return true;
  } catch (error) {onFailure(error);return false;}
}
const hasToolScopes=(tool,scopes,payload=undefined)=>requiredToolScopes(tool,payload).every(scope=>scopes.includes(scope));
export function createHandler(forward, allowedOrigins = ['https://wcia013twe.github.io'], extraTools = [], diagnostic = event=>console.warn(JSON.stringify(event)), events = null) {
  const availableTools = [...TOOLS, ...extraTools].filter(tool => enabledMcpOperation(tool.operation));
  return async request => {
    const origin = request.headers.get('Origin');
    if (origin && !allowedOrigins.includes(origin)) return error(null, -32000, 'Origin forbidden', 403);
    const token = request.headers.get('Authorization')?.match(/^Bearer (jb_agent_[a-f0-9]{64}|[A-Za-z0-9_-]{43})$/)?.[1];
    if (!token) return error(null, -32000, 'Agent credential required', 401);
    // Discovery also validates expiry/revocation, without requiring workspace scope.
    let auth;
    try { auth = await forward(token, 'credentials.verify', {}); }
    catch { return error(null, -32603, 'Gateway unavailable', 502); }
    if (auth.status !== 200) return error(null, -32000, auth.status === 401 ? 'Credential invalid, expired, or revoked' : 'Credential verification failed', auth.status === 401 ? 401 : 502);
    const scopes = auth.data?.scopes;
    if (!Array.isArray(scopes)) return error(null, -32603, 'Invalid gateway response', 502);
    if (request.method !== 'POST') return reply(null, 405); // No server-initiated SSE or sessions.
    if (!(request.headers.get('Content-Type') ?? '').includes('application/json')) return error(null, -32600, 'Use application/json', 415);
    const accept = request.headers.get('Accept') ?? '';
    if (!accept.includes('application/json') || !accept.includes('text/event-stream')) return error(null, -32600, 'Accept application/json and text/event-stream', 406);
    const versionHeader = request.headers.get('MCP-Protocol-Version');
    if (versionHeader && !VERSIONS.includes(versionHeader)) return error(null, -32600, 'Unsupported protocol version', 400);
    let message;
    try { message = await readBody(request); }
    catch (e) { return error(null, -32700, e.status === 413 ? 'Request too large' : 'Invalid JSON', e.status ?? 400); }
    if (!message || Array.isArray(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string') return error(null, -32600, 'Invalid request', 400);
    const hasId = Object.hasOwn(message, 'id');
    const id = hasId ? message.id : null;
    if (hasId && !(typeof id === 'string' || Number.isInteger(id))) return error(null, -32600, 'Invalid request id', 400);
    if (!hasId) return message.method.startsWith('notifications/') ? reply(null, 202) : error(null, -32600, 'Request id required', 400);
    if (message.method === 'initialize') {
      if (typeof message.params?.protocolVersion !== 'string') return error(id, -32602, 'protocolVersion required');
      return result(id, { protocolVersion: VERSIONS.includes(message.params.protocolVersion) ? message.params.protocolVersion : VERSIONS[0], capabilities: { tools: {}, ...(events ? {events:{}} : {}) }, serverInfo: { name: 'job-board', version: runtimeVersion.sourceCommit ?? 'development' }, instructions: bootstrapInstructions });
    }
    if (events && message.method.startsWith('events/')) {
      try { return result(id,await events(token,message.method,message.params)); }
      catch(e) { return reply({jsonrpc:'2.0',id,error:{code:e.code??-32603,message:e.code?e.message:'Event service unavailable',...(e.reason?{data:{reason:e.reason}}:{})}}); }
    }
    if (message.method === 'ping') return result(id, {});
    if (message.method === 'tools/list') return result(id, {tools:[...availableTools.filter(tool=>DEFAULT_TOOL_NAMES.has(tool.name)&&hasToolScopes(tool,scopes)).map(publicTool),...ACCESS_TOOLS]});

    if (message.method !== 'tools/call') return error(id, -32601, 'Method not found');
    let name=message.params?.name;
    let args=message.params?.arguments ?? {};
    if (ACCESS_TOOLS.some(tool=>tool.name===name)) {
      if (!validAccessArguments(name,args)) return error(id,-32602,'Invalid tool arguments');
      if (name==='discover_tools') {
        const tools=availableTools.filter(tool=>hasToolScopes(tool,scopes)
          && (args.workflow==='all'||toolWorkflow(tool)===args.workflow)
          && (args.name===undefined||tool.name===args.name));
        return result(id,{content:[{type:'text',text:JSON.stringify({workflow:args.workflow,tools:tools.map(tool=>({...publicTool(tool),workflow:toolWorkflow(tool),gated:!DEFAULT_TOOL_NAMES.has(tool.name)}))})}]});
      }
      // Unwrap once, then use precisely the direct-call path below. Access tools
      // are not in availableTools, so recursive dispatch cannot grant authority.
      name=args.name;
      args=args.arguments;
    }
    const rejectMock=(stage,message,status=400)=>{const event=mockRejection(name,stage,message,args,status);try{diagnostic(event);}catch{}};
    const tool = availableTools.find(tool => tool.name === name);
    if (!tool) return error(id, -32602, 'Unknown tool');
    if (!hasToolScopes(tool,scopes,args)) return result(id, { content: [{ type: 'text', text: 'Missing required scope: ' + requiredToolScopes(tool,args).filter(scope=>!scopes.includes(scope)).join(', ') }], isError: true });
    if (tool.operation.startsWith('artifacts.') || tool.operation.startsWith('learning.') || tool.operation.startsWith('mock.')) {
      try { validateArtifact(tool.operation, args); validateMock(tool.operation, args); }
      catch (e) { if(tool.operation.startsWith('mock.'))rejectMock('validation',e.message);return error(id,-32602,e.message); }
    }
    if (tool.operation.startsWith('search.')) {
      try { validateSearch(tool.operation, args); }
      catch (e) { return error(id, -32602, e.message); }
    }
    let argumentError;
    if (!validArgs(tool,args,e=>{argumentError=e;})) {if(tool.operation.startsWith('mock.'))rejectMock('contract',argumentError?.message||'Invalid tool arguments');return error(id,-32602,'Invalid tool arguments');}
    try {
      const response = await forward(token, tool.operation, args);
      if (response.status !== 200) {if(tool.operation.startsWith('mock.'))rejectMock('backend',response.error,response.status);return result(id, { content: [{ type: 'text', text: JSON.stringify({ status: response.status, error: response.error ?? 'Operation rejected' }) }], isError: true });}
      return result(id, { content: [{ type: 'text', text: JSON.stringify(response.data ?? null) }] });
    } catch { return result(id, { content: [{ type: 'text', text: 'Gateway unavailable; check current state before retrying writes.' }], isError: true }); }
  };
}
