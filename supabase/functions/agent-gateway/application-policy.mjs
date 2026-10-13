// Stable company-tier IDs, independent of themed rarity labels and job-card art.
export const TIER_ORDER = ['S', 'A', 'B', 'C', 'D'];
const normalized = value => typeof value === 'string' ? value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ') : '';
const review = (reason, details = {}) => ({ mode: 'review', reviewRequired: true, reason, ...details });

// Uses owned persisted preferences and canonical employer facts, never agent rank claims.
// This decides review depth, not authorization to execute or proof of submission.
export function applicationPolicy({ preferences = {}, job }) {
  const search = preferences?.search || {};
  if (!job || !normalized(job.company) || !['FT','Internship'].includes(job.employmentType)) return review('Company or role type is unknown.');
  if (Array.isArray(search.excludedCompanies) && search.excludedCompanies.some(name => normalized(name) === normalized(job.company))) {
    return { mode: 'skip', reviewRequired: false, reason: 'Company is excluded by your settings.' };
  }
  if (Array.isArray(search.employmentTypes) && !search.employmentTypes.includes(job.employmentType)) {
    return { mode: 'skip', reviewRequired: false, reason: 'Role type is excluded by your settings.' };
  }
  if (search.autoSubmitApproved !== true) return review('Auto-apply is off.');
  const key = job.employmentType === 'FT' ? 'fullTime' : 'internship';
  const settings = search.reviewPolicy?.[key] || {};
  const threshold = settings.threshold ?? 'A';
  if (threshold === 'all') return review('Your policy requires review for every role of this type.');
  if (!TIER_ORDER.includes(threshold)) return review('Review threshold is invalid.');
  const lists = Array.isArray(preferences.tier_lists) ? preferences.tier_lists : [];
  const candidates = settings.tierListId
    ? lists.filter(list => list.id === settings.tierListId && (!list.employmentType || list.employmentType === job.employmentType))
    : lists.filter(list => list.employmentType === job.employmentType);
  if (candidates.length !== 1) return review('Select one company tier list for this role type.');
  const list = candidates[0];
  const companies = Array.isArray(list.companies) ? list.companies.filter(company => normalized(company.name) === normalized(job.company)) : [];
  if (companies.length !== 1) return review('Company is unranked or ambiguous.', { tierListId: list.id });
  const placements = list.placements || {};
  const tiers = Object.entries(placements).filter(([, ids]) => Array.isArray(ids) && ids.includes(companies[0].id));
  if (tiers.length !== 1 || !TIER_ORDER.includes(tiers[0][0])) return review('Company needs one valid tier placement.', { tierListId: list.id });
  const tier = tiers[0][0], details = { companyTier: tier, threshold, tierListId: list.id, employmentType: job.employmentType };
  if (TIER_ORDER.indexOf(tier) <= TIER_ORDER.indexOf(threshold)) return review('Important match: prepare everything and request focused review.', details);
  return { mode: 'auto-apply', reviewRequired: false, reason: 'Routine match: use verified facts and permitted saved answers; unresolved questions still require the user.', ...details };
}
