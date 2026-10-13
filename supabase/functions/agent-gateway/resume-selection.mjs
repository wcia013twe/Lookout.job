// User-authored rules only. A selection is a proposal, never approval to use a file.
export function selectResume({ userId, job, resumes, preferences = {} }) {
  if (!userId || !job || !Array.isArray(resumes)) throw new Error('Owner, job and resume records required');
  const owned = resumes.filter((resume) => resume.user_id === userId);
  const rules = preferences.resumeRules || [];
  if (!Array.isArray(rules)) throw new Error('resumeRules must be an array');
  const text = [job.title, job.category, job.employer?.title, job.employer?.category].filter(Boolean).join(' ').toLowerCase();
  const matches = rules.filter((rule) => Array.isArray(rule.keywords) && rule.keywords.length
    && rule.keywords.every((word) => typeof word === 'string' && word.trim())
    && rule.keywords.some((word) => text.includes(word.toLowerCase().trim())));
  const ids = [...new Set(matches.map((rule) => rule.resumeId).filter(Boolean))];
  const selectedId = ids.length === 0 ? preferences.defaultResumeId : ids.length === 1 ? ids[0] : null;
  if (!selectedId) return { status: 'Needs selection', reason: ids.length > 1 ? 'Overlapping resume rules; choose a variant' : 'No matching rule or default resume', candidates: owned.map((r) => ({ id: r.id, name: r.name, variant: r.variant })) };
  const selected = owned.find((resume) => resume.id === selectedId);
  if (!selected) return { status: 'Needs selection', reason: 'Configured resume is missing or belongs to another account', candidates: [] };
  return { status: 'Selected', resumeId: selected.id, reason: matches.length ? 'Matched your resume rule' : 'Used your default resume', requiresApproval: true };
}
