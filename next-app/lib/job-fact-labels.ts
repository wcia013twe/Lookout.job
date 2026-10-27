// Display categories only. Keep uncertain prose from becoming an affirmative claim.
const clean = (value?: string) => (value || '').trim().replace(/\s+/g, ' ');
const unknown = /not (?:disclosed|confirmed|recorded|specified|established)|unknown|unclear|unconfirmed|to be confirmed|not yet|\b(?:may|might|possibly)\b/i;
export function compensationLabel(value?: string) {
  const text = clean(value);
  return !text || unknown.test(text) || /^(?:comp|pay|salary) not listed$/i.test(text) ? 'Not disclosed' : text;
}
export function workSettingLabel(value?: string) {
  const text = clean(value);
  if (!text || unknown.test(text)) return 'Not disclosed';
  // Only an explicit leading work arrangement is recognized, never a city or an
  // incidental mention such as “ask whether remote work is allowed”.
  const arrangement = text.match(/^(remote|hybrid|on[- ]?site)(?=$|[\s.(—–,:])/i)?.[1].toLowerCase();
  if (!arrangement || /\b(?:not|no|unavailable|depends|whether)\b/i.test(text)) return 'Not disclosed';
  return arrangement === 'remote' ? 'Remote' : arrangement === 'hybrid' ? 'Hybrid' : 'On-site';
}
export function sponsorshipLabel(value?: string) {
  const text = clean(value);
  if (!text || unknown.test(text) || /no .*?(?:policy|information|details).*?(?:disclosed|provided)|not guaranteed|case.by.case|conditional/i.test(text)) return 'Not disclosed';
  if (/^(?:no|not available)(?:$|[.(])|^no (?:visa )?sponsorship(?:$|[\s.(])|^(?:visa )?sponsorship (?:is )?not (?:available|offered|provided)\b/i.test(text)) return 'Not available';
  if (/^(?:yes|available)(?:$|[.(])|^(?:visa )?sponsorship (?:is )?(?:available|offered|provided)(?:$|[\s.(])/i.test(text)) return 'Available';
  return 'Not disclosed';
}
