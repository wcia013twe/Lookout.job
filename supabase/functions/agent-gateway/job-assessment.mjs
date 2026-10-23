// Private recommendation display data; never grants approval or submission permission.
export function validateJobRecommendation(value = {}) {
 if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Recommendation must be an object.');
 for (const key of ['materialGap','sourceFreshness']) if (value[key] !== undefined && (typeof value[key] !== 'string' || !value[key].trim() || value[key].length > 4000)) throw Error(`${key} must be nonempty text up to 4000 characters.`);
 if (value.priority !== undefined && !['Apply Now','Strong Consider','Skip Unless Team Fit'].includes(value.priority)) throw Error('Invalid recommendation priority.');
 const assessment=value.matchAssessment;
 if (assessment === undefined) return value;
 const text=(v,n)=>typeof v==='string' && Boolean(v.trim()) && v.length<=n;
 const score=v=>typeof v==='number' && Number.isFinite(v) && v>=0 && v<=100;
 if (!assessment || typeof assessment!=='object' || Array.isArray(assessment) || !score(assessment.percent) || !text(assessment.evidence,4000) || !text(assessment.assessedAt,40) || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(assessment.assessedAt) || !Number.isFinite(Date.parse(assessment.assessedAt)) || !Array.isArray(assessment.factors) || !assessment.factors.length || assessment.factors.length>12) throw Error('Assessment needs percent 0–100, evidence, assessedAt timestamp and 1–12 factors.');
 for (const f of assessment.factors) if (!f || !text(f.label,120) || !(f.value===null || score(f.value)) || !text(f.rating,80) || !text(f.reason,4000)) throw Error('Each assessment factor needs label, value (0–100 or null), rating and evidence reason.');
 return value;
}
export function savedJobAssessment(value) {
 if (!value) return undefined;
 try {validateJobRecommendation({matchAssessment:value});return value;} catch {return undefined;}
}
