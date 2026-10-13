import { identifyJob, formResult } from './forms.mjs';
import { prepareApprovedFields } from './prepare.mjs';
import { collectApplicationControls } from './vendor/application-controls.mjs';

// The agent's own permitted Playwright runtime supplies Page. No AI calls or browser launch.
export async function inspectBrowserForm(page) {
  const target = identifyJob(page.url());
  const result = await page.evaluate(collectApplicationControls);
  if (identifyJob(page.url()).url !== target.url) throw new Error('Employer page changed during inspection');
  return formResult(target, result.questions, result.blockers);
}

export async function prefillApprovedForm(page, context) {
  const form = await inspectBrowserForm(page);
  const plan = prepareApprovedFields(context, form);
  if (plan.blockers.length) return plan;
  if (plan.fields.some(field => field.type === 'file') && !context.resumeBytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
    return { ...plan, status: 'Blocked', blockers: ['Browser adapter currently accepts PDF resumes only; use manual upload for other formats'] };
  }
  // Resolve every binding before any write. Ambiguity must not partially fill a form.
  const bindings = [];
  for (const field of plan.fields) {
    const escaped = JSON.stringify(field.id);
    const selector = field.type === 'radio'
      ? `input[type="radio"][name=${escaped}][value=${JSON.stringify(String(field.value))}]`
      : `[id=${escaped}], [name=${escaped}]`;
    const locator = page.locator(selector);
    if (await locator.count() !== 1) return { ...plan, status: 'Blocked', blockers: ['Employer control changed; review again'] };
    bindings.push({ field, locator });
  }
  for (const { field, locator } of bindings) {
    if (identifyJob(page.url()).url !== form.url) throw new Error('Employer page changed before prefill');
    if (field.type === 'file') await locator.setInputFiles({ name: 'resume.pdf', mimeType: 'application/pdf', buffer: context.resumeBytes });
    else if (field.type === 'select') await locator.selectOption(String(field.value));
    else if (field.type === 'radio') await locator.check();
    else if (field.type === 'checkbox') await locator.setChecked(String(field.value) === 'true');
    else await locator.fill(String(field.value));
    const after = await inspectBrowserForm(page);
    if (after.formFingerprint !== form.formFingerprint || after.blockers.length) return { ...plan, status: 'Blocked', blockers: ['Conditional employer form changed after prefill; inspect and review again', ...after.blockers] };
  }
  return plan;
}

// Integrations use this entry point to re-read current server approval.
export async function prefillCurrentApplication(page, applicationId, loadCurrentContext) {
  if (typeof loadCurrentContext !== 'function') throw new Error('Trusted current-context loader required');
  const context = await loadCurrentContext(applicationId);
  if (context?.application?.id !== applicationId) throw new Error('Current application mismatch');
  return prefillApprovedForm(page, context);
}
