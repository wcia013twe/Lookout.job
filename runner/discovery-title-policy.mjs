import {buildTitleFilter} from './vendor/career-ops/title-keywords.mjs';
import {classifyTier} from './vendor/career-ops/classify-tier.mjs';
// MTS is a role family, not the standalone senior Staff level. Preserve the
// original title for identity, display and all explicit role-specific exclusions.
const rankView=title=>String(title??'').replace(/\[([^\]]+)\]/g,(all,levels)=>/\b(?:junior|entry|associate|new grad)\b/i.test(levels)&&/[/,|]/.test(levels)&&/\b(?:senior|staff|principal)\b/i.test(levels)?'multiple levels':all);
const mtsView=title=>rankView(title).replace(/\b(?:member of (?:the )?technical staff|technical staff member|mts)\b/gi,'Technical Engineer');
const isRankKeyword=keyword=>/^(?:word:|stem:)?(?:staff|senior|sr\.?|principal|lead)$/i.test(keyword);
export function discoveryTitlePolicy(filter={}) {
 const positive=buildTitleFilter({positive:filter.positive});
 const negatives=filter.negative||[];
 const otherNegative=buildTitleFilter({negative:negatives.filter(k=>!isRankKeyword(k))});
 const staffNegative=buildTitleFilter({negative:negatives.filter(isRankKeyword)});
 return {
  matches:title=>positive(title)&&otherNegative(title)&&staffNegative(mtsView(title)),
  tier:title=>{
   const view=mtsView(title);
   if(view!==String(title??''))return classifyTier(view.replace(/\b(?:[1-9]|[ivx]+)\b/gi,''));
   return classifyTier(title);
  },
 };
}
