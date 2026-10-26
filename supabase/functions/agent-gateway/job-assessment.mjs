export const ASSESSMENT_DIMENSIONS = Object.freeze([
 ['skillsExperience','Skills & experience'],
 ['compensation','Compensation'],
 ['wellbeingCulture','Wellbeing & culture'],
 ['locationWorkSetting','Location & work setting'],
]);
const dimensionKeys=ASSESSMENT_DIMENSIONS.map(([key])=>key);
const compact=value=>value && dimensionKeys.some(key=>Object.hasOwn(value,key));
// Render metadata only after the complete stored record passes validation.
export function assessmentFactors(value) {
 if(!savedJobAssessment(value))return [];
 return compact(value)?ASSESSMENT_DIMENSIONS.map(([key,label])=>({label,value:value[key].score,reason:value[key].reasoning})):value.factors;
}
// Private recommendation display data; never grants approval or submission permission.
export function validateJobRecommendation(value = {}) {
 if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Recommendation must be an object.');
 for (const key of ['materialGap','sourceFreshness']) if (value[key] !== undefined && (typeof value[key] !== 'string' || !value[key].trim() || value[key].length > 4000)) throw Error(`${key} must be nonempty text up to 4000 characters.`);
 if (value.priority !== undefined && !['Apply Now','Strong Consider','Skip Unless Team Fit'].includes(value.priority)) throw Error('Invalid recommendation priority.');
 if(value.evaluatedProfileVersion!==undefined&&(!Number.isSafeInteger(value.evaluatedProfileVersion)||value.evaluatedProfileVersion<1))throw Error('Analysis profile version must be a positive integer.');
 const facts=value.jobFacts;
 if(facts!==undefined){
  if(!facts || typeof facts!=='object' || Array.isArray(facts) || Object.keys(facts).some(k=>!['sourceUrl','checkedAt','workSetting','sponsorship'].includes(k)) || !['sourceUrl','checkedAt','workSetting','sponsorship'].every(k=>typeof facts[k]==='string' && facts[k].trim() && facts[k].length<=2000) || !/^https:\/\//.test(facts.sourceUrl) || !Number.isFinite(Date.parse(facts.checkedAt)))throw Error('Job facts need sourceUrl, checkedAt, workSetting and sponsorship; undisclosed values must be explicit.');
  let source;try{source=new URL(facts.sourceUrl);}catch{throw Error('Job facts need a public HTTPS source.');}if(source.protocol!=='https:'||source.username||source.password)throw Error('Job facts need a public HTTPS source.');
 }
 const assessment=value.matchAssessment;
 if (assessment === undefined) return value;
 const text=(v,n)=>typeof v==='string' && Boolean(v.trim()) && v.length<=n;
 const score=v=>typeof v==='number' && Number.isFinite(v) && v>=0 && v<=100;
 if (compact(assessment)) {
  const allowed=[...dimensionKeys,'assessedAt','percent','evidence'];
  if(Array.isArray(assessment) || Object.keys(assessment).some(key=>!allowed.includes(key)) || !dimensionKeys.every(key=>Object.hasOwn(assessment,key)) || !text(assessment.assessedAt,40) || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(assessment.assessedAt) || !Number.isFinite(Date.parse(assessment.assessedAt)) || (assessment.percent!==undefined&&!score(assessment.percent)) || (assessment.evidence!==undefined&&!text(assessment.evidence,1000))) throw Error('Assessment needs exactly four dimensions, an assessedAt timestamp and optional percent/evidence metadata.');
  for(const key of dimensionKeys){
   const factor=assessment[key];
   if(!factor || typeof factor!=='object' || Array.isArray(factor) || Object.keys(factor).length!==2 || !Object.hasOwn(factor,'score') || !Object.hasOwn(factor,'reasoning') || !(factor.score===null || score(factor.score)) || !text(factor.reasoning,240))throw Error('Each dimension needs score 0–100 or null and short reasoning up to 240 characters.');
  }
  return value;
 }
 if (!assessment || typeof assessment!=='object' || Array.isArray(assessment) || !score(assessment.percent) || !text(assessment.evidence,4000) || !text(assessment.assessedAt,40) || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(assessment.assessedAt) || !Number.isFinite(Date.parse(assessment.assessedAt)) || !Array.isArray(assessment.factors) || !assessment.factors.length || assessment.factors.length>12) throw Error('Assessment needs percent 0–100, evidence, assessedAt timestamp and 1–12 factors.');
 for (const f of assessment.factors) if (!f || !text(f.label,120) || !(f.value===null || score(f.value)) || !text(f.rating,80) || !text(f.reason,4000)) throw Error('Each assessment factor needs label, value (0–100 or null), rating and evidence reason.');
 return value;
}
export function savedJobAssessment(value) {
 if (!value) return undefined;
 try {validateJobRecommendation({matchAssessment:value});return value;} catch {return undefined;}
}

export function recommendationNeedsRefresh(role,profiles=[]) {
 const current=profiles.find(p=>p.id===role.searchProfileId);
 return Number.isSafeInteger(role.evaluatedProfileVersion) && Number.isSafeInteger(current?.version) && role.evaluatedProfileVersion!==current.version;
}
