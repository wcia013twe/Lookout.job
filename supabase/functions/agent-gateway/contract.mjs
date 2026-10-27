import {APPLICATION_JOB_TOOL,validateApplicationJob} from './application-jobs.mjs';
import {MUSE_CHANGE_TOOLS,validateMuseChanges} from './muse-changes.mjs';
import {READ_SUBMISSION_BATCH_TOOL,validateSubmissionBatchOperation} from './submission-batches.mjs';
import {validateApplicationAnswerUpdates} from '../../../lib/application-handoff.mjs';
import {ACTION_INBOX_TOOL,validateActionInbox} from './action-inbox.mjs';
import {WORK_EXPERIENCE_TOOL,validateWorkExperience} from './work-experience.mjs';
import {SEARCH_INTAKE_TOOLS,validateSearchIntake} from './search-intake.mjs';
import {SCREENING_TOOLS,validateScreening} from './search-screening.mjs';
import {validateResumeParse} from './resume-parse.mjs';
import {BACKEND_TOOLS,validateBackendJob} from './backend-jobs.mjs';
import {IMPORT_TOOLS,validateImport} from './simplify-import.mjs';
import {RESET_HANDOFF_TOOL} from './workspace-reset.mjs';
import {validateJobRecommendation} from './job-assessment.mjs';
import {validatePackRecommendation} from './card-packs.mjs';
import {BRIEF_TOOL,validateBrief} from './user-brief.mjs';
import {FIELD_UPDATE_TOOLS,validateFieldUpdate} from './field-updates.mjs';
import {ARTIFACT_TOOLS,validateArtifact} from './artifacts.mjs';
import {SEARCH_TOOLS,validateSearch} from './search.mjs';
import { validateToolkit } from './toolkit.mjs';
import { KNOWLEDGE_TOOLS, validateKnowledge } from './knowledge.mjs';
import { ONBOARDING_TOOLS, validateOnboarding } from "./onboarding.mjs";
import { validateTargets } from './search-targets.mjs';
import { PLATFORM_TOOLS, validatePlatformPayload } from './platform-tools.mjs';
import { validateMilestone } from './milestones.mjs';
import { validateOutreach } from './outreach.mjs';
import { validateProfileSetup } from './profile-setup.mjs';
import { BUG_TOOL, validateBugReport } from './bug-report.mjs';
import { BUG_STATUS_TOOL, validateBugStatus } from './bug-status.mjs';
export const EMPLOYER_FIELDS = ['company','title','employmentType','location','locations','category','postedDate','discoveredDate','description','compensation','source','sourceFreshness','applicationUrl','eligibility','deadline'];
// Shared validation is runtime-independent so Node tests cover the deployed contract.
export const SCOPES = ['knowledge:read','knowledge:write','answers:write','resumes:write','network:write','tracking:write','preferences:write','workspace:read', 'profile:write', 'resumes:read', 'batches:write', 'drafts:write', 'activity:write', 'approvals:read'];
export const OPERATIONS = [APPLICATION_JOB_TOOL.operation,...MUSE_CHANGE_TOOLS.map(t=>t.operation),READ_SUBMISSION_BATCH_TOOL.operation,'submission.batch.begin','submission.batch.touch','submission.batch.checkpoint',ACTION_INBOX_TOOL.operation,WORK_EXPERIENCE_TOOL.operation,'resumes.parse',BUG_TOOL.operation,BUG_STATUS_TOOL.operation,...SEARCH_INTAKE_TOOLS.map(t=>t.operation),...SCREENING_TOOLS.map(t=>t.operation),...BACKEND_TOOLS.map(t=>t.operation),...IMPORT_TOOLS.map(t=>t.operation),RESET_HANDOFF_TOOL.operation,BRIEF_TOOL.operation,...FIELD_UPDATE_TOOLS.map(t=>t.operation),...ARTIFACT_TOOLS.map(t=>t.operation),...SEARCH_TOOLS.map(t=>t.operation),'toolkit.context','toolkit.results','toolkit.record','toolkit.file.begin','toolkit.file.complete','toolkit.file.read',...KNOWLEDGE_TOOLS.map(t=>t.operation),...ONBOARDING_TOOLS.map(t=>t.operation),'preferences.targets.save',...PLATFORM_TOOLS.map(t=>t.operation), 'preferences.profile.save','guides.discover','guides.read','outreach.read','outreach.prepare','connections.profile_setup','profile.import','resumes.begin_upload','resumes.complete_upload','connections.issue','connections.list','connections.revoke','workspace.read','credentials.verify','resumes.read','batches.publish','drafts.prepare','activity.append','approvals.read','context.versions','context.personal','context.developer','runner.report_failure','applications.policy','submission.context','submission.claim','submission.start','submission.finish','preparation.planner.read','preparation.budget','preparation.session.complete','preparation.read','preparation.update','preparation.complete','selection.record','selection.read','notifications.read','notifications.ack','applications.record','selection.reconsider','quiet.read','quiet.update','applications.human_action','applications.timeline','applications.milestone'];
export function validateRequest(input) {
  if (!input || !OPERATIONS.includes(input.operation)) throw new Error('Unknown operation');
  const p = input.payload ?? {};
  if(input.operation===APPLICATION_JOB_TOOL.operation)validateApplicationJob(p);
  validateSubmissionBatchOperation(input.operation,p);
  if(input.operation===ACTION_INBOX_TOOL.operation)validateActionInbox(p);
  if(input.operation===WORK_EXPERIENCE_TOOL.operation)validateWorkExperience(p);
  if(input.operation===BUG_TOOL.operation)validateBugReport(p);
  if(input.operation===BUG_STATUS_TOOL.operation)validateBugStatus(p);
  if(input.operation===RESET_HANDOFF_TOOL.operation && (!p || typeof p!=='object' || Array.isArray(p) || Object.keys(p).length))throw Error('Reset handoff accepts no arguments');
  if(input.operation==='resumes.parse')validateResumeParse(p);
  validateMuseChanges(input.operation,p);
  validateBackendJob(input.operation,p);
  validateImport(input.operation,p);
  validateFieldUpdate(input.operation,p);
  if(input.operation===BRIEF_TOOL.operation)validateBrief(p);
  validateSearch(input.operation,p);
  validateArtifact(input.operation,p);
  if(input.operation.startsWith('toolkit.')) validateToolkit(input.operation,p);
  if (!p || typeof p !== 'object' || Array.isArray(p)) throw new Error('Payload must be an object');
  if (input.operation === 'guides.discover' && Object.keys(p).length) throw new Error('Guide discovery accepts no arguments');
  if (input.operation === 'guides.read' && (Object.keys(p).length !== 1 || typeof p.id !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(p.id))) throw new Error('Guide ID required');
  if (input.operation === 'preferences.targets.save') {
    if (Object.keys(p).some(k => !['expectedVersion','targets'].includes(k)) || !Number.isSafeInteger(p.expectedVersion) || p.expectedVersion < 0) throw Error('Current targets version required');
    validateTargets(p.targets);
  }
  if (['preparation.planner.read','preparation.budget','preparation.session.complete'].includes(input.operation)) {
    const keys = {'preparation.planner.read':[], 'preparation.budget':['dailyMinutes','expectedVersion'], 'preparation.session.complete':['sessionId','minutes','targets']}[input.operation];
    if (Object.keys(p).some(k=>!keys.includes(k))) throw Error('Unknown planner argument');
    if (input.operation==='preparation.budget' && (!Number.isInteger(p.dailyMinutes)||p.dailyMinutes<0||p.dailyMinutes>240||!Number.isSafeInteger(p.expectedVersion)||p.expectedVersion<0)) throw Error('Bounded daily budget and current version required');
    if (input.operation==='preparation.session.complete') {
      const uuid = v => typeof v==='string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
      if (!uuid(p.sessionId)||!Number.isInteger(p.minutes)||p.minutes<1||p.minutes>240||!Array.isArray(p.targets)||!p.targets.length||p.targets.length>100||p.targets.some(t=>!t||Object.keys(t).some(k=>!['applicationId','goalId','taskId','expectedVersion'].includes(k))||(!!t.applicationId===!!t.goalId)||!uuid(t.goalId||t.applicationId)||!Number.isSafeInteger(t.expectedVersion)||t.expectedVersion<0||typeof t.taskId!=='string'||!t.taskId.length||t.taskId.length>200)) throw Error('Versioned preparation targets required');
      if (new Set(p.targets.map(t=>`${t.goalId ? `goal:${t.goalId}` : t.applicationId}:${t.taskId}`)).size!==p.targets.length) throw Error('Duplicate preparation target');
    }
  }
  validateKnowledge(input.operation,p);
  validateOnboarding(input.operation, p);
  validateProfileSetup(input.operation, p);
  validateSearchIntake(input.operation,p);
  validateScreening(input.operation,p);
  if (input.operation.startsWith('outreach.')) validateOutreach(input.operation,p);
  if (input.operation === 'preferences.profile.save') {
    if (Object.keys(p).some(k => !['expectedVersion','profile'].includes(k)) || !Number.isSafeInteger(p.expectedVersion) || p.expectedVersion < 0) throw Error('Current profile version required');
    const v = p.profile;
    if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).some(k => !['id','name','active','filters','priorities','instructions'].includes(k)) || !/^[a-zA-Z0-9_-]{1,80}$/.test(v.id || '') || typeof v.name !== 'string' || !v.name.trim() || v.name.length > 80 || typeof v.active !== 'boolean' || typeof v.instructions !== 'string' || v.instructions.length > 20000 || !v.filters || !v.priorities || Array.isArray(v.filters) || Array.isArray(v.priorities) || typeof v.filters !== 'object' || typeof v.priorities !== 'object') throw Error('Invalid search profile');
    if (Object.entries(v.filters).some(([k,value]) => !['Employment','Work arrangement','Location','Minimum base pay','Schedule','Experience level'].includes(k) || typeof value !== 'string' || value.length > 500) || Object.entries(v.priorities).some(([k,value]) => !['Pay','Stability','Flexibility','Growth','Meaningful work','Team quality','Getting employed quickly'].includes(k) || !['Important','Very important'].includes(value))) throw Error('Invalid profile fields');
  }
  validatePlatformPayload(input.operation, p);
  const featureKeys = {
    'applications.timeline':['applicationId'], 'applications.milestone':['applicationId','eventKey','kind','label','occurredAt','phase','source','supersedesId'],
    'preparation.read':['applicationId'], 'applications.record':['applicationId'],
    'preparation.update':['applicationId','expectedVersion','deadline','dailyMinutes','resourceGuides'],
    'preparation.complete':['applicationId','expectedVersion','taskId','completed'],
    'selection.record':['jobId','eventKey','reason','preference','evidence','certainty'],
    'selection.reconsider':['decisionId','expectedReconsideredAt'], 'quiet.read':[], 'quiet.update':['settings','expectedPersonalVersion'], 'applications.human_action':['applicationId','action'],
    'selection.read':[], 'notifications.read':[], 'notifications.ack':['eventKey','kind','eventIds'],
  };
  if (featureKeys[input.operation]) {
    if (Object.keys(p).some(k => !featureKeys[input.operation].includes(k))) throw Error('Unknown feature argument');
    const uuid = v => typeof v==='string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
    if(input.operation==='applications.timeline'||input.operation==='applications.milestone') { if(!uuid(p.applicationId)) throw Error('Application ID required'); if(input.operation==='applications.milestone') validateMilestone(p); }
    if (input.operation.startsWith('preparation.') || input.operation==='applications.record') {
      if(!uuid(p.applicationId)) throw Error('Application ID required');
      if(['preparation.update','preparation.complete'].includes(input.operation) && (!Number.isSafeInteger(p.expectedVersion)||p.expectedVersion<0)) throw Error('Current plan version required');
      if(input.operation==='preparation.update' && (!p.deadline || typeof p.deadline!=='object' || Array.isArray(p.deadline) || (p.dailyMinutes!==undefined && (!Number.isInteger(p.dailyMinutes)||p.dailyMinutes<15||p.dailyMinutes>240)))) throw Error('Deadline and available preparation time required');
      if(input.operation==='preparation.update' && Array.isArray(p.resourceGuides) && p.resourceGuides.some(g => g && ((g.source!==undefined&&!['lookout','glassdoor','official','other'].includes(g.source))||(g.observedAt!==undefined&&(typeof g.observedAt!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(g.observedAt)))||(g.evidence!==undefined&&(typeof g.evidence!=='string'||g.evidence.length>1500))||(['lookout','glassdoor'].includes(g.source)&&(!g.evidence?.trim()||!g.observedAt||!g.companies?.length))))) throw Error('Company interview reports require a source, date, company and supporting evidence');
      if(input.operation==='preparation.update' && p.resourceGuides!==undefined && (!Array.isArray(p.resourceGuides)||p.resourceGuides.length>10||p.resourceGuides.some(g=>!g||typeof g.id!=='string'||g.id.length>100||typeof g.title!=='string'||g.title.length>200||typeof g.url!=='string'||g.url.length>2048||!/^https:\/\//.test(g.url)||!Array.isArray(g.topics)||g.topics.some(t=>typeof t!=='string'||t.length>100)||g.topics.length>20||(g.companies!==undefined&&(!Array.isArray(g.companies)||g.companies.some(c=>typeof c!=='string'||c.length>100)))||!Number.isInteger(g.minutes)||g.minutes<1||g.minutes>240))) throw Error('Bounded verified resource guides required');
      if(input.operation==='preparation.complete' && (typeof p.taskId!=='string'||p.taskId.length>200||typeof p.completed!=='boolean')) throw Error('Task and completion required');
    }
    if(input.operation==='selection.reconsider' && (!uuid(p.decisionId)||typeof p.expectedReconsideredAt!=='string'||p.expectedReconsideredAt.length>50||(p.expectedReconsideredAt!==''&&!Number.isFinite(Date.parse(p.expectedReconsideredAt))))) throw Error('Decision ID and current reconsideration token required');
    if(input.operation==='applications.human_action' && (!uuid(p.applicationId)||!['approve','resolve_submission'].includes(p.action))) throw Error('Owned application and human action required');
    if(input.operation==='quiet.update') {
      const q=p.settings;
      if(!Number.isSafeInteger(p.expectedPersonalVersion)||p.expectedPersonalVersion<1||!q||typeof q!=='object'||Array.isArray(q)||Object.keys(q).some(k=>!['cadence','timezone','digestHour','digestDay','urgentDeadlineHours'].includes(k))||!['immediate','daily','weekly'].includes(q.cadence)||typeof q.timezone!=='string'||q.timezone.length>100||!Number.isInteger(q.digestHour)||q.digestHour<0||q.digestHour>23||!Number.isInteger(q.digestDay)||q.digestDay<0||q.digestDay>6||!Number.isInteger(q.urgentDeadlineHours)||q.urgentDeadlineHours<1||q.urgentDeadlineHours>168) throw Error('Valid quiet settings and current personal version required');
      new Intl.DateTimeFormat('en',{timeZone:q.timezone});
    }
    if(input.operation==='selection.record' && (!['jobId','eventKey','reason','preference','evidence'].every(k=>typeof p[k]==='string'&&p[k].trim()&&p[k].length<=({reason:1000,evidence:2000}[k]||200)) || !['exclusion','uncertain'].includes(p.certainty))) throw Error('Selection explanation required');
    if(input.operation==='notifications.ack' && (typeof p.eventKey!=='string'||!p.eventKey.trim()||p.eventKey.length>200||!['digest','immediate'].includes(p.kind)||!Array.isArray(p.eventIds)||p.eventIds.length>500||p.eventIds.some(id=>typeof id!=='string'||id.length>200))) throw Error('Delivery acknowledgment required');
  }
  if (input.operation.startsWith('submission.') && !input.operation.startsWith('submission.batch.')) {
    const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
    const op = input.operation.slice(11);
    const keys = {context:['applicationId'],claim:['applicationId','attemptId','expectedRevision','expectedPersonalVersion'],start:['applicationId','claimId','expectedRevision','expectedPersonalVersion'],finish:['applicationId','claimId','outcome','receipt']}[op];
    if (!keys || Object.keys(p).some(key => !keys.includes(key)) || !uuid(p.applicationId)) throw new Error('Invalid submission payload');
    if (['claim','start'].includes(op) && (!Number.isInteger(p.expectedRevision) || p.expectedRevision<0 || !Number.isSafeInteger(p.expectedPersonalVersion) || p.expectedPersonalVersion<1)) throw new Error('Current revision and settings version required');
    if (op==='claim' && !/^[a-zA-Z0-9_-]{1,80}$/.test(p.attemptId || '')) throw new Error('Stable attempt ID required');
    if (['start','finish'].includes(op) && !uuid(p.claimId)) throw new Error('Claim ID required');
    if (op==='finish') {
      if (!['confirmed','uncertain','cancelled'].includes(p.outcome)) throw new Error('Outcome required');
      if (p.outcome==='confirmed') {
        const r=p.receipt;
        if(!r || Object.keys(r).some(key=>!['source','jobUrl','observedUrl','marker','message'].includes(key)) || r.source!=='runner-observed-greenhouse-confirmation'
          || typeof r.jobUrl!=='string' || typeof r.observedUrl!=='string' || r.jobUrl.length>2048 || r.observedUrl.length>2048
          || !['#confirmation','#application_confirmation','[data-testid="application-confirmation"]'].includes(r.marker)
          || typeof r.message!=='string' || !/thank you for applying|application (?:has been |was )?submitted|application (?:has been |was )?received/i.test(r.message) || r.message.length>1000) throw new Error('Observed employer confirmation required');
        const expected=new URL(r.jobUrl), observed=new URL(r.observedUrl);
        if(expected.origin!==observed.origin || ![expected.pathname,expected.pathname+'/confirmation'].includes(observed.pathname) || observed.search || observed.hash || observed.username || observed.password) throw new Error('Confirmation URL mismatch');
      } else if(p.receipt!==undefined) throw new Error('Receipt not allowed without confirmation');
    }
  }
  if (input.operation === 'applications.policy' && (Object.keys(p).some(k=>!['jobId','profileId'].includes(k)) || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(p.jobId || '') || (p.profileId!==undefined&&(typeof p.profileId!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(p.profileId))))) throw new Error('Job ID and optional application profile ID required');
  if(input.operation==='drafts.prepare'&&p.draft?.answerUpdates!==undefined){if(p.draft.questions!==undefined)throw Error('Use questions or answerUpdates, not both.');validateApplicationAnswerUpdates(p.draft.answerUpdates);}
  if(input.operation==='drafts.prepare'&&p.responseMode!==undefined&&!['compact','full'].includes(p.responseMode))throw Error('Choose compact or full draft response.');
  if(input.operation==='drafts.prepare'&&p.draft?.searchProfileId!==undefined&&(typeof p.draft.searchProfileId!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(p.draft.searchProfileId)))throw Error('Valid searchProfileId required in the draft.');
  if (input.operation.startsWith('context.') && Object.keys(p).length) throw new Error('No context arguments allowed');
  if (input.operation === 'runner.report_failure') {
    const keys = ['applicationId','eventKey','expectedRevision','stage','outcome','reason','nextAction','attempts'];
    if (Object.keys(p).some(key => !keys.includes(key)) || typeof p.applicationId !== 'string'
      || !Number.isInteger(p.expectedRevision) || p.expectedRevision < 0
      || !['approval','playwright','agent','submission'].includes(p.stage)
      || !['blocked','uncertain'].includes(p.outcome)
      || !['eventKey','reason','nextAction'].every(key => typeof p[key] === 'string' && p[key].trim() && p[key].length <= (key === 'eventKey' ? 200 : 500))
      || !Array.isArray(p.attempts) || p.attempts.length > 3
      || p.attempts.some(attempt => !attempt || Object.keys(attempt).some(key => !['stage','status'].includes(key))
        || !['approval','playwright','agent'].includes(attempt.stage) || !['failed','prepared','uncertain'].includes(attempt.status))) throw new Error('Invalid runner failure');
  }
  if (input.operation === 'connections.issue') {
    if (typeof p.name !== 'string' || !p.name.trim() || p.name.length > 80) throw new Error('Name required (1–80 characters)');
    if (!Array.isArray(p.scopes) || !p.scopes.length || p.scopes.some(s => !SCOPES.includes(s))) throw new Error('Choose valid scopes');
    if (p.expiresInDays !== undefined && (!Number.isInteger(p.expiresInDays) || p.expiresInDays < 1 || p.expiresInDays > 90)) throw new Error('Expiry must be 1–90 days');
  }
  if (input.operation === 'activity.append') {
    if(Object.keys(p).some(k=>!['eventKey','kind','applicationId','data'].includes(k)) || typeof p.eventKey!=='string' || !p.eventKey.trim() || p.eventKey.length>200 || typeof p.kind!=='string' || !p.kind.trim() || p.kind.length>80) throw Error('Activity needs eventKey (1–200 characters) and kind (1–80 characters).');
    if(p.applicationId!==undefined && !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(p.applicationId))throw Error('applicationId must be an owned application UUID; omit it for sweep-level activity.');
    if(p.data!==undefined&&(!p.data||typeof p.data!=='object'||Array.isArray(p.data)))throw Error('Activity data must be an object.');
  }
  if (input.operation === 'batches.publish') {
    if(Object.keys(p).some(k=>!['eventKey','label','date','jobs'].includes(k)) || typeof p.eventKey!=='string' || !p.eventKey.trim() || p.eventKey.length>200 || typeof p.label!=='string' || !p.label.trim() || p.label.length>200 || !Array.isArray(p.jobs) || p.jobs.length>100)throw Error('Batch needs eventKey, label and jobs (up to 100 items).');
    if(p.date!==undefined&&!/^\d{4}-\d{2}-\d{2}$/.test(p.date))throw Error('Batch date must be YYYY-MM-DD; omit it to use today.');
    for (const job of p.jobs) {
      if(!job||typeof job!=='object'||Array.isArray(job)||Object.keys(job).some(k=>!['jobId','canonicalUrl','employer','recommendation'].includes(k)))throw Error('Each batch job must be {jobId,recommendation?} or {canonicalUrl,employer,recommendation?}.');
      if(job.jobId!==undefined&&(typeof job.jobId!=='string'||!job.jobId.trim()))throw Error('jobId must be an existing catalog ID.');
      if (!job.jobId && (!job.employer || typeof job.employer!=='object' || Array.isArray(job.employer) || Object.keys(job.employer).some(key => !EMPLOYER_FIELDS.includes(key)))) throw new Error('Only public employer facts may be published');
      if(!job.jobId) {let url;try{url=new URL(job.canonicalUrl);}catch{throw Error('New batch jobs need canonicalUrl as a public HTTPS employer posting URL.');}if(url.protocol!=='https:'||url.username||url.password)throw Error('New batch jobs need a public HTTPS canonicalUrl.');}
      validateJobRecommendation(job.recommendation);
      validatePackRecommendation(job.recommendation);
      if(job.recommendation!==undefined&&(!job.recommendation||typeof job.recommendation!=='object'||Array.isArray(job.recommendation)))throw Error('Private fit notes belong in the recommendation object.');
    }
  }
  return { operation: input.operation, payload: p };
}
export function generateToken(cryptoApi = globalThis.crypto) {
  const bytes = cryptoApi.getRandomValues(new Uint8Array(32));
  return 'jb_agent_' + Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
export async function hashToken(token, cryptoApi = globalThis.crypto) {
  const hash = await cryptoApi.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
}
