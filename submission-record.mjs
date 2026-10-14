const labels = {
  claimed: 'Preparing submission', started: 'Submission started',
  confirmed: 'Confirmed submitted', uncertain: 'Confirmation unavailable',
  cancelled: 'Attempt closed',
};
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

export function isObservedConfirmation(receipt) {
  return receipt?.source === 'runner-observed-greenhouse-confirmation'
    && typeof receipt.message === 'string' && receipt.message.trim().length > 0
    && ['#confirmation', '#application_confirmation', '[data-testid="application-confirmation"]'].includes(receipt.marker);
}

// Only attempt snapshots describe the material used for that attempt. Current
// drafts and answer-library entries may have changed since execution.
export function buildSubmissionRecord(application = {}, attempts = []) {
  const records = attempts.filter(row => row.application_id === application.id).map(row => {
    const context = object(row.context_snapshot);
    const draft = object(object(context.application).draft);
    const resume = object(context.resume);
    const confirmed = row.state === 'confirmed' && isObservedConfirmation(row.receipt)
      && row.receipt.jobUrl === context.job?.canonical_url;
    return {
      id: row.id, revision: row.revision, state: row.state,
      label: row.state === 'confirmed' && !confirmed ? 'Confirmation evidence unavailable' : labels[row.state] || 'Unknown attempt state',
      confirmed, createdAt: row.created_at || null, startedAt: row.started_at || null,
      finishedAt: row.finished_at || null,
      receipt: confirmed ? row.receipt : null,
      resume: resume.id ? { id: resume.id, name: resume.name || 'Saved résumé', objectPath: resume.object_path || null, sha256: resume.content_hash || draft.resumeSha256 || null } : null,
      questions: Array.isArray(draft.questions) ? draft.questions.map(q => ({ question: q.question || 'Application question', answer: q.answer ?? null, fieldType: q.fieldType || null })) : [],
      hasSnapshot: Boolean(context.application),
    };
  }).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  return {
    attempts: records,
    legacyReceipt: !records.some(row => row.confirmed) && isObservedConfirmation(application.receipt) ? application.receipt : null,
    userReported: application.status === 'Submitted' && !isObservedConfirmation(application.receipt) && !records.some(row => row.confirmed),
    submittedAt: application.submitted_at || application.submittedAt || null,
  };
}
