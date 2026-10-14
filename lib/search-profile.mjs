export const filterFields = {
  Employment: ['Full-time', 'Part-time', 'Contract', 'Temporary', 'Internship'],
  'Work arrangement': ['Remote preferred', 'Remote required', 'Hybrid', 'On-site', 'Any'],
  Location: null,
  'Minimum base pay': null,
  Schedule: ['Weekdays', 'Evenings', 'Weekends', 'Flexible'],
  'Experience level': ['Entry-level', 'Experienced', 'Any suitable level'],
};
export const priorities = ['Pay', 'Stability', 'Flexibility', 'Growth', 'Meaningful work', 'Team quality', 'Getting employed quickly'];
export function initialPrompt(p = {}) {
  return `## What I’m Looking For\n${(p.categories || []).join(', ')}\n\n## Search Filters\n${p.employmentTypes?.length ? '- Employment: ' + p.employmentTypes.map(t => t === 'FT' ? 'Full-time' : t).join(', ') + '\n' : ''}${p.locations?.length ? '- Location: ' + p.locations.join(', ') + '\n' : ''}\n## How to Evaluate Opportunities\n\n## Avoid\n${(p.excludedCompanies || []).join(', ')}\n`;
}
function sectionLines(prompt, heading) {
  const lines = prompt.split('\n');
  const start = lines.findIndex(l => l.trim() === `## ${heading}`);
  if (start < 0) return [];
  const end = lines.findIndex((l, i) => i > start && /^##\s/.test(l));
  return lines.slice(start + 1, end < 0 ? undefined : end);
}
export function readField(prompt, heading, key) {
  const prefix = `- ${key}:`;
  const lines = sectionLines(prompt, heading);
  const matches = lines.map((line, index) => line.startsWith(prefix) ? index : -1).filter(index => index >= 0);
  if (matches.length !== 1) return { value: '', conflict: matches.length > 1 };
  const start = matches[0];
  const values = [lines[start].slice(prefix.length).trim()];
  for (let index = start + 1; index < lines.length && lines[index].startsWith('  '); index++) values.push(lines[index].slice(2));
  return { value: values.join('\n'), conflict: false };
}
export function updateField(prompt, heading, key, value) {
  const lines = prompt.split('\n'), header = `## ${heading}`, prefix = `- ${key}:`;
  let start = lines.findIndex(l => l.trim() === header);
  if (start < 0) { lines.push('', header); start = lines.length - 1; }
  let end = lines.findIndex((l, i) => i > start && /^##\s/.test(l));
  if (end < 0) end = lines.length;
  const matches = lines.slice(start + 1, end).map((l, i) => l.startsWith(prefix) ? start + 1 + i : -1).filter(i => i >= 0);
  if (matches.length > 1) throw new Error(`Resolve duplicate ${key} lines in the prompt first.`);
  const replacement = value ? value.split('\n').map((line, index) => index === 0 ? `${prefix} ${line}` : `  ${line}`) : [];
  if (matches.length) {
    let stop = matches[0] + 1;
    while (stop < end && lines[stop].startsWith('  ')) stop++;
    lines.splice(matches[0], stop - matches[0], ...replacement);
  } else if (value) lines.splice(start + 1, 0, ...replacement);
  return lines.join('\n');
}

export function profileFromPrompt(prompt, base = {}) {
  validatePreferenceInstructions(prompt);
  const filters = {}, evaluation = {};
  for (const key of Object.keys(filterFields)) {
    const field = readField(prompt, 'Search Filters', key);
    if (field.conflict) throw Error(`Resolve duplicate ${key} lines first.`);
    if (field.value) filters[key] = field.value;
  }
  for (const key of priorities) {
    const field = readField(prompt, 'How to Evaluate Opportunities', key);
    if (field.conflict || field.value && !['Important','Very important'].includes(field.value)) throw Error(`Use Important or Very important for ${key}.`);
    if (field.value) evaluation[key] = field.value;
  }
  // Only canonical labeled lines are extracted; custom prose is never discarded.
  let heading = '', skipContinuation = false;
  const instructions = prompt.split('\n').filter(line => {
    if (/^##\s/.test(line)) heading = line.trim().slice(3);
    const keys = heading === 'Search Filters' ? Object.keys(filterFields) : heading === 'How to Evaluate Opportunities' ? priorities : [];
    if (keys.some(key => line.startsWith(`- ${key}:`))) { skipContinuation = true; return false; }
    if (skipContinuation && line.startsWith('  ')) return false;
    skipContinuation = false;
    return true;
  }).join('\n');
  return { id: base.id || 'general', name: base.name || 'General', active: base.active !== false, filters, priorities: evaluation, instructions };
}
export function promptFromProfile(profile) {
  let prompt = profile.instructions || '';
  for (const [key,value] of Object.entries(profile.filters || {})) prompt = updateField(prompt,'Search Filters',key,value);
  for (const [key,value] of Object.entries(profile.priorities || {})) prompt = updateField(prompt,'How to Evaluate Opportunities',key,value);
  return prompt;
}
export function normalizeSearchProfile(profile) {
  return profile.prompt !== undefined ? { ...profileFromPrompt(profile.prompt, profile), version: profile.version || 0 } : profile;
}

// These labeled preferences remain in instructions, supported by the existing
// versioned website/MCP profile boundary. Existing structured filters stay intact.
export const preferenceGroups = [
  { title: 'Roles & experience', heading: 'Role preferences', fields: [
    ['Roles', 'Software engineering, AI & machine learning'],
    ['Specializations', 'Backend, distributed systems, data engineering'],
    ['Employment', 'Full-time, Internship', 'Search Filters'],
    ['Experience level', 'Entry-level, experienced', 'Search Filters'],
  ] },
  { title: 'Location & working style', heading: 'Working preferences', fields: [
    ['Location', 'Cities, regions, or countries', 'Search Filters'],
    ['Work arrangement', 'Remote, hybrid, on-site', 'Search Filters'],
    ['Schedule', 'Weekdays, evenings, flexible', 'Search Filters'],
  ] },
  { title: 'Companies & industries', heading: 'Company preferences', fields: [
    ['Company size', '1–10, 11–50, 51–200, 201–500, 501–1,000, 1,001–5,000, 5,001–10,000, 10,001+'],
    ['Industries', 'AI & machine learning, fintech, enterprise software'],
  ] },
  { title: 'Skills & compensation', heading: 'Skill preferences', fields: [
    ['Skills to use', 'Skills you want to use in your next role'],
    ['Minimum base pay', 'Currency, amount, and period', 'Search Filters'],
    ['Security clearance', 'Open to clearance-required roles, or exclude them'],
  ] },
  { title: 'Work-life balance & benefits', heading: 'Work-life balance & benefits', fields: [
    ['Work-life balance', 'Expected hours, on-call load, boundaries, and time off'],
    ['Employer benefits', 'Health coverage, retirement match, parental leave, learning budget'],
  ] },
  { title: 'Avoid', heading: 'Avoid', fields: [
    ['Companies to avoid', 'Companies you do not want to pursue'],
    ['Industries to avoid', 'Industries you do not want to work in'],
    ['Skills to avoid', 'Skills you do not want your role to center on'],
  ] },
];
export const flexibilityOptions = ['Required', 'Preferred', 'Flexible'];
export const careerFields = ['Career goals', 'Tradeoffs'];
export function preferenceFields() {
  return preferenceGroups.flatMap(group => group.fields.map(([key, placeholder, heading]) => ({ key, placeholder, heading: heading || group.heading })));
}
export function validatePreferenceInstructions(prompt) {
  for (const {key, heading} of preferenceFields()) {
    if (readField(prompt, heading, key).conflict) throw Error(`Resolve duplicate ${key} lines first.`);
    const strength = readField(prompt, 'Priority & flexibility', key);
    if (strength.conflict || strength.value && !flexibilityOptions.includes(strength.value)) throw Error(`Use Required, Preferred, or Flexible for ${key}.`);
  }
  for (const key of careerFields) if (readField(prompt, 'Career goals & tradeoffs', key).conflict) throw Error(`Resolve duplicate ${key} lines first.`);
  for (const key of ['Tier list ID', 'Tier list name']) if (readField(prompt, 'Company priorities', key).conflict) throw Error(`Resolve duplicate ${key} lines first.`);
}
