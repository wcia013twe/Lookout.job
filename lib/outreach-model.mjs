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
export const OUTREACH_TAGS = [
  { kind: 'Background', description: 'Who you are', note: 'Introduces your education, current work or previous role.' },
  { kind: 'Connection', description: 'Shared context', note: 'Gives a personal reason for reaching out through a shared school, employer, community or prior meeting.' },
  { kind: 'Achievement', description: 'Work and results', note: 'Shows concrete work you did and the result or technical detail that supports your fit.' },
  { kind: 'Why them', description: 'Specific interest', note: 'Explains what interests you about this particular company, product or team.' },
  { kind: 'Timing', description: 'Real timeline', note: 'States a deadline or interview timeline. Include this only when it is true and current.' },
  { kind: 'Ask', description: 'Clear next step', note: 'States the specific action you want the recipient to take.' },
];
// Sentence annotations are reading aids, not verification. Copy/save retain the
// exact message. Unrecognized wording stays plain rather than inventing a tag.
export function outreachSentences(record) {
  const message = typeof record.message === 'string' ? record.message : '';
  const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
  return message.split(/(\n+)/).filter(Boolean).flatMap(paragraph => {
    if (/^\n+$/.test(paragraph)) return [{ text: paragraph, kind: null }];
    return [...segmenter.segment(paragraph)].map(({ segment: text }) => {
      const sentence = text.trim();
      const contains = field => clean(record[field]) && sentence.toLowerCase().includes(clean(record[field]).toLowerCase());
      const ask = /\b(?:(?:would|could|can|will) you|could we|can we|how can I (?:start|apply|interview)|what (?:is|are|would be) the (?:best )?next step|let me know (?:the |what )?next steps|(?:I[’']d|I would) (?:like|love) to (?:interview|start|apply|discuss)|please (?:refer|consider|review|connect))\b/i.test(sentence);
      const timing = /\b(?:deadline|offer expires|offer.*(?:by|until)|interviews? (?:scheduled|next|this|on)|onsite.*(?:next|this|on))\b/i.test(sentence);
      const connection = contains('connection') || /\b(?:alumni|alumnus|alumna|same school|you also (?:worked|studied)|both (?:attended|studied|worked)|we (?:met|connected))\b/i.test(sentence);
      const why = contains('reason') || /(?:your (?:team|company|product|work).*(?:interest|caught my attention|excites|because)|(?:interested in|drawn to|excited about).*(?:because|mission)|I (?:read|enjoyed) your (?:post|blog|paper))/i.test(sentence);
      const achievement = contains('evidence') || /\b(?:I (?:recently )?(?:built|developed|led|designed|implemented|shipped|reduced|improved)|I (?:helped|worked).*(?:build|reduce|improve|deliver)|(?:built|cut|reduced|improved|sustained).*(?:latency|requests|throughput|%|users))\b/i.test(sentence);
      const background = /(?:\bI[’']?m\b|\bI am\b|\bI (?:previously )?(?:interned|studied|graduated|worked)\b|\bmy (?:background|experience)\b)/i.test(sentence);
      const kind = ask ? 'Ask' : timing ? 'Timing' : connection ? 'Connection' : why ? 'Why them' : achievement ? 'Achievement' : background ? 'Background' : null;
      return { text, kind };
    });
  });
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
