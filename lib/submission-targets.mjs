// Shared URL and confirmation rules for the browser runner, Edge and UI.
export const CONFIRMATION_RULES = Object.freeze({
  greenhouse: { markers: ['#confirmation', '#application_confirmation', '[data-testid="application-confirmation"]'], paths: ['', '/confirmation'] },
  ashby: { markers: ['[data-testid="application-confirmation"]', '.ashby-application-form-success', 'h1', 'h2'], paths: ['', '/application', '/confirmation'] },
  lever: { markers: ['.application-received', '[data-qa="application-confirmation"]', 'h1', 'h2'], paths: ['', '/apply', '/thanks', '/apply/thanks', '/apply/success'] },
});
export const CONFIRMATION_MESSAGE = /thank you for applying|thanks for applying|application (?:has been |was )?submitted|application (?:has been |was )?received|received your application/i;
export const CONFIRMATION_REJECTION = /already applied|already received|previously|spam|could not|couldn't|unable|not (?:been )?(?:submitted|received)|haven't received|have not received|limit reached/i;

export function identifySubmissionTarget(rawUrl) {
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:' || url.username || url.password || url.port) throw Error('Expected an HTTPS ATS job URL');
  const path = url.pathname.split('/').filter(Boolean);
  let ats;
  if (['boards.greenhouse.io', 'job-boards.greenhouse.io'].includes(url.hostname) && path.length === 3 && /^[a-z0-9_-]+$/i.test(path[0]) && path[1] === 'jobs' && /^\d+$/.test(path[2])) ats = 'greenhouse';
  else if (url.hostname === 'jobs.ashbyhq.com' && (path.length === 2 || (path.length === 3 && path[2] === 'application')) && /^[a-z0-9_-]+$/i.test(path[0]) && /^[a-z0-9-]+$/i.test(path[1])) ats = 'ashby';
  else if (['jobs.lever.co', 'jobs.eu.lever.co'].includes(url.hostname) && (path.length === 2 || (path.length === 3 && path[2] === 'apply')) && /^[a-z0-9_-]+$/i.test(path[0]) && /^[a-z0-9-]+$/i.test(path[1])) ats = 'lever';
  else throw Error('Unsupported ATS URL; use manual application handoff');
  const parts = ats === 'greenhouse' ? path : path.slice(0, 2);
  return { ats, board: path[0], jobId: parts.at(-1), url: `${url.origin}/${parts.join('/')}` };
}

export function canonicalSubmissionTarget(rawUrl) {
  const target = identifySubmissionTarget(rawUrl);
  if (target.url !== rawUrl) throw Error('Canonical Greenhouse, Ashby or Lever posting required');
  return target;
}

export function confirmationUrlMatches(jobUrl, observedUrl) {
  try {
    const target = canonicalSubmissionTarget(jobUrl), expected = new URL(jobUrl), observed = new URL(observedUrl);
    return expected.origin === observed.origin && !observed.search && !observed.hash && !observed.username && !observed.password
      && CONFIRMATION_RULES[target.ats].paths.some(suffix => observed.pathname === expected.pathname + suffix);
  } catch { return false; }
}

export function validSubmissionReceipt(receipt) {
  try {
    const target = canonicalSubmissionTarget(receipt.jobUrl);
    return receipt.source === `runner-observed-${target.ats}-confirmation`
      && CONFIRMATION_RULES[target.ats].markers.includes(receipt.marker)
      && typeof receipt.message === 'string' && receipt.message.length <= 1000 && CONFIRMATION_MESSAGE.test(receipt.message) && !CONFIRMATION_REJECTION.test(receipt.message)
      && confirmationUrlMatches(receipt.jobUrl, receipt.observedUrl);
  } catch { return false; }
}
