export const CONTACT_TYPES = ['recruiter', 'engineer', 'senior', 'manager', 'alumni', 'other'];
export const OUTREACH_STATUSES = ['Not asked', 'Asked', 'Replied', 'Referred', 'Applied', 'Interviewing', 'Offer', 'Rejected'];
const clean = value => typeof value === 'string' ? value.trim() : '';
export function safeUrl(value, linkedin = false) {
  try {
    const url = new URL(clean(value));
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    if (linkedin && (!['linkedin.com', 'www.linkedin.com'].includes(url.hostname) || !/^\/in\/[\w%-]+\/?$/.test(url.pathname))) return '';
    return url.href;
  } catch { return ''; }
}
export function contactType(record) {
  if (CONTACT_TYPES.includes(record.contactType)) return record.contactType;
  const path = clean(record.path).toLowerCase();
  if (path.includes('recruit')) return 'recruiter';
  if (path.includes('senior')) return 'senior';
  if (path.includes('alum')) return 'alumni';
  if (path.includes('engineer')) return 'engineer';
  return 'other';
}
export function groupContacts(records) {
  const groups = new Map();
  for (const record of records) {
    const company = clean(record.company) || 'Other contacts';
    const key = company.toLowerCase().replace(/\s+/g, ' ');
    if (!groups.has(key)) groups.set(key, { key, company, contacts: [] });
    groups.get(key).contacts.push(record);
  }
  return [...groups.values()].sort((a, b) => a.company.localeCompare(b.company));
}
export function draftOutreach(record, profile = {}) {
  const name = clean(record.contact || record.name).split(/\s+/)[0];
  const company = clean(record.company);
  const title = clean(record.title || record.role);
  const identity = clean(profile.name);
  const evidence = clean(record.evidence);
  const reason = clean(record.reason);
  const missing = [!name && 'Contact name', !company && 'Company', !title && 'Target role', !identity && 'Your profile name', !evidence && 'Relevant experience', !reason && 'Reason for this company/team'].filter(Boolean);
  if (missing.length) return { subject: '', message: '', missing };
  const kind = contactType(record);
  const ask = kind === 'recruiter' ? `What is the best next step to interview for this role?` : kind === 'manager' || kind === 'senior' ? `Would you be open to considering my background for your team?` : `Would you be comfortable referring me for this role?`;
  const connection = clean(record.connection);
  const link = safeUrl(record.link);
  return { subject: `${title} at ${company} — ${identity}`, message: `Hi ${name},\n\nI'm ${identity}, interested in the ${title} role at ${company}.${connection ? ` ${connection}` : ''} ${evidence}\n\n${reason}\n\n${ask}${link ? `\n\nRole: ${link}` : ''}\n\nThanks,\n${identity}`, missing: [] };
}
export function importOutreach(text, existing, makeId) {
  let value;
  try { value = JSON.parse(text); } catch { throw new Error('Paste the JSON contacts from Muse.'); }
  const records = Array.isArray(value) ? value : value?.contacts;
  if (!Array.isArray(records) || !records.length || records.length > 100) throw new Error('Import between 1 and 100 contacts.');
  const next = existing.map(record => ({ ...record }));
  for (const record of records) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('Each contact must be an object.');
    const company = clean(record.company), contact = clean(record.contact || record.name);
    if (!company || !contact) throw new Error('Each contact needs a company and a name.');
    for (const key of ['linkedin','link','sourceUrl']) if (clean(record[key]) && !safeUrl(record[key], key === 'linkedin')) throw new Error(`Invalid ${key} URL for ${contact}. Use an HTTPS ${key === 'linkedin' ? 'LinkedIn profile' : 'web'} link.`);
    if (record.contactType && !CONTACT_TYPES.includes(record.contactType)) throw new Error(`Choose a supported contact type for ${contact}.`);
    const fields = Object.fromEntries(['title','linkedin','link','connection','evidence','reason','subject','message','sourceUrl'].filter(key => typeof record[key] === 'string').map(key => [key, clean(record[key]).slice(0, 10000)]));
    const found = next.find(r => clean(r.company).toLowerCase() === company.toLowerCase() && clean(r.contact || r.name).toLowerCase() === contact.toLowerCase());
    if (found) Object.assign(found, fields, { contactType: contactType(record), company, contact, source: 'Muse' });
    else next.push({ ...fields, id: makeId(), company, contact, contactType: contactType(record), status: 'Not asked', source: 'Muse' });
  }
  return next;
}
export function museRequest(companies, profile = {}) {
  return `Use $cold-outreach to prepare job outreach for ${companies.length ? companies.join(', ') : 'my target companies'}. Read my current Job Signal Board profile and relevant roles. Find real LinkedIn profiles, confirm current company/title from public evidence, and include recruiters, engineers and senior contacts when relevant. Never invent facts or links. Fill the native Referrals contact and message fields if browser access is available; otherwise return JSON {"contacts":[{"company":"","contact":"","contactType":"recruiter","title":"","linkedin":"","link":"","connection":"","evidence":"","reason":"","subject":"","message":"","sourceUrl":""}]} for Muse import. Write personalized copy-ready messages with one concrete fit fact and one clear ask. Candidate name: ${clean(profile.name) || 'read from my profile'}. Do not send messages or claim applications were submitted.`;
}
