import { identifyJob, formResult } from './forms.mjs';
import { prepareApprovedFields, assertApproval, assertExecutionAuthorization } from './prepare.mjs';
import { collectApplicationControls } from './vendor/application-controls.mjs';
import { failApplication } from '../lib/application-blockers.mjs';

// The agent's own permitted Playwright runtime supplies Page. No AI calls or browser launch.
export async function inspectBrowserForm(page) {
  const target = identifyJob(page.url());
  const result = await page.evaluate(collectApplicationControls);
  if (identifyJob(page.url()).url !== target.url) throw new Error('Employer page changed during inspection');
  return formResult(target, result.questions, result.blockers);
}

export async function prefillApprovedForm(page, context) {
  context.authorization ? assertExecutionAuthorization(context) : assertApproval(context);
  const form = await inspectBrowserForm(page);
  if(context.application?.draft?.formFingerprint!==form.formFingerprint) {
    const saved=context.application?.draft?.questions||[];
    const changed=form.questions.filter(q=>q.fields.some(f=>!saved.some(old=>old.fieldId===f.id&&old.question===q.question&&old.fieldType===f.type&&JSON.stringify(old.options||[])===JSON.stringify(f.options||[]))));
    failApplication('form-changed',{questions:changed,reasons:form.blockers});
  }
  const plan = prepareApprovedFields(context, form);
  if (plan.blockers.length) return {...plan,questions:form.questions.filter(q=>plan.blockers.some(reason=>reason.includes(q.question)))};
  if (plan.fields.some(field => field.type === 'file') && !context.resumeBytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
    return { ...plan, status: 'Blocked', blockers: ['Browser adapter currently accepts PDF resumes only; use manual upload for other formats'],questions:form.questions.filter(q=>q.fields.some(f=>f.type==='file')) };
  }
  // Resolve every binding before any write. Ambiguity must not partially fill a form.
  const bindings = [];
  for (const field of plan.fields) {
    const escaped = JSON.stringify(field.id);
    const selector = field.type === 'radio'
      ? `input[type="radio"][name=${escaped}][value=${JSON.stringify(String(field.value))}]`
      : `[id=${escaped}], [name=${escaped}]`;
    const locator = page.locator(selector);
    if (await locator.count() !== 1) return { ...plan, status: 'Blocked', blockers: ['Employer control changed; review again'],questions:form.questions.filter(q=>q.fields.some(f=>f.id===field.id)) };
    bindings.push({ field, locator });
  }
  for (const { field, locator } of bindings) {
    if (identifyJob(page.url()).url !== form.url) throw new Error('Employer page changed before prefill');
    if (field.type === 'file') {
      await locator.setInputFiles({ name: 'resume.pdf', mimeType: 'application/pdf', buffer: context.resumeBytes });
      if (form.ats === 'lever') {
        // Lever parses uploads asynchronously and may rewrite contact fields.
        // Wait for an uploaded-file acknowledgement before final value checks.
        await page.waitForFunction(() => {
          const text = document.querySelector('form')?.innerText || '';
          return text.includes('resume.pdf') && !/analyzing resume|uploading/i.test(text)
            && !document.querySelector('form [aria-busy="true"]');
        }, undefined, { timeout: 45000 });
      }
    }
    else if (field.type === 'select') await locator.selectOption(String(field.value));
    else if (field.type === 'radio') await locator.check();
    else if (field.type === 'checkbox') await locator.setChecked(String(field.value) === 'true');
    else await locator.fill(String(field.value));
    const after = await inspectBrowserForm(page);
    if (after.formFingerprint !== form.formFingerprint || after.blockers.length) return {...plan,status:'Blocked',blockerCode:'form-changed',blockers:['Conditional employer form changed after prefill; inspect and review again',...after.blockers],questions:after.questions.filter(q=>!form.questions.some(old=>JSON.stringify(old)===JSON.stringify(q)))};
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
