import { demoOnboardingAction } from "./onboarding-demo.mjs";
import { createPreparationPlan, setPreparationTaskCompletion } from '../../lib/preparation-model.mjs';
import { normalizeQuietMode, buildDeliveryPolicy } from '../../lib/quiet-mode.mjs';

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
  ].map(role => ({ ...role, employmentType: 'FT', type: 'FT', location: 'Fictional City, Remote', priority: 'Strong Consider', applicationUrl: `https://example.com/demo/jobs/${role.id}`, url: `https://example.com/demo/jobs/${role.id}`, discoveredDate: today, postedDate: today, whyItFits: 'Fictional role for exercising Muse features. No real employer or opening.' }));
  const resume = { id: resumeId, name: 'Jordan Example — backend résumé (demo)', version: 2, filename: 'demo-backend-resume.pdf', content_hash: hash, text: 'Fictional profile: built a sample SQL service and a university systems project. No real candidate information.' };
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
  const confirmedDate = day(today, 8);
  let confirmedPlan = createPreparationPlan({ application: applications['demo-interview'], now: at, guides, deadline: {
    date: confirmedDate, stage: 'Technical interview', confirmed: true,
    source: { kind: 'email', messageId: 'demo-email-confirmed', subject: 'Demo: your technical interview', receivedAt: at, excerpt: `Fictional email: your technical interview is on ${confirmedDate} at 14:00 UTC. Prepare to discuss SQL and backend design.`, url: 'https://example.com/demo/email/confirmed' },
  } });
  confirmedPlan = setPreparationTaskCompletion(confirmedPlan, confirmedPlan.tasks[0].id, true, at);
  const ambiguousPlan = createPreparationPlan({ application: applications['demo-ambiguous'], now: at, guides, deadline: {
    date: 'next Friday', stage: 'Phone screen', confirmed: false,
    source: { kind: 'email', messageId: 'demo-email-ambiguous', subject: 'Demo: finding a time', receivedAt: at, excerpt: 'Fictional email: can you speak next Friday? We will confirm the date and time shortly.', url: 'https://example.com/demo/email/ambiguous' },
  } });
  const prepRows = Object.fromEntries([confirmedPlan, ambiguousPlan].map(plan => [plan.applicationId, { application_id: plan.applicationId, user_id: identity, plan: copy(plan), version: 1, updated_at: at }]));
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
  applications['demo-confirmed'].receipt = copy(confirmedAttempt.receipt);
  applications['demo-confirmed'].submittedAt = at;
  const submittedResume = { id: resumeId, name: resume.name, version: 2, variant: 'Backend', contentHash: hash };
  applications['demo-confirmed'].submittedResume = { ...copy(submittedResume), evidenceSource: 'observed_confirmation' };
  applications['demo-interview'].submittedResume = { ...copy(submittedResume), evidenceSource: 'email' };
  const email = (messageId, subject, excerpt) => ({ kind: 'email', messageId, subject, excerpt, receivedAt: at, url: `https://example.com/demo/email/${messageId}` });
  const milestone = (applicationId, key, kind, label, occurredAt, phase, source) => ({ id: `${applicationId}-${key}`, user_id: identity, application_id: applicationId, event_key: key, kind, label, occurred_at: occurredAt, phase, source: { ...copy(source), ...(kind === 'technical_round' ? {note:'Fictional private note: review SQL query plans and distributed-system tradeoffs before this round.'} : {}), ...(occurredAt ? { timestampConfirmed: true } : {}) }, created_at: at });
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
    drops: { seenDropIds: [], packStamps: {} }, network: { referrals: [], people: [] },
    workflow: {
      applications, preparationPlans: { 'demo-interview': confirmedPlan, 'demo-ambiguous': ambiguousPlan },
      profile: { name: 'Jordan Example (fictional demo)', email: 'jordan@example.com', phone: '', location: 'Fictional City', authorization: 'Demo only', verified: false },
      resumes: [resume], savedAnswers: [], deletedAnswerIds: [], cloudDirty: false,
      theme: { pack: 'base' },
      searchPreferences: { autoSubmitApproved: false, excludedCompanies:['Pine Networks (demo)'], quietMode: { cadence: 'weekly', timezone: 'America/New_York', digestHour: 9, digestDay: 1, urgentDeadlineHours: 24 }, reviewPolicy: { fullTime: { mode: 'review' }, internship: { mode: 'review' } } },
      tierLists: [], activeTierListId: '',
    },
    ui: { packOpen: false },
    demo: { fictional: true, identity, date: today, createdAt: at, personalVersion: 1, roles, preparationRows: prepRows, submissionRecords, selectionDecisions },
  };
}

export function createDemoServices(store) {
  if (typeof store?.get !== 'function' || typeof store?.set !== 'function' || store.get('demo.fictional') !== true) throw new Error('Demo services require the isolated fictional demo store.');
  function application(id) {
    const value = store.get(`workflow.applications.${id}`);
    if (!value || value.backendId !== id || !String(id).startsWith('demo-')) throw new Error('Fictional demo application not found.');
    return value;
  }
  return {
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
