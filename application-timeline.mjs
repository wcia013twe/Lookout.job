import { isObservedConfirmation } from './submission-record.mjs';
const clean = value => typeof value === 'string' ? value.trim() : '';
const statuses = value => clean(value).toLowerCase().replace(/[_-]+/g, ' ');
const callbacks = new Set(['recruiter_call', 'phone_screen', 'technical_round', 'interview', 'onsite']);
const labelFor = { application_submitted: 'Application submitted', recruiter_call: 'Recruiter call', phone_screen: 'Phone screen', technical_round: 'Technical round', interview: 'Interview', onsite: 'Onsite interview', offer: 'Offer received', rejected: 'Application rejected', withdrawn: 'Application withdrawn' };
function category(value) {
  const kind = clean(value).toLowerCase().replace(/[ .-]+/g, '_');
  if (['submitted', 'submission', 'application_submitted', 'submission_confirmed'].includes(kind)) return 'application_submitted';
  if (/^technical(?:_round)?_?\d*$/.test(kind)) return 'technical_round';
  return kind;
}
export function timelineDate(value) {
  const text = clean(value);
  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(text)) return null;
  const parsed = new Date(text);
  if (!Number.isFinite(parsed.getTime())) return null;
  // Date.parse otherwise silently rolls February 30 into March.
  if (new Date(`${text.slice(0, 10)}T00:00:00Z`).toISOString().slice(0, 10) !== text.slice(0, 10)) return null;
  return text;
}
function safeUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; } catch { return ''; }
}
function normalize(row, index) {
  const kind = category(row.kind), source = row.source || {};
  const round = clean(row.kind).match(/technical(?:[ _-]round)?[ _-]?(\d+)/i)?.[1];
  const label = clean(row.label) || (round ? `Technical round ${round}` : labelFor[kind]) || 'Process update';
  const phase = ['scheduled', 'completed', 'received'].includes(row.phase) ? row.phase : 'received';
  return { id: clean(row.id) || `milestone-${index}`, kind, label, occurred_at: timelineDate(row.occurred_at ?? row.at), phase,
    source: { kind: source.kind === 'email' ? 'email' : source.kind === 'user' ? 'user' : 'record', messageId: clean(source.messageId), subject: clean(source.subject), excerpt: clean(source.excerpt), receivedAt: clean(source.receivedAt), url: safeUrl(source.url) },
    observedConfirmation: false,
  };
}
function observed(application) {
  const receipt = application.receipt;
  return isObservedConfirmation(receipt) && (!application.url || !receipt.jobUrl || receipt.jobUrl === application.url);
}

/** Recorded milestones are separate from status: Interview never proves that a
 * submission was confirmed or that a scheduled interview already happened. */
export function timelineItems(application = {}, milestones = application.milestones || []) {
  const entries = (Array.isArray(milestones) ? milestones : []).filter(row => row && typeof row === 'object').map(normalize);
  const activity = Array.isArray(application.activity) ? application.activity : [];
  for (const row of activity) {
    if (!row || typeof row !== 'object') continue;
    const reported = clean(row.text).match(/^You reported (Submitted|Interview|Offer|Rejected|Withdrawn):/i)?.[1];
    const kind = reported ? category(reported) : category(row.kind);
    if (!labelFor[kind] || entries.some(item => item.id === row.id && row.id)) continue;
    entries.push(normalize({ ...row, id: row.id || `activity-${entries.length}`, kind, label: kind === 'interview' ? 'Interview update' : labelFor[kind], phase: ['application_submitted', 'rejected', 'withdrawn'].includes(kind) ? 'completed' : 'received', source: row.source || { kind: row.actor === 'user' || reported ? 'user' : 'record', excerpt: row.text } }, entries.length));
  }
  const confirmed = observed(application), submittedAt = timelineDate(application.submitted_at || application.submittedAt);
  const explicitSubmission = entries.find(item => item.kind === 'application_submitted');
  if (confirmed || submittedAt || statuses(application.status) === 'submitted') {
    if (explicitSubmission) { if (confirmed) { explicitSubmission.observedConfirmation = true; explicitSubmission.phase = 'completed'; } }
    else entries.unshift({ id: 'application-submission', kind: 'application_submitted', label: 'Application submitted', occurred_at: submittedAt || timelineDate(application.receipt?.observedAt), phase: 'completed', source: { kind: confirmed ? 'record' : 'user', messageId: '', subject: '', excerpt: confirmed ? clean(application.receipt.message) : '', receivedAt: '', url: '' }, observedConfirmation: confirmed });
  }
  const status = statuses(application.status);
  const statusKind = ['rejected', 'withdrawn', 'offer'].includes(status) ? status : ['interview', 'onsite', 'phone screen', 'recruiter call', 'technical interview', 'oa'].includes(status) ? 'interview' : '';
  if (statusKind && !entries.some(item => item.kind === statusKind || statusKind === 'interview' && callbacks.has(item.kind))) {
    entries.push({ id: 'current-status', kind: statusKind, label: statusKind === 'interview' ? 'Interview update' : labelFor[statusKind], occurred_at: null, phase: 'received', source: { kind: 'record', messageId: '', subject: '', excerpt: '', receivedAt: '', url: '' }, observedConfirmation: false });
  }
  const ordinal = { application_submitted: 0, recruiter_call: 1, phone_screen: 2, technical_round: 3, interview: 4, onsite: 5, offer: 6, rejected: 7, withdrawn: 7 };
  // Order known timestamps chronologically. Place undated process stages by
  // stage without assigning dates or disturbing the order of dated evidence.
  const dated = entries.filter(item => item.occurred_at).sort((a, b) => Date.parse(a.occurred_at) - Date.parse(b.occurred_at));
  const undated = entries.filter(item => !item.occurred_at).sort((a, b) => (ordinal[a.kind] ?? 4) - (ordinal[b.kind] ?? 4));
  for (const item of undated) {
    const before = dated.findIndex(existing => (ordinal[existing.kind] ?? 4) > (ordinal[item.kind] ?? 4));
    dated.splice(before < 0 ? dated.length : before, 0, item);
  }
  return dated;
}
export function hasTerminalOutcome(application = {}) {
 return ['rejected','withdrawn'].includes(statuses(application.status)) || timelineItems(application).some(item=>['rejected','withdrawn'].includes(item.kind)&&item.phase!=='scheduled');
}
export function hasCallback(application = {}) {
  if (hasTerminalOutcome(application)) return false;
  return ['interview', 'onsite', 'phone screen', 'recruiter call', 'technical interview', 'oa', 'offer'].includes(statuses(application.status)) || timelineItems(application).some(item => callbacks.has(item.kind) || item.kind === 'offer');
}
export function sortApplications(items = []) {
  const priority = item => hasTerminalOutcome(item) ? 3 : hasCallback(item) ? 0 : timelineItems(item).some(event => event.kind === 'application_submitted') ? 1 : 2;
  return [...items].map((item, index) => ({ item, index })).sort((a, b) => priority(a.item) - priority(b.item) || a.index - b.index).map(row => row.item);
}
