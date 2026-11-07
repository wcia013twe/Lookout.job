// Shared by the profile UI and its existing versioned website/MCP document format.
export const companySizeOptions = [
  '1–10', '11–50', '51–200', '201–500', '501–1,000',
  '1,001–5,000', '5,001–10,000', '10,001+',
];
const normalize = value => value.replace(/employees?/gi, '').replace(/[,\s]/g, '').replace(/[–—]/g, '-');
export function readCompanySizes(value = '') {
  const entries = value.split(/,\s+|;\s*|\n/).map(entry => entry.trim()).filter(Boolean);
  const selected = companySizeOptions.filter(option => entries.some(entry => normalize(entry) === normalize(option)));
  const other = entries.filter(entry => !companySizeOptions.some(option => normalize(entry) === normalize(option))).join(', ');
  return {selected, other};
}
export function writeCompanySizes(selected, other = '') {
  return [...companySizeOptions.filter(option => selected.includes(option)), other.trim()].filter(Boolean).join(', ');
}
