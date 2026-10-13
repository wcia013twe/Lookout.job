import { identifyJob, formResult } from './forms.mjs';
import { prepareApprovedFields } from './prepare.mjs';

// Accept an existing Playwright Page from a permitted local runner; no browser is launched here.
export async function inspectBrowserForm(page) {
  const target = identifyJob(page.url());
  const result = await page.evaluate(() => {
    const blockers = [];
    const questions = [];
    const ids = new Set();
    const forms = [...document.querySelectorAll('form')].filter(form => form.getClientRects().length);
    if (forms.length !== 1) return { questions, blockers: ['Expected one visible application form; manual review required'] };
    const form = forms[0];
    for (const input of form.querySelectorAll('input, textarea, select')) {
      if (!input.getClientRects().length || input.disabled || ['submit', 'button', 'reset', 'hidden'].includes(input.type)) continue;
      const id = input.id || input.name;
      const label = [...(input.labels || [])].map(node => node.textContent.trim()).join(' ') || input.getAttribute('aria-label');
      const type = input.tagName === 'TEXTAREA' ? 'textarea' : input.tagName === 'SELECT' ? (input.multiple ? 'multiselect' : 'select') : input.type;
      if (!id || ids.has(id) || !label) { blockers.push('Unlabelled or duplicate field requires manual review'); continue; }
      ids.add(id);
      const supported = ['text', 'email', 'tel', 'url', 'textarea', 'select', 'file'].includes(type);
      if (!supported) blockers.push(`Manual control: ${label}`);
      questions.push({ id, question: label, required: input.required || input.getAttribute('aria-required') === 'true',
        fields: [{ id, type: supported ? type : 'unsupported', options: input.tagName === 'SELECT' ? [...input.options].map(option => ({ value: option.value, label: option.text })) : [] }] });
    }
    if (form.querySelector('[role="combobox"], [role="listbox"], iframe, [data-sitekey]')) blockers.push('Custom choices, embedded controls or CAPTCHA require manual review');
    if (!questions.length) blockers.push('No labelled application fields found');
    return { questions, blockers };
  });
  return formResult(target, result.questions, result.blockers);
}

export async function prefillApprovedForm(page, context) {
  const form = await inspectBrowserForm(page);
  const plan = prepareApprovedFields(context, form);
  if (plan.blockers.length) return plan;
  if (plan.fields.some(field => field.type === 'file') && !context.resumeBytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
    return { ...plan, status: 'Blocked', blockers: ['Browser adapter currently accepts PDF resumes only; use manual upload for other formats'] };
  }
  for (const field of plan.fields) {
    // IDs/names are exact matches. A changed form must not silently bind an answer elsewhere.
    const escaped = JSON.stringify(field.id);
    const locator = page.locator(`[id=${escaped}], [name=${escaped}]`);
    if (await locator.count() !== 1) return { ...plan, status: 'Blocked', blockers: ['Employer control changed; review again'] };
    if (field.type === 'file') await locator.setInputFiles({ name: 'resume.pdf', mimeType: 'application/pdf', buffer: context.resumeBytes });
    else if (field.type === 'select') await locator.selectOption(String(field.value));
    else await locator.fill(String(field.value));
  }
  const after = await inspectBrowserForm(page);
  if (after.formFingerprint !== form.formFingerprint || after.blockers.length) return { ...plan, status: 'Blocked', blockers: ['Conditional employer form changed after prefill; inspect and review again', ...after.blockers] };
  return plan;
}
