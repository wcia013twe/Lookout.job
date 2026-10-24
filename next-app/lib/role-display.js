import {readField} from "../../lib/search-profile.mjs";
const normCompany = (name) =>
  String(name)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

/* ---------- Rarity (display colors derived from owned tier placements) ---------- */
const TIER_ORDER = ["common", "rare", "epic", "legendary", "mythic"];
const RARITY_LABEL = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
  mythic: "Mythic",
};
export function companyRanking(company, type, workflow = {}, profile) {
  const search=workflow.searchPreferences || {};
  if (typeof profile === 'string') {
    const matches=(search.profiles || []).filter(p=>p.id===profile && p.active!==false);
    if(matches.length!==1)return {rarity:'common',label:'Unranked'};
    profile=matches[0];
  }
  const lists=workflow.tierLists || [];
  const explicit=profile ? readField(profile.prompt ?? profile.instructions ?? '', 'Company priorities', 'Tier list ID') : {value:''};
  if (explicit.conflict) return {rarity:'common',label:'Unranked'};
  const legacy=search.reviewPolicy?.[/intern/i.test(type)?'internship':'fullTime']?.tierListId;
  const id=explicit.value || legacy;
  const candidates=id?lists.filter(list=>list.id===id):lists.filter(list=>list.employmentType===type);
  const list=candidates.length===1?candidates[0]:undefined;
  const companies=list?.companies?.filter(c=>normCompany(c.name)===normCompany(company)) || [];
  if (companies.length!==1) return {rarity:'common',label:'Unranked'};
  const placements=Object.entries(list.placements || {}).filter(([tier,ids])=>tier!=='unranked' && ids.includes(companies[0].id));
  const palette={S:'mythic',A:'legendary',B:'epic',C:'rare',D:'common'};
  const tier=placements.length===1?placements[0][0]:'';
  return palette[tier]?{rarity:palette[tier],label:`${tier} tier`}:{rarity:'common',label:'Unranked'};
}
const rarityOf = (company, type, title, workflow = {}, profile) => companyRanking(company,type,workflow,profile).rarity;
const tierIndex = (t) => TIER_ORDER.indexOf(t);
const TIER_HEX = {
  common: "#58B368",
  rare: "#4EA8DE",
  epic: "#9B5DE5",
  legendary: "#FFC53D",
  mythic: "#E3350D",
};
// Display only compensation explicitly present in the collected analysis.
const compensationTag = (text) => {
  const t = String(text || "");
  const money =
    /\$\s?[\d,]+(?:\.\d+)?\s?[KkMm]?(?:\s*[-–—]\s*\$?\s?[\d,]+(?:\.\d+)?\s?[KkMm]?)?(?:\s*(?:\/(?:hr|hour|year|yr|week)|per (?:hour|year)))?/g;
  const matches = [...t.matchAll(money)];
  if (!matches.length) return "Comp not listed";
  const labelled = matches.find((m) =>
    /(?:base|salary|total compensation|\bTC\b)\s*[:=]?\s*$/i.test(
      t.slice(Math.max(0, m.index - 30), m.index),
    ),
  );
  const hit = labelled || matches[0];
  const before = t.slice(Math.max(0, hit.index - 30), hit.index);
  const after = t.slice(
    hit.index + hit[0].length,
    hit.index + hit[0].length + 25,
  );
  const kind = /(?:total compensation|\bTC\b)\s*[:=]?\s*$/i.test(before)
    ? "TC"
    : /(?:base|salary)\s*[:=]?\s*$/i.test(before) ||
        /^\s*(?:US\s+)?(?:base|salary)\b/i.test(after)
      ? "Base"
      : "Comp";
  return `${kind} ${hit[0].trim()}`;
};

export { normCompany, rarityOf, RARITY_LABEL, TIER_HEX, compensationTag, tierIndex };
