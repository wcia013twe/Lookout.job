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
  const matches = sectionLines(prompt, heading).filter(l => l.startsWith(prefix));
  return { value: matches.length === 1 ? matches[0].slice(prefix.length).trim() : '', conflict: matches.length > 1 };
}
export function updateField(prompt, heading, key, value) {
  const lines = prompt.split('\n'), header = `## ${heading}`, prefix = `- ${key}:`;
  let start = lines.findIndex(l => l.trim() === header);
  if (start < 0) { lines.push('', header); start = lines.length - 1; }
  let end = lines.findIndex((l, i) => i > start && /^##\s/.test(l));
  if (end < 0) end = lines.length;
  const matches = lines.slice(start + 1, end).map((l, i) => l.startsWith(prefix) ? start + 1 + i : -1).filter(i => i >= 0);
  if (matches.length > 1) throw new Error(`Resolve duplicate ${key} lines in the prompt first.`);
  if (matches.length) { if (value) lines[matches[0]] = `${prefix} ${value}`; else lines.splice(matches[0], 1); }
  else if (value) lines.splice(start + 1, 0, `${prefix} ${value}`);
  return lines.join('\n');
}

export function profileFromPrompt(prompt, base = {}) {
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
  let heading = '';
  const instructions = prompt.split('\n').filter(line => {
    if (/^##\s/.test(line)) heading = line.trim().slice(3);
    const keys = heading === 'Search Filters' ? Object.keys(filterFields) : heading === 'How to Evaluate Opportunities' ? priorities : [];
    return !keys.some(key => line.startsWith(`- ${key}:`));
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
