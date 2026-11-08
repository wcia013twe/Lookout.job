import {discoveryFilterPlan} from '../lib/search/discovery-config.mjs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const exec=promisify(execFile);
// Upstream validate-portals runs main even on import. Invoke its unchanged CLI
// on disposable JSON/YAML rather than importing it or copying its validator.
async function validatePortalsConfig(config){
 const dir=await mkdtemp(join(tmpdir(),'lookout-filter-validation-'));
 try{
  const file=join(dir,'portals.json');await writeFile(file,JSON.stringify(config));
  let output;try{output=(await exec(process.execPath,[fileURLToPath(new URL('./vendor/career-ops/validate-portals.mjs',import.meta.url)),'--file',file],{timeout:15000,maxBuffer:200000})).stdout;}catch(error){if(error.code!==1||!error.stdout?.includes('errors,'))throw error;output=error.stdout;}
  const result={errors:[],warnings:[]};for(const line of output.split('\n')){const match=line.match(/^(error|warning): ([^:]+): (.*)$/);if(match)result[match[1]==='error'?'errors':'warnings'].push({path:match[2],message:match[3]});}return result;
 }finally{await rm(dir,{recursive:true,force:true});}
}
import {findStaleScanQueries,findUnclaimedEntries} from './vendor/career-ops/audit-portals.mjs';
import {loadProviders} from './vendor/career-ops/providers/_registry.mjs';
import {fileURLToPath} from 'node:url';

// Keep validation, query-overlap analysis and provider detection upstream. Never
// fetch source pages during a configuration read.
export async function inspectDiscoveryFilters({profile={},portals={}}) {
 const plan=discoveryFilterPlan(profile,portals);
 const validation=await validatePortalsConfig(plan.config);
 const allowed={title_filter:['positive','negative'],location_filter:['allow','always_allow','block','block_hard','strict'],content_filter:['positive','negative','by_title_keyword'],visa_filter:['enabled','require_mention','positive','negative'],salary_filter:['min','max','currency'],country_eligibility_filter:['exclusionary','inclusive']};
 // The upstream validator intentionally tolerates unknown legacy keys. At our
 // scoped boundary a typo must not appear to configure a gate it never controls.
 for(const [key,keys] of Object.entries(allowed))if(plan.config[key]&&typeof plan.config[key]==='object')for(const field of Object.keys(plan.config[key]))if(!keys.includes(field))validation.errors.push({path:`${key}.${field}`,message:'Unsupported scanner filter field.'});
 if(plan.config.skip_tiers!==undefined&&(!Array.isArray(plan.config.skip_tiers)||plan.config.skip_tiers.some(t=>!['intern','entry','mid','senior'].includes(t))))validation.errors.push({path:'skip_tiers',message:'Use intern, entry, mid or senior.'});
 for(const key of ['posted_after','posted_before'])if(plan.config[key]!==undefined&&(!/^\d{4}-\d{2}-\d{2}$/.test(plan.config[key])||!Number.isFinite(Date.parse(plan.config[key]))))validation.errors.push({path:key,message:'Use a valid YYYY-MM-DD date.'});
 if(plan.config.max_posting_age_days!==undefined&&(!Number.isFinite(plan.config.max_posting_age_days)||plan.config.max_posting_age_days<=0))validation.errors.push({path:'max_posting_age_days',message:'Use a positive number of days.'});
 for(const key of ['title_filter','location_filter','content_filter','visa_filter','salary_filter','country_eligibility_filter','re_apply_windows'])if(plan.config[key]!==undefined&&(!plan.config[key]||typeof plan.config[key]!=='object'||Array.isArray(plan.config[key])))validation.errors.push({path:key,message:'Use an object.'});
 if(plan.config.salary_filter){const {min=0,max=0,currency}=plan.config.salary_filter;if(typeof min!=='number'||typeof max!=='number'||min<0||max<0||max>0&&min>max||currency!==undefined&&typeof currency!=='string')validation.errors.push({path:'salary_filter',message:'Use nonnegative numeric bounds with min <= max and a currency string.'});}
 for(const [key,fields] of Object.entries({title_filter:['positive','negative'],location_filter:['allow','always_allow','block','block_hard'],content_filter:['positive','negative'],visa_filter:['positive','negative'],country_eligibility_filter:['exclusionary','inclusive']}))for(const field of fields){const list=plan.config[key]?.[field];if(list!==undefined&&(!Array.isArray(list)||list.some(v=>typeof v!=='string'||!v.trim()||/^(word|stem):\s*$/.test(v))))validation.errors.push({path:`${key}.${field}`,message:'Use an array of nonempty keyword strings.'});}
 const providers=await loadProviders(fileURLToPath(new URL('./vendor/career-ops/providers/',import.meta.url)));
 const sources=(portals.tracked_companies||[]).filter(s=>s.enabled).map(s=>({...s,...(s.config||{})}));
 const unclaimed=findUnclaimedEntries(sources.filter(s=>!['hiringcafe','simplify-summer','simplify-newgrad','simplify-offseason','jobright-newgrad','jobright-internship'].includes(s.id)),providers);
 return {...plan,ready:plan.ready&&validation.errors.length===0,validation,sourceDiagnostics:{unclaimed,staleQueries:findStaleScanQueries(sources,plan.config.title_filter?.positive||[])},provenance:{commit:'c78e14cdfd52f18a92e4a67694efab7ddef59385',validation:'validate-portals.mjs',audit:'audit-portals.mjs',seniority:'classify-tier.mjs via Lookout title-context normalization'}};
}
