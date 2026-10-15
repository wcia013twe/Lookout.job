const clean = value => typeof value === 'string' ? value.trim() : '';
const DAY = 86400000;
export const PREPARATION_GUIDES = [
  { id: 'amazon-interview', source: 'official', title: 'Amazon software development interview preparation', url: 'https://amazon.jobs/content/en/how-we-hire/interview-prep/software-development-topics', companies: ['amazon', 'amazon web services', 'aws', 'amazon.com'], topics: [], minutes: 30 },
  { id: 'microsoft-interview', source: 'official', title: 'Microsoft technical interview preparation', url: 'https://careers.microsoft.com/v2/global/en/hiring-tips/technical-interviewing.html', companies: ['microsoft'], topics: [], minutes: 30 },
  { id: 'javascript', title: 'JavaScript language guide', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide', topics: ['javascript', 'typescript', 'frontend', 'react'], minutes: 30 },
  { id: 'python', title: 'Python tutorial', url: 'https://docs.python.org/3/tutorial/', topics: ['python', 'machine learning', 'ml', 'ai'], minutes: 30 },
  { id: 'postgres', title: 'PostgreSQL tutorial', url: 'https://www.postgresql.org/docs/current/tutorial.html', topics: ['sql', 'database', 'postgres', 'backend'], minutes: 30 },
];
export function preparationDate(value) {
  const date = clean(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : null;
}
function dayOffset(date, offset) { return new Date(Date.parse(`${date}T00:00:00Z`) + offset * DAY).toISOString().slice(0, 10); }
function safeLink(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; } catch { return ''; }
}
export function validatePreparationDeadline(value = {}) {
  const source = value?.source || {};
  const date = preparationDate(value?.date);
  const normalizedSource = { kind: source.kind === 'email' ? 'email' : 'manual', messageId: clean(source.messageId), subject: clean(source.subject), excerpt: clean(source.excerpt), receivedAt: clean(source.receivedAt), url: safeLink(source.url) };
  const problems = [];
  if (!date) problems.push('Confirm an exact calendar date before scheduling preparation.');
  if (value?.confirmed !== true) problems.push('This deadline needs confirmation.');
  if (source.kind === 'email' && (!normalizedSource.messageId || !normalizedSource.excerpt)) problems.push('Email deadlines need a message reference and the wording that supports the date.');
  return { date, stage: clean(value?.stage) || 'Interview', confirmed: value?.confirmed === true, source: normalizedSource, status: problems.length ? 'needs_confirmation' : 'confirmed', problems };
}
export function selectPreparationGuides(application = {}, guides = PREPARATION_GUIDES) {
  const text = [application.title, application.description, application.whyItFits, ...(Array.isArray(application.skills) ? application.skills : [])].filter(value => typeof value === 'string').join(' ').toLowerCase();
  const companyKey = value => clean(value).toLowerCase().replace(/[,]/g, '').replace(/\s+(inc\.?|corporation|corp\.?|ltd\.?)$/, '').trim();
  return (Array.isArray(guides) ? guides : []).filter(guide => guide && clean(guide.id) && clean(guide.title)).map(guide => {
    const companies = Array.isArray(guide.companies) ? guide.companies : [];
    const companyMatch = companies.some(company => companyKey(company) === companyKey(application.company));
    const matchedTopics = (Array.isArray(guide.topics) ? guide.topics : []).filter(topic => clean(topic) && new RegExp(`(^|[^a-z])${String(topic).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`, 'i').test(text));
    return { ...guide, id: clean(guide.id), title: clean(guide.title), url: safeLink(guide.url), companyMatch, matchedTopics: companyMatch ? [`${clean(application.company)} interview preparation`, ...matchedTopics] : matchedTopics, minutes: Math.min(120, Math.max(15, Number(guide.minutes) || 30)), applicable: companies.length ? companyMatch : matchedTopics.length > 0 };
  }).filter(guide => guide.url && guide.applicable).sort((a, b) => Number(b.companyMatch) - Number(a.companyMatch) || b.matchedTopics.length - a.matchedTopics.length || a.id.localeCompare(b.id)).slice(0, 3);
}
function savedApplicationReview(application) {
  const resume = application.approved?.resume || application.resumeSnapshot || application.resume || {};
  const name = clean(application.resumeName) || clean(resume.name) || clean(resume.fileName) || clean(resume.filename) || clean(resume.title);
  const version = application.resumeVersion ?? resume.version;
  const versionLabel = typeof version === 'string' || typeof version === 'number' ? String(version).trim() : '';
  const questions = application.submittedAnswers ?? application.approved?.questions ?? application.questions;
  const prompts = (Array.isArray(questions) ? questions : []).map(item => clean(typeof item === 'string' ? item : item?.question)).filter(Boolean).slice(0, 3);
  return ['Revisit your saved resume and answers. Pick examples you can explain consistently.',
    name && `Saved resume: ${name}.`, versionLabel && `Resume version: ${versionLabel}.`,
    !name && !versionLabel && clean(application.resumeId) && `Saved resume reference: ${clean(application.resumeId)}.`,
    prompts.length && `Revisit these saved questions: ${prompts.map(prompt => `“${prompt}”`).join('; ')}.`].filter(Boolean).join(' ');
}
export function createPreparationPlan({ application = {}, deadline = {}, previousPlan = null, now = new Date(), dailyMinutes = 45, guides = PREPARATION_GUIDES } = {}) {
  if (!clean(application.id)) throw new Error('Choose a saved application before creating a preparation plan.');
  const today = preparationDate(typeof now === 'string' ? now.slice(0, 10) : now.toISOString().slice(0, 10));
  if (!today) throw new Error('Preparation requires a valid current date.');
  const minutes = Math.min(240, Math.max(15, Number.isFinite(Number(dailyMinutes)) ? Math.round(Number(dailyMinutes)) : 45));
  const checked = validatePreparationDeadline(deadline);
  const selectedGuides = selectPreparationGuides(application, guides);
  const sameApplication = previousPlan?.applicationId === application.id;
  const previousTasks = sameApplication && Array.isArray(previousPlan.tasks) ? previousPlan.tasks : [];
  const role = clean(application.title) || 'this role';
  const company = clean(application.company) || 'the company';
  const definitions = [
    { key: 'application', title: `Review what you submitted for ${role}`, detail: savedApplicationReview(application), minutes: 20 },
    ...selectedGuides.map(guide => ({ key: `guide-${guide.id}`, title: `Review ${guide.title}`, detail: `Focus on ${guide.matchedTopics.join(', ')} for ${role}.`, minutes: guide.minutes || 30, guideId: guide.id })),
    { key: 'practice', title: /oa|technical|coding/i.test(checked.stage) ? `Practice technical questions for ${role}` : `Rehearse examples for your ${checked.stage.toLowerCase()}`, detail: `Use the posting's requirements and your actual experience. Practice explaining decisions and tradeoffs aloud.`, minutes: 30 },
    { key: 'questions', title: `Prepare questions for ${company}`, detail: 'Ask about the team, expectations, and any unclear part of the process.', minutes: 15 },
    { key: 'logistics', title: 'Check interview logistics', detail: 'Review the email for format, time zone, meeting link, and required materials.', minutes: 15 },
  ];
  const tasks = definitions.map(definition => {
    const id = `${application.id}:${definition.key}`;
    const old = previousTasks.find(task => task.id === id);
    return { ...definition, id, completed: old?.completed === true, completedAt: old?.completed === true ? old.completedAt || null : null, dueDate: old?.completed === true ? old.dueDate || null : null };
  });
  // Retain completed work even if a changed role removes its resource recommendation.
  for (const old of previousTasks) if (old.completed && !tasks.some(task => task.id === old.id)) tasks.push({ ...old });
  const warnings = [...checked.problems];
  if (checked.status === 'confirmed') {
    let cursor = checked.date > today ? dayOffset(checked.date, -1) : today;
    let remaining = minutes;
    let overflow = false;
    for (const task of tasks.filter(task => !task.completed).reverse()) {
      if (remaining < task.minutes) {
        if (cursor > today) { cursor = dayOffset(cursor, -1); remaining = minutes; }
        else overflow = true;
      }
      task.dueDate = cursor;
      remaining -= task.minutes;
      if (task.minutes > minutes) overflow = true;
    }
    if (checked.date < today) warnings.push('This deadline has passed. Confirm the next stage before relying on this schedule.');
    if (overflow) warnings.push('The remaining preparation exceeds your daily time budget. Prioritize tasks or increase available time.');
  }
  const changed = sameApplication && previousPlan.deadline?.date !== checked.date;
  return { applicationId: application.id, deadline: checked, dailyMinutes: minutes, guides: selectedGuides, tasks, warnings, updatedAt: typeof now === 'string' ? now : now.toISOString(), scheduleChanged: Boolean(changed), previousDeadline: changed ? previousPlan.deadline?.date || null : null };
}
export function setPreparationTaskCompletion(plan, taskId, completed, now = new Date()) {
  if (!plan?.tasks?.some(task => task.id === taskId)) throw new Error('Preparation task not found.');
  return { ...plan, tasks: plan.tasks.map(task => task.id === taskId ? { ...task, completed: Boolean(completed), completedAt: completed ? (typeof now === 'string' ? now : now.toISOString()) : null } : task) };
}
