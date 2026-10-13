// Adapted from Ying-Kai-Liao/jev-browser src/page-script.mjs (MIT).
// See ../THIRD_PARTY.md for source revisions and full license notices.
// Self-contained because Playwright serializes this function into the employer page.
export function collectApplicationControls() {
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const st = getComputedStyle(el);
    return st.visibility !== 'hidden' && st.display !== 'none'
      && (+st.opacity > 0.05 || /^(checkbox|radio|file)$/.test(el.type));
  };
  const byIds = (ids) => clean((ids || '').split(/\s+/)
    .map((id) => document.getElementById(id)?.innerText).filter(Boolean).join(' '));
  const labelOf = (el) => clean(byIds(el.getAttribute('aria-labelledby'))
    || [...(el.labels || [])].map((l) => l.innerText).join(' ')
    || el.getAttribute('aria-label') || '');

  const forms = [...document.querySelectorAll('form')].filter(visible);
  if (forms.length !== 1) return { questions: [], blockers: ['Expected one visible application form; manual review required'] };
  const form = forms[0];
  const questions = [], blockers = [], ids = new Set(), radios = new Map();
  const inputs = [...form.querySelectorAll('input, textarea, select')];
  for (const input of inputs) {
    const type = input.tagName === 'TEXTAREA' ? 'textarea'
      : input.tagName === 'SELECT' ? (input.multiple ? 'multiselect' : 'select') : input.type;
    if (input.disabled || ['submit', 'button', 'reset', 'hidden'].includes(type)) continue;
    const styledLabel = ['checkbox', 'radio'].includes(type) && [...(input.labels || [])].some(visible);
    // Hidden upload controls may be intentionally bound to a visible upload button.
    if (!visible(input) && !styledLabel && type !== 'file') continue;
    const id = type === 'radio' ? input.name : (input.id || input.name);
    const label = labelOf(input);
    if (!id || !label) { blockers.push('Unlabelled field requires manual review'); continue; }
    const required = input.required || input.getAttribute('aria-required') === 'true';
    if (type === 'radio') {
      const group = input.closest('fieldset, [role="radiogroup"]');
      const question = clean(group?.querySelector('legend')?.innerText)
        || (group && labelOf(group));
      if (!question || !group) { blockers.push(`Unlabelled radio group: ${label}`); continue; }
      if (radios.has(id) && radios.get(id).group !== group) { blockers.push(`Duplicate radio group: ${question}`); continue; }
      if (!radios.has(id)) radios.set(id, { group, question, required, options: [] });
      const entry = radios.get(id);
      entry.required ||= required;
      if (entry.options.some((option) => option.value === input.value)) blockers.push(`Duplicate radio choice: ${question}`);
      entry.options.push({ value: input.value, label });
      continue;
    }
    if (ids.has(id)) { blockers.push('Duplicate field requires manual review'); continue; }
    ids.add(id);
    const supported = ['text', 'email', 'tel', 'url', 'textarea', 'select', 'checkbox', 'file'].includes(type);
    if (!supported) blockers.push(`Manual control: ${label}`);
    questions.push({ id, question: label, required, fields: [{ id, type: supported ? type : 'unsupported',
      options: type === 'select' ? [...input.options].map((option) => ({ value: option.value, label: option.text })) : [] }] });
  }
  for (const [id, entry] of radios) {
    if (ids.has(id)) blockers.push(`Duplicate field: ${entry.question}`);
    ids.add(id);
    questions.push({ id, question: entry.question, required: entry.required,
      fields: [{ id, type: 'radio', options: entry.options }] });
  }
  // Do not infer consent, invent custom-widget choices or inspect challenge frames.
  if (form.querySelector('[role="combobox"], [role="listbox"], iframe, [data-sitekey]')
    || document.querySelector('iframe[src*="captcha"], [data-sitekey]')) {
    blockers.push('Custom choices, embedded controls or CAPTCHA require manual review');
  }
  if (!questions.length) blockers.push('No labelled application fields found');
  return { questions, blockers };
}
