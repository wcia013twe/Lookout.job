import { identifyJob } from './forms.mjs';
import { openApplicationForm } from './ats.mjs';
import { inspectBrowserForm, prefillCurrentApplication } from './browser.mjs';
import { selectResume } from './resume-selection.mjs';

// Register these functions in Muse's local runtime. The remote board MCP remains data-only.
// A dedicated Page is required; do not reuse a person's unrelated browser tab.
export function createApplicationTools({ getPage, loadCurrentContext }) {
  if (typeof getPage !== 'function' || typeof loadCurrentContext !== 'function') {
    throw new Error('Dedicated browser provider and trusted current-context loader required');
  }
  return {
    async inspect_application({ url }) {
      const target = identifyJob(url);
      const page = await getPage();
      await page.goto(target.url);
      const entry = await openApplicationForm(page);
      if (entry.status === 'Blocked') return entry;
      return inspectBrowserForm(page);
    },
    async prefill_application({ applicationId }) {
      if (typeof applicationId !== 'string' || !applicationId) throw new Error('Application ID required');
      const page = await getPage();
      // Do not navigate, infer answers, select another resume or change an approved draft here.
      const result = await prefillCurrentApplication(page, applicationId, loadCurrentContext);
      return { status: result.status, applicationId: result.applicationId, revision: result.revision,
        formFingerprint: result.formFingerprint, blockers: result.blockers,
        filledFields: result.status === 'Prepared' ? result.fields.length : undefined,
        submission: result.submission, message: result.message };
    },
    // Proposal-only helper: call before creating the draft and seeking human approval.
    select_resume: selectResume,
  };
}
