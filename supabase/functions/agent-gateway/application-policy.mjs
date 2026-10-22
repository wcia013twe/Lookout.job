import {readField} from '../../../lib/search-profile.mjs';
// Stable company-tier IDs, independent of themed rarity labels and job-card art.
export const TIER_ORDER = ['S', 'A', 'B', 'C', 'D'];
const normalized = value => typeof value === 'string' ? value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ') : '';
const review = (reason, details = {}) => ({ mode: 'review', reviewRequired: true, reason, ...details });

export function profileAutomationSettings(profile, search = {}) {
  const text=profile?.prompt ?? profile?.instructions ?? '';
  const enabled=readField(text,'Application automation','Auto-apply routine matches');
  const threshold=readField(text,'Application automation','Review threshold');
  const list=readField(text,'Company priorities','Tier list ID');
  const employment=profile?.filters?.Employment || readField(text,'Search Filters','Employment').value;
  const key=employment==='Internship'?'internship':employment==='Full-time'?'fullTime':null;
  const legacy=key?search.reviewPolicy?.[key]||{}:{};
  return {configured:Boolean(enabled.value||enabled.conflict||threshold.value||threshold.conflict),conflict:enabled.conflict||threshold.conflict||list.conflict||(text.match(/^## Application automation\s*$/gm)||[]).length>1||(text.match(/^## Company priorities\s*$/gm)||[]).length>1,
    enabled:enabled.value?enabled.value==='Yes':search.autoSubmitApproved===true,
    threshold:threshold.value||legacy.threshold||'A',tierListId:list.value||(!enabled.value?legacy.tierListId:'')||'',
    invalid:Boolean(enabled.value&&!['Yes','No'].includes(enabled.value)),employment};
}

// Uses owned persisted preferences and canonical employer facts, never agent rank claims.
// This decides review depth, not authorization to execute or proof of submission.
export function applicationPolicy({ preferences = {}, job, profileId }) {
  const search = preferences?.search || {};
  if (!job || !normalized(job.company) || !['FT','Internship'].includes(job.employmentType)) return review('Company or role type is unknown.');
  if (Array.isArray(search.excludedCompanies) && search.excludedCompanies.some(name => normalized(name) === normalized(job.company))) {
    return { mode: 'skip', reviewRequired: false, reason: 'Company is excluded by your settings.' };
  }
  if (Array.isArray(search.employmentTypes) && !search.employmentTypes.includes(job.employmentType)) {
    return { mode: 'skip', reviewRequired: false, reason: 'Role type is excluded by your settings.' };
  }
  const profiles=Array.isArray(search.profiles)?search.profiles:[];
  let settings,selectedProfile;
  if(profileId!==undefined) {
    const matches=profiles.filter(profile=>profile.id===profileId);
    if(matches.length!==1||matches[0].active!==true)return review('Choose an active application profile.');
    selectedProfile=matches[0];
    settings=profileAutomationSettings(selectedProfile,search);
    if(settings.conflict||settings.invalid)return review('Resolve conflicting application profile automation settings.');
    if(settings.employment&&!(settings.employment.split(',').map(v=>v.trim()).includes(job.employmentType==='FT'?'Full-time':'Internship')))return review('Role type does not match the application profile.');
    if(!settings.configured){const legacy=search.reviewPolicy?.[job.employmentType==='FT'?'fullTime':'internship']||{};settings={...settings,threshold:legacy.threshold??'A',tierListId:legacy.tierListId||''};}
    if(!settings.enabled)return review('Auto-apply is off for this application profile.');
  } else {
    if(profiles.some(profile=>profileAutomationSettings(profile,search).configured))return review('Choose the application profile for this draft before automatic submission.');
    if(search.autoSubmitApproved!==true)return review('Auto-apply is off.');
    settings=search.reviewPolicy?.[job.employmentType==='FT'?'fullTime':'internship']||{};
  }
  if(selectedProfile&&settings.configured&&!settings.tierListId)return review('Choose a company tier list for this application profile.');
  const threshold = settings.threshold ?? 'A';
  if (threshold === 'all') return review('Your policy requires review for every role.');
  if (!TIER_ORDER.includes(threshold)) return review('Review threshold is invalid.');
  const lists = Array.isArray(preferences.tier_lists) ? preferences.tier_lists : [];
  const candidates = settings.tierListId
    ? lists.filter(list => list.id === settings.tierListId && (selectedProfile&&settings.configured || !list.employmentType || list.employmentType === job.employmentType))
    : lists.filter(list => list.employmentType === job.employmentType);
  if (candidates.length !== 1) return review('Select one company tier list for this role type.');
  const list = candidates[0];
  const companies = Array.isArray(list.companies) ? list.companies.filter(company => normalized(company.name) === normalized(job.company)) : [];
  if (companies.length !== 1) return review('Company is unranked or ambiguous.', { tierListId: list.id });
  const placements = list.placements || {};
  const tiers = Object.entries(placements).filter(([, ids]) => Array.isArray(ids) && ids.includes(companies[0].id));
  if (tiers.length !== 1 || !TIER_ORDER.includes(tiers[0][0])) return review('Company needs one valid tier placement.', { tierListId: list.id });
  const tier = tiers[0][0], details = { ...(selectedProfile?{profileId:selectedProfile.id}:{}), companyTier: tier, threshold, tierListId: list.id, employmentType: job.employmentType };
  if (TIER_ORDER.indexOf(tier) <= TIER_ORDER.indexOf(threshold)) return review('Important match: prepare everything and request focused review.', details);
  return { mode: 'auto-apply', reviewRequired: false, reason: 'Routine match: use verified facts and permitted saved answers; unresolved questions still require the user.', ...details };
}
