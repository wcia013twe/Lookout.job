// Canonical choices for the existing Company preferences / Industries line.
// Keep this a labeled string: website and MCP share the search-profile contract.
export const industryOptions = Object.freeze([
  'Aerospace', 'AI & Machine Learning', 'Automotive & Transportation',
  'Biotechnology', 'Consulting', 'Consumer Goods', 'Consumer Software',
  'Crypto & Web3', 'Cybersecurity', 'Data & Analytics', 'Defense', 'Design',
  'Education', 'Energy', 'Enterprise Software', 'Entertainment',
  'Financial Services', 'Fintech', 'Food & Agriculture', 'Gaming',
  'Government & Public Sector', 'Hardware', 'Healthcare',
  'Industrial & Manufacturing', 'Legal', 'Quantitative Finance', 'Real Estate',
  'Robotics & Automation', 'Social Impact', 'Venture Capital', 'VR & AR',
]);
const canonical = new Map(industryOptions.map(value => [value.toLowerCase(), value]));

export function parseIndustries(value = '') {
  const seen = new Set();
  return value.split(/[,\n]/).map(part => part.trim()).filter(Boolean).map(part =>
    canonical.get(part.toLowerCase()) || part,
  ).filter(part => {
    const key = part.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function toggleIndustry(value, industry) {
  const selected = parseIndustries(value);
  const key = industry.toLowerCase();
  return (selected.some(item => item.toLowerCase() === key)
    ? selected.filter(item => item.toLowerCase() !== key)
    : [...selected, canonical.get(key) || industry]
  ).join(', ');
}
