import {readField} from './search-profile.mjs';
export const FILTER_CONTRACT_VERSION=1;
export const EMPLOYMENT_TYPES=Object.freeze(['FT','Internship','Part-time','Contract','Temporary']);
export const WORK_ARRANGEMENTS=Object.freeze(['remote','hybrid','on-site']);
export const CONSTRAINT_STRENGTHS=Object.freeze(['required','preferred','flexible','not-configured']);
export const FILTER_CHECK_STATUSES=Object.freeze(['met','unmet','unknown','not-applicable']);
/** @typedef {'FT'|'Internship'|'Part-time'|'Contract'|'Temporary'} EmploymentType */
/** @typedef {'remote'|'hybrid'|'on-site'} WorkArrangement */
/** @typedef {'required'|'preferred'|'flexible'|'not-configured'} ConstraintStrength */
/** @typedef {{values:EmploymentType[],strength:ConstraintStrength}} EmploymentConstraint */
/** @typedef {{values:WorkArrangement[],strength:ConstraintStrength}} WorkArrangementConstraint */
/** @typedef {{version:1,employment:EmploymentConstraint,workArrangement:WorkArrangementConstraint}} DiscoveryConstraints */
/** @typedef {{requirement:string,status:'met'|'unmet'|'unknown'|'not-applicable',evidence:string}} FilterCheck */
/** @typedef {{listingId:string,passed:boolean,rejectedBy:string[],checks:FilterCheck[],decision:'ineligible'|'review-needed',explanation:string}} DiscoveryFilterResult */
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v,keys)=>object(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const nonempty=v=>typeof v==='string'&&Boolean(v.trim());
const employmentAliases=new Map([['full-time','FT'],['ft','FT'],['internship','Internship'],['part-time','Part-time'],['contract','Contract'],['temporary','Temporary']]);
const workAliases=new Map([['remote','remote'],['remote preferred','remote'],['remote required','remote'],['hybrid','hybrid'],['on-site','on-site'],['onsite','on-site']]);
function constraint(raw,instructions,key,aliases,defaultStrength){
 if(raw!==undefined&&typeof raw!=='string')throw Error(`${key} must be text at the legacy settings boundary.`);
 const field=readField(instructions,'Priority & flexibility',key);
 if(field.conflict)throw Error(`Resolve duplicate ${key} priority fields.`);
 if(field.value&&!['Required','Preferred','Flexible'].includes(field.value))throw Error(`Choose Required, Preferred or Flexible for ${key}.`);
 const tokens=(raw||'').split(/[;,]/).map(s=>s.trim().toLowerCase()).filter(Boolean);
 if(tokens.includes('remote required')&&field.value&&field.value!=='Required')throw Error(`${key} has conflicting required and softer strengths.`);
 if(tokens.includes('any')&&tokens.length!==1)throw Error(`${key}: Any cannot be combined with specific choices.`);
 const values=tokens[0]==='any'?[]:[...new Set(tokens.map(token=>{const value=aliases.get(token);if(!value)throw Error(`Unsupported ${key} choice. Use the supported settings options.`);return value;}))];
 if(!values.length){if(field.value==='Required')throw Error(`${key} is Required but has no selected values.`);return {values:[],strength:'not-configured'};}
 return {values,strength:field.value?field.value.toLowerCase():tokens.some(t=>t==='remote required')?'required':defaultStrength};
}
/** Normalize existing labeled settings once; matching uses only these typed choices.
 * @returns {DiscoveryConstraints} */
export function discoveryConstraints(profile){
 if(!object(profile)||profile.filters!==undefined&&!object(profile.filters)||profile.instructions!==undefined&&typeof profile.instructions!=='string')throw Error('Filter profile needs an object of filters and text instructions.');
 const fields=profile.filters||{},instructions=profile.instructions||'';
 const result={version:1,employment:constraint(fields.Employment,instructions,'Employment',employmentAliases,'required'),workArrangement:constraint(fields['Work arrangement'],instructions,'Work arrangement',workAliases,'preferred')};
 assertDiscoveryConstraints(result);return result;
}
export function assertDiscoveryConstraints(value){
 if(!exact(value,['version','employment','workArrangement'])||value.version!==1)throw Error('Unsupported discovery filter contract.');
 for(const [key,choices]of [['employment',EMPLOYMENT_TYPES],['workArrangement',WORK_ARRANGEMENTS]]){
  const c=value[key];if(!exact(c,['values','strength'])||!Array.isArray(c.values)||c.values.some(v=>!choices.includes(v))||new Set(c.values).size!==c.values.length||!CONSTRAINT_STRENGTHS.includes(c.strength)||(c.values.length===0)!==(c.strength==='not-configured'))throw Error(`Invalid typed ${key} constraint.`);
 }
 return value;
}
export function observedEmployment(value){if(value===undefined||value===null||value==='')return null;if(typeof value!=='string')throw Error('Observed employment type must be text or null.');const type=employmentAliases.get(value.toLowerCase());if(!type)throw Error('Unsupported observed employment type.');return type;}
export function assertDiscoverySourceFacts(listings){
 if(!Array.isArray(listings)||listings.length>100)throw Error('Filter at most 100 source records.');
 for(const item of listings){if(!object(item)||item.observation!=null&&!object(item.observation)||!nonempty(item.id||item.url)||typeof item.title!=='string'||item.location!==undefined&&item.location!==null&&typeof item.location!=='string')throw Error('Source records need an identity, text title and text or null location.');observedEmployment(item.employment_type??item.employmentType??item.observation?.employment_type);}
 return listings;
}
export const FILTER_REQUIREMENTS=Object.freeze(['careerops-title','careerops-posting-age','careerops-posted-date','careerops-content','careerops-country','careerops-visa','careerops-salary','careerops-cooldown','employment','work-arrangement','location','experience','graduation','availability','authorization','prior-application','company-limits','minimum-base-pay']);
/** @returns {DiscoveryFilterResult[]} */
export function assertDiscoveryResults(results,listings){
 if(!Array.isArray(results)||results.length!==listings.length)throw Error('Filter results must correspond to every input source record.');
 for(let index=0;index<results.length;index++){
  const r=results[index];if(!exact(r,['listingId','passed','rejectedBy','checks','decision','explanation'])||r.listingId!==(listings[index].id||listings[index].url)||typeof r.passed!=='boolean'||!Array.isArray(r.rejectedBy)||r.rejectedBy.some(k=>!FILTER_REQUIREMENTS.includes(k))||!['ineligible','review-needed'].includes(r.decision)||r.passed!==(r.decision==='review-needed')||!nonempty(r.explanation)||!Array.isArray(r.checks)||r.checks.length>100)throw Error('Invalid discovery-gate result; retain-for-review is not eligibility.');
  const names=new Set();for(const c of r.checks){if(!exact(c,['requirement','status','evidence'])||!FILTER_REQUIREMENTS.includes(c.requirement)||names.has(c.requirement)||!FILTER_CHECK_STATUSES.includes(c.status)||!nonempty(c.evidence)||c.evidence.length>3000)throw Error('Invalid typed filter check.');names.add(c.requirement);}
 }
 return results;
}
export const DISCOVERY_EVALUATION_SCOPE=Object.freeze({contractVersion:FILTER_CONTRACT_VERSION,evaluationScope:'discovery-gates',applicantEligibility:'not-evaluated'});
