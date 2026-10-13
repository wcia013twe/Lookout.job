import { applicationPolicy } from './application-policy.mjs';
import { selectResume } from './resume-selection.mjs';
const normalize = value => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase().replace(/[ *:]+$/g, '');
const equal = (a,b) => canonical(a) === canonical(b);
function canonical(value) {
  if (Array.isArray(value)) return JSON.stringify(value.map(v => JSON.parse(canonical(v))));
  if (value && typeof value === 'object') return JSON.stringify(Object.fromEntries(Object.keys(value).sort().map(key => [key, JSON.parse(canonical(value[key]))])));
  return JSON.stringify(value ?? null);
}
const FACT_LABELS = {
  name: ['name','full name','legal name'], firstName: ['first name'], lastName: ['last name'],
  email: ['email','email address'], phone: ['phone','phone number'],
  location: ['location','current location','city'], linkedin: ['linkedin','linkedin profile','linkedin profile url'],
  portfolio: ['website','portfolio','portfolio url'],
};
export function authorizeSubmission(context) {
  const { application:a, job, resume, profile, approval, preferences, answers = [] } = context;
  const reject = reason => ({ allowed:false, reason });
  if (!a?.id || !a.user_id || !job || job.id !== a.job_id || !['Queued','Draft','Awaiting approval','Approved'].includes(a.status) || a.blocker) return reject('Current application is blocked or past drafting.');
  const draft = a.draft;
  if (!draft || draft.url !== job.canonical_url || !/^[a-f0-9]{64}$/.test(draft.resumeSha256 || '') || !/^[a-f0-9]{64}$/.test(draft.formFingerprint || '') || !Array.isArray(draft.questions) || !draft.questions.length) return reject('Inspect the employer form and pin draft metadata first.');
  let target;
  try { target = new URL(job.canonical_url); } catch { return reject('Canonical employer URL required.'); }
  if (!['boards.greenhouse.io','job-boards.greenhouse.io'].includes(target.hostname) || target.protocol !== 'https:' || target.port || target.username || target.password || target.search || target.hash || !/^\/[^/]+\/jobs\/\d+$/.test(target.pathname)) return reject('Automatic submission currently supports canonical Greenhouse forms only.');
  if (!resume || resume.id !== draft.resumeId || resume.user_id !== a.user_id || !resume.object_path || resume.content_hash !== draft.resumeSha256) return reject('Use an owned private uploaded résumé with a matching file hash.');
  const policy = applicationPolicy({ preferences, job:job.employer });
  if (policy.mode === 'skip') return reject(policy.reason);
  const humanApproval = a.status === 'Approved' && approval && approval.application_id === a.id
    && approval.user_id === a.user_id && approval.revision === a.revision && draft.questionsReviewed
    && profile?.verified_at && equal(approval.snapshot?.profile,profile.facts)
    && equal(approval.snapshot?.draft,draft) && equal(approval.snapshot?.resume,resume);
  if (humanApproval) return { allowed:true, authorization:{ mode:'human', id:approval.id, applicationId:a.id,userId:a.user_id,revision:a.revision,personalVersion:context.personalVersion,snapshot:approval.snapshot } };
  if (policy.mode === 'review') return reject('Important match or auto-apply off: approve this exact draft first.');
  if (!profile?.verified_at || profile.user_id !== a.user_id) return reject('Verified profile required for routine auto-apply.');
  const selected = selectResume({ userId:a.user_id,job:job.employer,resumes:context.resumes,preferences:preferences?.search });
  if (selected.status !== 'Selected' || selected.resumeId !== resume.id) return reject('Select a default résumé or an unambiguous matching résumé rule.');
  const ids = new Set();
  for (const q of draft.questions) {
    if (!q?.fieldId || !q.question || ids.has(q.fieldId) || q.answer == null || !String(q.answer).trim()) return reject('Missing or ambiguous employer answer.');
    ids.add(q.fieldId);
    if (q.fieldType === 'file' && q.answer === resume.id && ['resume','resume/cv','resume / cv','cv','upload resume','attach resume'].includes(normalize(q.question))) continue;
    const matches = answers.filter(saved => normalize(saved.question) === normalize(q.question) && (!saved.company_scope || normalize(saved.company_scope) === normalize(job.employer.company)));
    if (matches.length === 1 && matches[0].id === q.savedAnswerId && matches[0].user_id === a.user_id && matches[0].autofill_policy === 'auto' && matches[0].verified_at && (matches[0].context?.version || 1) === q.savedAnswerVersion && String(q.answer) === matches[0].answer) continue;
    // Exact labels and exact verified values only. Authorization/eligibility/custom
    // essays must use explicitly permitted saved answers, never inferred facts.
    const labels = FACT_LABELS[q.profileField];
    if (labels?.includes(normalize(q.question)) && typeof profile.facts?.[q.profileField] === 'string' && q.answer === profile.facts[q.profileField]) continue;
    return reject('An unfamiliar or unpermitted answer needs your review.');
  }
  return { allowed:true, authorization:{ mode:'automatic', id:`automatic:${a.id}:${a.revision}:${context.personalVersion}`,applicationId:a.id,userId:a.user_id,revision:a.revision,personalVersion:context.personalVersion,snapshot:{draft,profile:profile.facts,resume} } };
}
