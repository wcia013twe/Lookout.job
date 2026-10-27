import {readDemoSubmissionBatches} from '../../lib/submission-batches-demo.mjs';
import {reconcileProfileChanges} from '../../lib/profile-sync.mjs';
import {editedWorkExperience} from '../../supabase/functions/agent-gateway/work-experience.mjs';
import {createBackendJobsDemo} from '../../lib/backend-jobs-demo.mjs';
import {createWorkflowDemo} from './agent-workflows-demo.mjs';
import {createArtifactDemo} from './artifact-demo.mjs';
import { demoOutreachContacts } from './outreach-demo.mjs';
import { recordLocalPreparationSession, validatePlannerMinutes } from '../../lib/preparation-planner.mjs';
import { createConnectionDemo } from '../../lib/agent-connections-demo.mjs';

import { createCircleKnowledgeDemo } from '../../lib/circle-knowledge-demo.mjs';
import { demoOnboardingAction } from "./onboarding-demo.mjs";
import { createPreparationPlan, setPreparationTaskCompletion } from '../../lib/preparation-model.mjs';
import { normalizeQuietMode, buildDeliveryPolicy } from '../../lib/quiet-mode.mjs';

import outreachLibrary from '../../supabase/functions/agent-gateway/skills/outreach-templates.json' with { type: 'json' };

const copy = value => value == null ? value : JSON.parse(JSON.stringify(value));
const day = (date, offset) => new Date(Date.parse(`${date}T12:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);
const identity = 'demo-person';
const resumeId = 'muse-demo-resume';
const hash = 'd'.repeat(64);

// Every name, answer, email, posting and confirmation below is a fictional fixture.
// Nothing in this module reads account storage, opens files or contacts a service.
export function createDemoWorkspace(now = new Date()) {
  const parsed = new Date(now);
  if (!Number.isFinite(parsed.getTime())) throw new Error('Choose a valid date for demo fixtures.');
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(parsed).map(p=>[p.type,p.value]));
  const today = typeof now === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(now) ? now : `${parts.year}-${parts.month}-${parts.day}`, at = `${today}T14:00:00Z`;
  const roles = [
    { id: 'demo-interview', company: 'Cedar Systems (demo)', title: 'Backend Engineer', description: 'Build PostgreSQL SQL database services and explain system tradeoffs.', status: 'Interview' },
    { id: 'demo-ambiguous', company: 'Juniper Labs (demo)', title: 'Platform Engineer', description: 'Work on backend services and developer infrastructure.', status: 'Interview' },
    { id: 'demo-confirmed', company: 'Harbor Data (demo)', title: 'Database Engineer', description: 'Develop database query services.', status: 'Submitted' },
    { id: 'demo-uncertain', company: 'Lantern Compute (demo)', title: 'Infrastructure Engineer', description: 'Build reliable backend systems.', status: 'Blocked' },
    { id: 'demo-skip-location', company: 'Pine Networks (demo)', title: 'Backend Engineer', description: 'An office-only role outside the demo candidate’s preferred location.', status: 'New' },
    { id: 'demo-skip-level', company: 'Willow Software (demo)', title: 'Senior Platform Engineer', description: 'Experience requirements are unclear in this fictional posting.', status: 'New' },
  ].map(role => ({ ...role, employmentType: 'FT', type: 'FT', location: 'Fictional City, Remote', priority: 'Strong Consider', applicationUrl: `https://example.com/demo/jobs/${role.id}`, url: `https://example.com/demo/jobs/${role.id}`, discoveredDate: today, postedDate: today, whyItFits: role.id === 'demo-interview' ? 'Cedar builds multi-tenant job processing backed by PostgreSQL. This backend round focuses on retry safety, queue backpressure and SQL performance. Your fictional Query Lab project gives you a concrete latency-debugging example; rehearse how you would extend it to production failure handling.' : role.id === 'demo-confirmed' ? 'Harbor builds a SQL query engine. Your fictional SQL-service internship is relevant to query latency and index selection; prepare to explain an EXPLAIN plan and how you would validate a performance improvement.' : 'Fictional role for exercising Muse features. No real employer or opening.' }));
  const resume = { id: resumeId, name: 'Jordan Example — backend résumé (demo)', version: 2, filename: 'demo-backend-resume.pdf', content_hash: hash, text: 'Fictional profile: instrumented p95 SQL query latency in a sample service during an internship. Built Query Lab, a university project comparing indexed lookups and query plans. Production queue backpressure is a learning goal. No real candidate information.' };
  const questions = [
    { id: 'demo-why', question: 'Why are you interested in this team?', answer: 'Demo answer: I enjoy understanding database reliability and would like to build dependable services.', fieldType: 'text' },
    { id: 'demo-project', question: 'Tell us about a relevant project.', answer: 'Demo answer: I built a fictional course project that measured SQL query latency.', fieldType: 'textarea' },
  ];
  const applications = Object.fromEntries(roles.slice(0, 4).map(role => [role.id, {
    ...role, backendId: role.id, backendRevision: 1, revision: 1, resumeId, resumeName: resume.name, resumeVersion: resume.version,
    questions: copy(questions), questionsReviewed: true, note: 'Fictional demo application. Actions stay in the demo.',
    approved: { revision: 1, at, resume: copy(resume), questions: copy(questions) },
    activity: [{ at, text: 'Fictional application seeded for the demo.', actor: 'demo' }],
  }]));
  const guides = [{ id: 'demo-database-guide', title: 'Database interview guide (fictional demo resource)', url: 'https://example.com/demo/resources/database-interview', topics: ['database', 'backend', 'sql'], minutes: 30 }];
  const confirmedDate = day(today, 1);
  let confirmedPlan = createPreparationPlan({ application: applications['demo-interview'], now: at, guides, deadline: {
    date: confirmedDate, stage: 'Technical interview', confirmed: true,
    source: { kind: 'email', messageId: 'demo-email-confirmed', subject: 'Demo: your technical interview', receivedAt: at, excerpt: `Fictional email: your technical interview is on ${confirmedDate} at 14:00 UTC. Prepare to discuss SQL and backend design.`, url: 'https://example.com/demo/email/confirmed' },
  } });
  confirmedPlan = setPreparationTaskCompletion(confirmedPlan, confirmedPlan.tasks[0].id, true, at);
  // The compact interview brief keeps an undated round visibly unconfirmed.
  const ambiguousPlan = createPreparationPlan({ application: applications['demo-ambiguous'], now: at, guides, deadline: {
    date: 'next Friday', stage: 'Phone screen', confirmed: false,
    source: { kind: 'email', messageId: 'demo-email-ambiguous', subject: 'Demo: finding a time', receivedAt: at, excerpt: 'Fictional email: can you speak next Friday? We will confirm the date and time shortly.', url: 'https://example.com/demo/email/ambiguous' },
  } });
  const ambiguousPractice = ambiguousPlan.tasks.find(task => task.key === 'practice');
  if (ambiguousPractice) ambiguousPractice.detail = 'Fictional phone screen: explain your query-service project and ask which platform team is hiring. The date and interview format still need confirmation.';
  let secondPlan = createPreparationPlan({application:applications['demo-confirmed'],now:at,guides,deadline:{date:day(today,5),stage:'Technical interview',confirmed:true,source:{kind:'manual'}}});
  const companyGuide = {id:'cedar-lookout-report',title:'Cedar engineering guide',url:'https://example.com/demo/intelligence/cedar',companies:['Cedar Systems (demo)'],topics:['backend'],minutes:15,source:'lookout',observedAt:today,evidence:'Fictional report: a query-planning discussion followed by a backend design exercise.'};
  confirmedPlan = createPreparationPlan({application:applications['demo-interview'],now:at,previousPlan:confirmedPlan,guides:[...guides,companyGuide],deadline:{...confirmedPlan.deadline,confirmed:true}});
  const harborGuide = {id:'harbor-query-guide',title:'Harbor query engine notes',url:'https://example.com/demo/resources/harbor-query-engine',companies:['Harbor Data (demo)'],topics:['database'],minutes:15,source:'lookout',observedAt:today,evidence:'Fictional company resource covering query execution and index tradeoffs.'};
  secondPlan = createPreparationPlan({application:applications['demo-confirmed'],now:at,previousPlan:secondPlan,guides:[...guides,harborGuide],deadline:{...secondPlan.deadline,confirmed:true}});
  function variedPrep(plan, company, focus) {
    // Fictional examples exercise the same planner/session paths as real tasks.
    const tasks = plan.tasks.map(task => ['application','questions','logistics','guide-demo-database-guide'].includes(task.key) ? {...task,completed:true,completedAt:at} : task.key === 'practice' ? {...task,detail:company === 'Cedar' ? 'Query Lab → explain index tradeoffs for Cedar’s backend round. Focus on the production tradeoffs you have not practiced yet.' : 'SQL internship → explain index selectivity for Harbor’s round. Practice reading a query plan without relying on memorized answers.'} : task.guideId === 'cedar-lookout-report' ? {...task,detail:'Cedar’s queue notes → extend your Query Lab latency story. Fictional company resource.'} : task.guideId === 'harbor-query-guide' ? {...task,detail:'Harbor’s engine notes → revisit your SQL internship’s index choices. Fictional company resource.'} : task);
    const extra = [
      {key:'mock-interview',title:company === 'Cedar' ? 'Mock: job queues & retry safety' : 'Mock: SQL plans & index selection',detail:company === 'Cedar' ? 'Query Lab → rehearse Cedar’s queue retries and backpressure. Fictional mock: design a reliable queue and explain the failure modes aloud.' : 'SQL internship → practice Harbor’s query-plan analysis. Fictional mock: justify an index and measure its impact.',minutes:30},
      {key:'company-research',title:company === 'Cedar' ? 'Research Cedar’s job platform' : 'Research Harbor’s query engine',detail:company === 'Cedar' ? 'Query Lab → ask Cedar about noisy-neighbor isolation. Fictional company research brief.' : 'SQL internship → ask Harbor about query-plan regressions. Fictional company research brief.',minutes:15},
    ].map(task => ({...task,id:`${plan.applicationId}:${task.key}`,completed:false,completedAt:null,dueDate:plan.deadline.date}));
    return {...plan,tasks:[...tasks,...extra],warnings:plan.warnings.filter(warning=>warning !== 'The remaining preparation exceeds your daily time budget. Prioritize tasks or increase available time.')};
  }
  confirmedPlan = variedPrep(confirmedPlan,'Cedar','design a reliable job queue and discuss retries');
  secondPlan = variedPrep(secondPlan,'Harbor','explain SQL query plans and indexing choices');
  const prepRows = Object.fromEntries([confirmedPlan, ambiguousPlan, secondPlan].map(plan => [plan.applicationId, { application_id: plan.applicationId, user_id: identity, plan: copy(plan), version: 1, updated_at: at }]));
  function attempt(id, state) {
    const application = applications[id];
    const receipt = state === 'confirmed' ? {
      source: 'runner-observed-greenhouse-confirmation', marker: '#confirmation', message: 'Fictional demo confirmation: your application has been received.',
      jobUrl: application.url, observedUrl: `https://example.com/demo/confirmation/${id}`, observedAt: at,
    } : null;
    return { id: `${id}-attempt`, application_id: id, state, revision: 1, created_at: at, started_at: at, finished_at: at, receipt,
      context_snapshot: { application: { id, draft: { resumeId, resumeSha256: hash, questions: copy(questions) } }, job: { canonical_url: application.url }, resume: copy(resume) } };
  }
  const confirmedAttempt = attempt('demo-confirmed', 'confirmed'), uncertainAttempt = attempt('demo-uncertain', 'uncertain');
  confirmedAttempt.context_snapshot.application.draft.questions.push(
    { fieldId:'full_name', fieldType:'text', question:'Full name', answer:'Jordan Example (demo)' },
    { fieldId:'email', fieldType:'email', question:'Email', answer:'jordan@example.com' },
    { fieldId:'resume', fieldType:'file', question:'Resume attachment', answer:resumeId },
  );
  applications['demo-uncertain'].submissionAttempts = [{ id: uncertainAttempt.id, state: uncertainAttempt.state, startedAt: uncertainAttempt.started_at }];
  applications['demo-confirmed'].receipt = copy(confirmedAttempt.receipt);
  applications['demo-confirmed'].submittedAt = at;
  const submittedResume = { id: resumeId, name: resume.name, version: 2, variant: 'Backend', contentHash: hash };
  applications['demo-confirmed'].submittedResume = { ...copy(submittedResume), evidenceSource: 'observed_confirmation' };
  applications['demo-interview'].submittedResume = { ...copy(submittedResume), evidenceSource: 'email' };
  const email = (messageId, subject, excerpt) => ({ kind: 'email', messageId, subject, excerpt, receivedAt: at, url: `https://example.com/demo/email/${messageId}` });
  const milestone = (applicationId, key, kind, label, occurredAt, phase, source) => ({ id: `${applicationId}-${key}`, user_id: identity, application_id: applicationId, event_key: key, kind, label, occurred_at: occurredAt, phase, source: { ...copy(source), ...(kind === 'technical_round' ? {note:'Round focus: PostgreSQL query plans, queue retries and backpressure.\nYour evidence: Query Lab latency measurements and the SQL-service internship.\nPractice gap: explaining production failure handling beyond the university project.\nFictional recruiter brief and candidate evidence.'} : {}), ...(occurredAt ? { timestampConfirmed: true } : {}) }, created_at: at });
  const cedarSubmitted = `${day(today, -3)}T14:00:00Z`;
  applications['demo-interview'].submittedAt = cedarSubmitted;
  applications['demo-interview'].milestones = [
    milestone('demo-interview', 'submitted', 'submitted', 'Application submitted', cedarSubmitted, 'received', email('cedar-submitted', 'Demo: application received', `Fictional email: Cedar received your application on ${day(today, -3)} at 14:00 UTC with the demo backend résumé, version 2.`)),
    milestone('demo-interview', 'recruiter-call', 'recruiter_call', 'Recruiter call', `${day(today, -1)}T14:00:00Z`, 'completed', email('cedar-recruiter', 'Demo: thanks for the recruiter call', `Fictional email: thank you for speaking with our recruiter on ${day(today, -1)} at 14:00 UTC.`)),
    milestone('demo-interview', 'technical-round-1', 'technical_round', 'Technical round 1', `${confirmedDate}T14:00:00Z`, 'scheduled', copy(confirmedPlan.deadline.source)),
  ];
  applications['demo-ambiguous'].milestones = [
    milestone('demo-ambiguous', 'recruiter-date-unknown', 'recruiter_call', 'Recruiter call — date needs confirmation', null, 'scheduled', copy(ambiguousPlan.deadline.source)),
  ];
  applications['demo-confirmed'].milestones = [
    milestone('demo-confirmed', 'submitted', 'submitted', 'Application submitted', at, 'received', email('harbor-submitted', 'Demo: application received', `Fictional email: Harbor received your database engineering application on ${today} at 14:00 UTC.`)),
  ];
  // An uncertain click is an attempt, never a completed submission milestone.
  applications['demo-uncertain'].milestones = [];
  const submissionRecords = Object.fromEntries([
    ['demo-confirmed', confirmedAttempt], ['demo-uncertain', uncertainAttempt],
  ].map(([id, item]) => [id, { application: { id, status: applications[id].status, receipt: copy(item.receipt), submitted_at: item.state === 'confirmed' ? at : null }, attempts: [copy(item)] }]));
  const selectionDecisions = [
    { id: 'demo-decision-location', job_id: 'demo-skip-location', preference: 'excludedCompanies', reason: 'Company is excluded by your search settings.', evidence: 'The fictional posting is from Pine Networks (demo), which appears in the demo candidate’s excluded-company list.', certainty: 'exclusion', reconsidered_at: null, created_at: at, jobs: { employer: {company:'Pine Networks (demo)',title:'Backend Engineer'}, canonical_url: 'https://example.com/demo/jobs/demo-skip-location' } },
    { id: 'demo-decision-level', job_id: 'demo-skip-level', preference: 'Experience level', reason: 'Seniority requirements may be above your current target.', evidence: 'Fictional posting says senior but does not provide a clear experience range. Muse would need to verify the team’s expectations.', certainty: 'uncertain', reconsidered_at: null, created_at: at, jobs: { employer: {company:'Willow Software (demo)',title:'Senior Platform Engineer'}, canonical_url: 'https://example.com/demo/jobs/demo-skip-level' } },
  ];
  return {
    progress: { xp: 0, xpAwards: {}, streakDays: [] },
    tracker: { ids: roles.slice(0, 4).map(role => role.id), items: Object.fromEntries(roles.slice(0, 4).map(role => [role.id, { status: role.status === 'Submitted' ? 'Applied' : role.status === 'Blocked' ? 'New' : role.status, statusDate: today, openedDate: day(today, -3), ...(role.id === 'demo-confirmed' ? { appliedDate: today } : {}) }])) },
    drops: { seenDropIds: [], packStamps: {} }, network: { referrals: demoOutreachContacts(), people: [] },
    workflow: {
      applications, preparationPlans: { 'demo-interview': confirmedPlan, 'demo-ambiguous': ambiguousPlan, 'demo-confirmed':secondPlan },
      profile: { name: 'Jordan Example (fictional demo)', email: 'jordan@example.com', phone: '', location: 'Fictional City', authorization: 'Demo only', verified: false },
      resumes: [resume], savedAnswers: [], deletedAnswerIds: [], cloudDirty: false,
      theme: { pack: 'base' },
      searchPreferences: { autoSubmitApproved: false, excludedCompanies:['Pine Networks (demo)'], quietMode: { cadence: 'weekly', timezone: 'America/New_York', digestHour: 9, digestDay: 1, urgentDeadlineHours: 24 }, reviewPolicy: { fullTime: { mode: 'review' }, internship: { mode: 'review' } } },
      tierLists: [], activeTierListId: '',
    },
    ui: { packOpen: false },
    demo: { outreachLibrary: copy(outreachLibrary), fictional: true, identity, date: today, createdAt: at, personalVersion: 1, roles, preparationRows: prepRows, plannerSettings: { dailyMinutes: 45, version: 0 }, preparationSessions: [], submissionRecords, selectionDecisions, toolkitDiscovery: [
      { goal: 'Help me describe my most important project without inventing metrics.', guideId: 'career-profile-interview' },
      { goal: 'Rewrite my summary for this fictional job.', guideId: 'career-tailor-resume' },
      { goal: 'Help me prepare for my fictional interview.', guideId: 'career-prep-plan' },
    ] },
  };
}

export function createDemoServices(store) {
  if (typeof store?.get !== 'function' || typeof store?.set !== 'function' || store.get('demo.fictional') !== true) throw new Error('Demo services require the isolated fictional demo store.');
  function application(id) {
    const value = store.get(`workflow.applications.${id}`);
    if (!value || value.backendId !== id || !String(id).startsWith('demo-')) throw new Error('Fictional demo application not found.');
    return value;
  }
  const artifactDemo = createArtifactDemo(store);
  function plannerBundle() {
    return {...artifactDemo.artifactSnapshot(),applications:copy(store.get('workflow.applications') || {}),plans:Object.values(copy(store.get('demo.preparationRows') || {})),settings:copy(store.get('demo.plannerSettings') || {dailyMinutes:45,version:0}),sessions:copy(store.get('demo.preparationSessions') || []),timeZone:store.get('workflow.searchPreferences.quietMode.timezone') || 'UTC'};
  }
  return {
    backendJobs:createBackendJobsDemo(),
    async readApplicationBatches(payload={}) {return readDemoSubmissionBatches(payload);},
    async resolveProfileConflict(choice='review') {
      const scenario=store.get('demo.profileConflict');if(!scenario)throw Error('No fictional profile conflict');
      const result=reconcileProfileChanges(scenario.before,store.get('workflow.profile'),scenario.latest,choice);
      if(result.conflicts.length){store.set('ui.profileConflict',{fields:result.conflicts});return false;}
      store.set('workflow.profile',result.profile);store.set('ui.profileConflict',null);return true;
    },
    async editWorkExperience(payload) {
      const profile=store.get('workflow.profile');
      const timestamp=store.get('demo.profileUpdatedAt')||'2026-01-01T00:00:00.000Z';
      if(payload.expectedUpdatedAt!==timestamp)throw Error('Profile changed; reload before editing work history');
      const workExperience=editedWorkExperience(profile.workExperience||[],payload);
      if(JSON.stringify(workExperience)===JSON.stringify(profile.workExperience))return {facts:profile,updated_at:timestamp};
      const updated_at=new Date(Date.parse(timestamp)+1).toISOString();
      store.set('workflow.profile',{...profile,workExperience,verified:false});
      store.set('demo.profileUpdatedAt',updated_at);
      return {facts:store.get('workflow.profile'),updated_at,verified_at:null};
    },
    ...artifactDemo,
    ...createWorkflowDemo(store),
    async discoverToolkit() { return copy(store.get('demo.toolkitDiscovery') || []); },
    async readPreparationPlanner() { return plannerBundle(); },
    connections: createConnectionDemo(store),
    async savePreparationBudget(dailyMinutes, expectedVersion) {
      validatePlannerMinutes(dailyMinutes);
      if (expectedVersion !== plannerBundle().settings.version) throw Error('Budget changed. Reload before saving.');
      store.set('demo.plannerSettings',{dailyMinutes,version:expectedVersion+1});
      return plannerBundle();
    },
    async completePreparationSession(input) {
      const next=recordLocalPreparationSession(plannerBundle(), input);
      const workflow=store.get('workflow');
      const demo=store.get('demo');
      store.set('demo',{...demo,learningGoals:next.learningGoals,preparationSessions:next.sessions,preparationRows:Object.fromEntries(next.plans.map(row=>[row.application_id,row]))});
      store.set('workflow',{...workflow,preparationPlans:{...workflow.preparationPlans,...Object.fromEntries(next.plans.map(row=>[row.plan.applicationId,row.plan]))}});
      return plannerBundle();
    },

    knowledge: createCircleKnowledgeDemo(),
    async onboardingAction(operation, payload = {}) { return demoOnboardingAction(store, operation, payload); },
    async readApplicationTimeline(id) {
      const current = application(id);
      return { application: { ...copy(current), submitted_at: current.submittedAt || null }, milestones: copy(current.milestones || []) };
    },
    async recordApplicationMilestone(id, input) {
      const current = application(id);
      if (!input || typeof input.eventKey !== 'string' || !input.eventKey.trim() || input.eventKey.length > 120 || !['submitted', 'recruiter_call', 'technical_round', 'interview', 'offer', 'rejected', 'withdrawn'].includes(input.kind) || !['scheduled', 'completed', 'received'].includes(input.phase) || input.source?.kind !== 'user') throw new Error('Choose a valid user-reported demo milestone.');
      if (input.occurredAt != null && (typeof input.occurredAt !== 'string' || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(input.occurredAt) || !Number.isFinite(Date.parse(input.occurredAt)) || input.source.timestampConfirmed !== true)) throw new Error('Choose a valid milestone date with a confirmed time zone, or leave it unknown.');
      const milestones = copy(current.milestones || []);
      const source = { kind: 'user', ...(input.source.note ? { note: input.source.note } : {}), ...(input.occurredAt ? { timestampConfirmed: true } : {}) };
      const content = { kind: input.kind, label: input.label || input.kind.replaceAll('_', ' '), occurred_at: input.occurredAt || null, phase: input.phase, source };
      const existing = milestones.find(row => row.event_key === input.eventKey);
      if (existing) {
        if (Object.keys(content).some(key => JSON.stringify(existing[key]) !== JSON.stringify(content[key]))) {
          const error = new Error('Demo milestone changed. Reload before recording.'); error.code = '40001'; throw error;
        }
        return copy(existing);
      }
      const row = { id: `${id}-user-${input.eventKey}`, user_id: identity, application_id: id, event_key: input.eventKey, ...content, created_at: new Date().toISOString() };
      store.set(`workflow.applications.${id}`, { ...current, milestones: [...milestones, row] });
      return copy(row);
    },
    async readSubmissionRecord(id) {
      const current = application(id), record = store.get(`demo.submissionRecords.${id}`);
      return record ? copy(record) : { application: { id, status: current.status, receipt: null, submitted_at: null }, attempts: [] };
    },
    async readPreparation(id) { application(id); return copy(store.get(`demo.preparationRows.${id}`) || null); },
    async savePreparation(id, expectedVersion, plan) {
      application(id);
      const current = store.get(`demo.preparationRows.${id}`);
      if (!Number.isInteger(expectedVersion) || expectedVersion !== (current?.version || 0)) {
        const error = new Error('Demo preparation changed. Reload before saving.'); error.code = '40001'; throw error;
      }
      if (plan?.applicationId !== id || !Array.isArray(plan?.tasks) || !Array.isArray(plan?.guides) || !plan.deadline) throw new Error('Choose a valid plan for this demo application.');
      const row = { application_id: id, user_id: identity, plan: copy(plan), version: expectedVersion + 1, updated_at: new Date().toISOString() };
      store.set(`demo.preparationRows.${id}`, row);
      store.set(`workflow.preparationPlans.${id}`, copy(plan));
      return copy(row);
    },
    async readSelectionDecisions() { return copy(store.get('demo.selectionDecisions') || []); },
    async reconsiderSelection(id, expectedReconsideredAt = null) {
      const decisions = copy(store.get('demo.selectionDecisions') || []), index = decisions.findIndex(row => row.id === id);
      if (index < 0) throw new Error('Demo selection decision not found.');
      if ((decisions[index].reconsidered_at || null) !== (expectedReconsideredAt||null)) {
        const error = new Error('Demo selection changed. Reload before reconsidering.'); error.code = '40001'; throw error;
      }
      decisions[index].reconsidered_at ||= new Date().toISOString();
      store.set('demo.selectionDecisions', decisions);
      return copy(decisions[index]);
    },
    async readDeliveryPolicy(scenario='routine') {
      const now=new Date();
      const events=scenario==='decision'
        ? [{id:'demo-review',kind:'review',actionRequired:true,interrupt:true,summary:'Lantern Compute (demo) needs human verification of an uncertain submission.'}]
        : scenario==='selectivity'
        ? [{id:'demo-selectivity',kind:'selection',actionRequired:false,summary:'Muse skipped Pine Networks (demo) because it is excluded in your preferences. Willow Software (demo) may exceed your target experience; the team requirements still need verification. Ask Muse to reconsider either role or adjust your preferences.'}]
        : [{id:'demo-routine',kind:'submission',actionRequired:false,summary:'Harbor Data (demo) has a fictional observed confirmation.'}];
      return {fictional:true,delivery:buildDeliveryPolicy({settings:store.get('workflow.searchPreferences.quietMode'),now,lastDigestAt:now.toISOString(),events}),events};
    },
    async readQuietMode() {
      return { settings: normalizeQuietMode(store.get('workflow.searchPreferences.quietMode')), personalVersion: store.get('demo.personalVersion') || 1 };
    },
    async saveQuietMode(settings, expectedPersonalVersion) {
      const currentVersion = store.get('demo.personalVersion') || 1;
      if (!Number.isInteger(expectedPersonalVersion) || currentVersion !== expectedPersonalVersion) {
        const error = new Error('Demo preferences changed. Reload before saving.'); error.code = '40001'; throw error;
      }
      const normalized = normalizeQuietMode(settings);
      if (!settings || Array.isArray(settings) || typeof settings !== 'object' || Object.keys(settings).some(key => !(key in normalized)) || Object.keys(normalized).some(key => normalized[key] !== settings[key])) throw new Error('Choose valid quiet mode settings for the demo.');
      const preferences = store.get('workflow.searchPreferences') || {};
      store.set('workflow.searchPreferences', { ...preferences, quietMode: normalized });
      store.set('demo.personalVersion', currentVersion + 1);
      return { settings: copy(normalized), personalVersion: currentVersion + 1 };
    },
  };
}
