// Public research snapshot; this date must not advance when demo fixtures reset.
export const researchCheckedAt='2026-11-07';
export const palantirDemoApplicationId='bbbbbbbb-3333-4000-8000-333333333333';
export const toolkitResearch={
 role:{title:'Palantir · New Grad Query Engines (NYC)',url:'https://jobs.lever.co/palantir/90329118-d9b7-4b96-acdf-13377e3196ac/'},
 glassdoor:{title:'Glassdoor reports',url:'https://www.glassdoor.com/Interview/Palantir-Technologies-Interview-Questions-E236375.htm?filter.jobTitleExact=Software+Engineer+-+New+Grad'},
 furnace:{title:'Palantir · Furnace architecture',url:'https://www.palantir.com/docs/foundry/sql-warehousing/furnace'},
 datafusion:{title:'DataFusion intro',url:'https://datafusion.apache.org/user-guide/introduction.html'},
 explain:{title:'EXPLAIN guide',url:'https://www.postgresql.org/docs/18/using-explain.html'},
};
export function demoMaterialSources(kind){
 const keys={company_research:['role','furnace'],interview_brief:['glassdoor','datafusion','explain'],story_bank:['role'],interview_debrief:['explain']}[kind]||[];
 return keys.map(key=>({...toolkitResearch[key],observedAt:researchCheckedAt}));
}
