import {expandTitleAliases} from './title-aliases.mjs';
import {readField} from '../search-profile.mjs';

// Versioned targeting stays in the existing owned profile document. This section
// contains only public scanner settings, never commands, providers or credentials.
export const DISCOVERY_FILTER_HEADING = 'Career Ops discovery filters';
export const DISCOVERY_FILTER_KEYS = Object.freeze(['title_filter','skip_tiers','location_filter','max_posting_age_days','posted_after','posted_before','content_filter','country_eligibility_filter','visa_filter','salary_filter','re_apply_windows']);
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
export function profileDiscoveryFilters(instructions = '') {
 const lines=instructions.split('\n'),starts=lines.flatMap((line,i)=>line.trim()===`## ${DISCOVERY_FILTER_HEADING}`?[i]:[]);
 if(starts.length>1)throw Error('Resolve duplicate Career Ops discovery filters sections.');
 if(!starts.length)return {};
 const start=starts[0]+1,end=lines.findIndex((line,i)=>i>=start&&/^##\s/.test(line));
 const text=lines.slice(start,end<0?undefined:end).join('\n').trim();
 const match=text.match(/^```json\s*\n([\s\S]*?)\n```$/);
 if(!match)throw Error('Career Ops discovery filters needs one fenced JSON object.');
 let config;try{config=JSON.parse(match[1]);}catch{throw Error('Invalid JSON in Career Ops discovery filters.');}
 if(!object(config)||JSON.stringify(config).length>12000||Object.keys(config).some(k=>!DISCOVERY_FILTER_KEYS.includes(k)))throw Error('Unsupported or oversized Career Ops discovery filters.');
 // Bound the schema before the original Career Ops validator/predicates run.
 const walk=(v,depth=0)=>{if(depth>5)throw Error('Discovery filters exceed nesting bounds.');if(typeof v==='string'&&(!v.trim()||v.length>500)||typeof v==='number'&&!Number.isFinite(v)||v===null)throw Error('Discovery filter values must be bounded nonempty text, finite numbers or booleans.');if(Array.isArray(v)){if(v.length>100)throw Error('Discovery filter list exceeds 100 values.');v.forEach(x=>walk(x,depth+1));}else if(object(v)){if(Object.keys(v).length>100||Object.keys(v).some(k=>['__proto__','constructor','prototype'].includes(k)))throw Error('Invalid discovery filter keys.');Object.values(v).forEach(x=>walk(x,depth+1));}};
 walk(config);
 return config;
}
export function discoveryFilterPlan(profile = {}, portals = {}) {
 const local=profileDiscoveryFilters(profile.instructions),config=Object.fromEntries(DISCOVERY_FILTER_KEYS.filter(k=>Object.hasOwn(portals,k)).map(k=>[k,portals[k]]));
 Object.assign(config,local);
 if(config.title_filter)config.title_filter=expandTitleAliases(config.title_filter);
 const roles=readField(profile.instructions||'','Role preferences','Roles');
 if(roles.conflict)throw Error('Resolve duplicate Roles before searching.');
 const gaps=[],warnings=[];
 const positive=config.title_filter?.positive;
 if(roles.value&&!positive?.length&&!Object.hasOwn(local,'title_filter'))gaps.push('Target roles are saved but title keywords are not configured. Derive them from the selected profile and resume using career-adjacent-titles; save the Career Ops discovery filters section before searching.');
 if(!positive?.length)warnings.push('No positive title keywords: Career Ops keeps every title unless a negative keyword rejects it.');
 if(profile.filters?.Location&&!readField(profile.instructions||'','Priority & flexibility','Location').value)warnings.push('Saved profile location defaults to Preferred. It is text matching, not a geographic radius or proof of remote-country eligibility.');
 if(profile.filters?.['Experience level']&&!config.skip_tiers?.length)warnings.push('Experience level is not mapped to seniority exclusions. Configure skip_tiers when appropriate; title tiers do not prove applicant eligibility.');
 if(profile.filters?.['Minimum base pay']&&!config.salary_filter)warnings.push('Minimum base pay has no normalized salary_filter.');
 return {config,profileOverrides:Object.keys(local),roles:roles.value,ready:gaps.length===0,gaps,warnings,applicantEligibility:'not-evaluated'};
}
