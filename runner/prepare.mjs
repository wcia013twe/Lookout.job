import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';
import { identifyJob, fingerprint } from './forms.mjs';

// The caller must obtain these rows from the trusted gateway, never from an agent's claims.
export function assertApproval({ application, approval, job, resume, resumeBytes }) {
  if (!application?.id || !approval?.id || !application.user_id || application.status !== 'Approved' || application.blocker) throw new Error('Current application is not approved');
  if (approval.application_id !== application.id || approval.user_id !== application.user_id || approval.revision !== application.revision) throw new Error('Approval owner or revision mismatch');
  if (job?.id !== application.job_id) throw new Error('Approval job mismatch');
  const snapshot = approval.snapshot;
  if (!snapshot || !isDeepStrictEqual(snapshot.draft, application.draft)) throw new Error('Draft differs from approved snapshot');
  if (!snapshot.draft.questionsReviewed || !Array.isArray(snapshot.draft.questions)) throw new Error('Employer questions not reviewed');
  if (resume?.id !== snapshot.draft.resumeId || resume.user_id !== application.user_id || !isDeepStrictEqual(resume, snapshot.resume)) throw new Error('Resume differs from approved version');
  // A URL reference may change its contents. Require a pinned file hash before any runner use.
  const expectedHash = snapshot.draft.resumeSha256;
  if (!/^[a-f0-9]{64}$/.test(expectedHash || '') || !resumeBytes || createHash('sha256').update(resumeBytes).digest('hex') !== expectedHash) throw new Error('Pinned approved resume file checksum required');
  const target = identifyJob(job.canonical_url || job.application_url || job.applicationUrl || job.employer?.applicationUrl);
  if (snapshot.draft.url !== target.url) throw new Error('Exact approved job URL required');
  return snapshot;
}

// Authorization is loaded from the trusted gateway. Routine permission is
// distinct from a human approval; never manufacture an approval row locally.
export function assertExecutionAuthorization(context) {
  const { authorization: auth, application:a, resume, resumeBytes, job } = context;
  if (!auth || !['human','automatic'].includes(auth.mode) || auth.applicationId!==a?.id || auth.userId!==a.user_id || auth.revision!==a.revision || !['Queued','Draft','Awaiting approval','Approved'].includes(a.status) || a.blocker) throw new Error('Current execution authorization required');
  if (auth.mode==='human') return assertApproval(context);
  const snapshot=auth.snapshot;
  if (!isDeepStrictEqual(snapshot?.draft,a.draft) || !isDeepStrictEqual(snapshot?.resume,resume) || resume.user_id!==a.user_id || resume.id!==a.draft.resumeId || job.id!==a.job_id) throw new Error('Execution snapshot changed');
  if (!resumeBytes || createHash('sha256').update(resumeBytes).digest('hex')!==a.draft.resumeSha256 || identifyJob(job.canonical_url).url!==a.draft.url) throw new Error('Execution document or job changed');
  return snapshot;
}

export function prepareApprovedFields(context, form) {
  const snapshot = context.authorization ? assertExecutionAuthorization(context) : assertApproval(context);
  const actualFingerprint = fingerprint({ url: form.url, questions: form.questions, blockers: form.blockers, source: form.source });
  if (actualFingerprint !== form.formFingerprint) throw new Error('Employer form data does not match its fingerprint');
  if (form.url !== snapshot.draft.url || snapshot.draft.formFingerprint !== form.formFingerprint) throw new Error('Employer form changed; inspect and approve again');
  const blockers = [...form.blockers];
  const fields = [];
  for (const question of form.questions) {
    // Field IDs are explicit. Never infer personal answers from similar labels.
    for (const field of question.fields) {
      const answers = snapshot.draft.questions.filter(q => q.fieldId === field.id && q.question === question.question);
      if (answers.length > 1) { blockers.push(`Duplicate approved answer: ${question.question}`); continue; }
      const answer = answers[0];
      if (!answer || !String(answer.answer ?? '').trim()) {
        if (question.required || context.authorization?.mode === 'automatic') blockers.push(`Missing approved answer: ${question.question}`);
        continue;
      }
      if (answer.fieldType && answer.fieldType !== field.type) { blockers.push('Employer field type changed'); continue; }
      if (!['text', 'email', 'tel', 'url', 'textarea', 'select', 'radio', 'checkbox', 'file'].includes(field.type)) { blockers.push(`Unsupported field: ${question.question}`); continue; }
      if (['select', 'radio'].includes(field.type) && !field.options.some(option => option.value === String(answer.answer))) { blockers.push(`Unrecognized choice: ${question.question}`); continue; }
      if (field.type === 'checkbox' && !['true', 'false'].includes(String(answer.answer))) { blockers.push(`Checkbox needs explicit true or false: ${question.question}`); continue; }
      if (field.type === 'checkbox' && question.required && String(answer.answer) !== 'true') { blockers.push(`Required checkbox is not approved: ${question.question}`); continue; }
      if (field.type === 'file' && answer.answer !== context.resume.id) { blockers.push('File answer must reference the approved resume'); continue; }
      fields.push({ id: field.id, type: field.type, value: answer.answer });
    }
  }
  return { applicationId: context.application.id, approvalId: context.authorization?.id || context.approval.id, revision: context.application.revision,
    url: form.url, formFingerprint: form.formFingerprint, fields, blockers, status: blockers.length ? 'Blocked' : 'Prepared',
    submission: 'manual-handoff', message: 'Prefill is not submission. Complete conditional questions and submit on the employer page.' };
}
