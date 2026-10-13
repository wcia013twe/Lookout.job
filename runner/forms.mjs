import { createHash } from 'node:crypto';

export const fingerprint = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

// Only published ATS job URLs are accepted. No arbitrary internal-network fetches.
export function identifyJob(rawUrl) {
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new Error('Expected an HTTPS ATS job URL');
  const path = url.pathname.split('/').filter(Boolean);
  if (['boards.greenhouse.io', 'job-boards.greenhouse.io'].includes(url.hostname) && path.length === 3 && path[1] === 'jobs' && /^\d+$/.test(path[2])) {
    return { ats: 'greenhouse', board: path[0], jobId: path[2], url: `${url.origin}/${path.join('/')}` };
  }
  if (url.hostname === 'jobs.ashbyhq.com' && path.length === 2 && /^[a-z0-9-]+$/i.test(path[1])) {
    return { ats: 'ashby', board: path[0], jobId: path[1], url: `${url.origin}/${path.join('/')}` };
  }
  throw new Error('Unsupported ATS URL; use manual application handoff');
}

const fieldTypes = { input_text: 'text', textarea: 'textarea', input_file: 'file', multi_value_single_select: 'select', multi_value_multi_select: 'multiselect', input_hidden: 'hidden' };
export function greenhouseForm(job, rawUrl) {
  const target = identifyJob(rawUrl);
  if (target.ats !== 'greenhouse' || String(job.id) !== target.jobId) throw new Error('Returned job does not match target');
  if (!Array.isArray(job.questions)) throw new Error('Employer question list unavailable');
  const questions = [...job.questions, ...(job.location_questions || []), ...(job.compliance || [])].map((question, index) => ({
    id: `question-${index}`, question: question.label, required: Boolean(question.required),
    fields: (question.fields || []).map(field => ({ id: field.name, type: fieldTypes[field.type] || 'unsupported', options: (field.values || []).map(option => ({ value: String(option.value), label: option.label })) })),
  }));
  const blockers = [];
  if (job.demographic_questions?.questions?.length) blockers.push('Demographic questions require explicit manual review');
  if (job.data_compliance?.some(rule => rule.requires_consent || rule.requires_processing_consent || rule.requires_retention_consent)) blockers.push('Employer data-consent requirements need manual review');
  if (questions.some(q => !q.question || !q.fields.length || q.fields.some(f => ['hidden', 'unsupported'].includes(f.type)))) blockers.push('Hidden or unsupported fields require browser review');
  return formResult(target, questions, blockers, 'public-api');
}

export function formResult(target, questions, blockers = [], source = 'browser') {
  const structure = { url: target.url, questions, blockers, source };
  return { ...target, questions, blockers, source, formFingerprint: fingerprint(structure), inspectedAt: new Date().toISOString(),
    // Public APIs and one DOM pass cannot guarantee conditional employer questions.
    complete: false, handoff: 'Review the employer form, including conditional fields, before approval' };
}

export async function inspectPublicForm(rawUrl, fetchImpl = fetch) {
  const target = identifyJob(rawUrl);
  if (target.ats !== 'greenhouse') return formResult(target, [], ['Ashby public postings do not expose applicant forms; inspect the browser form'], 'public-api');
  const endpoint = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(target.board)}/jobs/${target.jobId}?questions=true`;
  const response = await fetchImpl(endpoint, { redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Employer form lookup failed (${response.status})`);
  return greenhouseForm(await response.json(), rawUrl);
}
