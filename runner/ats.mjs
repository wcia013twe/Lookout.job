// Trigger lists adapted from AchyutKulkarni/job-application-agent (MIT).
// We retain only form-entry navigation; approval/fill/submit policy belongs to our runner.
import { identifyJob } from './forms.mjs';

export const ATS_ENTRY = Object.freeze({
  greenhouse: { triggerSelector: 'a:has-text("Apply"), button:has-text("Apply"), a:has-text("Apply for this job"), button:has-text("Apply for this job")' },
  ashby: { triggerSelector: 'a:has-text("Apply"), button:has-text("Apply"), a:has-text("Apply now"), button:has-text("Apply now")' },
});

// Open a form only on the same allowlisted job. Never click a button inside a form.
export async function openApplicationForm(page) {
  const target = identifyJob(page.url());
  if (await page.locator('form:visible').count() === 1) return { status: 'Ready', url: target.url };
  const triggers = page.locator(ATS_ENTRY[target.ats].triggerSelector);
  const candidates = [];
  for (let i = 0, n = await triggers.count(); i < n; i++) {
    const locator = triggers.nth(i);
    if (!await locator.isVisible() || !await locator.isEnabled()) continue;
    const info = await locator.evaluate((el) => ({ label: (el.innerText || '').trim(),
      href: el.tagName === 'A' ? el.href : null, inForm: Boolean(el.closest('form')),
      tag: el.tagName, type: el.getAttribute('type') }));
    if (info.inForm || !/^(apply|apply now|apply for this job)$/i.test(info.label)) continue;
    if (info.tag === 'BUTTON' && info.type !== 'button') continue;
    if (info.href) {
      try { if (identifyJob(info.href).url !== target.url) continue; } catch { continue; }
    }
    candidates.push(locator);
  }
  if (candidates.length !== 1) return { status: 'Blocked', blockers: ['Application entry is missing or ambiguous; open the form manually'] };
  await candidates[0].click();
  if (identifyJob(page.url()).url !== target.url) throw new Error('Application entry navigated away from the selected job');
  if (await page.locator('form:visible').count() !== 1) return { status: 'Blocked', blockers: ['Application form did not open; manual handoff required'] };
  return { status: 'Ready', url: target.url };
}
