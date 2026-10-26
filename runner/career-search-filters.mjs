// Translate Lookout records; all configured search predicates remain upstream.
import {readField} from '../lib/search-profile.mjs';
export async function filterDiscovery({profile,applicant={},listings,portals={},now=Date.now()}){
 if(!Array.isArray(listings)||listings.length>100)throw Error('Filter at most 100 saved discoveries or aggregate leads');
 const scan=await import('./vendor/career-ops/scan.mjs');const {buildTitleFilter}=await import('./vendor/career-ops/title-keywords.mjs');
 const instructions=profile.instructions||'',filters=profile.filters||{},diagnostics=[];
 const field=(heading,key)=>{const result=readField(instructions,heading,key);if(result.conflict)throw Error('Resolve duplicate preference '+key);return result.value;};
 const strength=key=>field('Priority & flexibility',key)||(/required/i.test(filters[key]||'')||key==='Employment'?'Required':'Preferred');
 const title=buildTitleFilter(portals.title_filter),content=scan.buildContentFilter(portals.content_filter),age=scan.buildPostingAgeFilter(portals.max_posting_age_days,now),dates=scan.buildPostedDateFilter(portals.posted_after,portals.posted_before);
 const country=field('Eligibility & availability','Work authorization country');const countryGate=scan.buildCountryEligibilityFilter(portals.country_eligibility_filter,country);
 const visa=scan.buildVisaFilter(portals.visa_filter),salary=scan.buildSalaryFilter(portals.salary_filter),cooldown=scan.buildCooldownFilter(portals.re_apply_windows,new Date(now).toISOString().slice(0,10));
 const locations=String(filters.Location||'').split(/[;,]/).map(x=>x.trim()).filter(Boolean);
 const locationGate=scan.buildLocationFilter(locations.length?{allow:locations,strict:strength('Location')==='Required'}:portals.location_filter);
 const arrangement=String(filters['Work arrangement']||'').toLowerCase(),workTerms=arrangement.includes('remote')?['remote']:arrangement.includes('hybrid')?['hybrid']:arrangement.includes('on-site')||arrangement.includes('onsite')?['on-site','onsite','in-office','in office']:[];
 const workKnown=scan.buildLocationFilter({allow:['remote','hybrid','on-site','onsite','in-office','in office'],strict:true}),workGate=scan.buildLocationFilter({allow:workTerms,strict:true});
 const intern=buildTitleFilter({positive:['word:intern','word:internship','co-op','co op']}),newgrad=buildTitleFilter({positive:['new grad','new graduate','new college grad']});
 if(filters['Minimum base pay']&&!portals.salary_filter)diagnostics.push('Minimum base pay is freeform and has no normalized upstream salary_filter; it remains unresolved rather than silently ignored.');
 const facts=applicant?.facts||applicant||{};
 const results=listings.map(item=>{
  const observation=item.observation||item,job={...item,description:observation.description||item.description||'',postedAt:observation.employer_posted_at?Date.parse(observation.employer_posted_at):item.postedAt,salary:item.salary||null};
  const checks=[],rejectedBy=[];let hardFailure=false;
  const add=(requirement,status,evidence,required=false)=>{checks.push({requirement,status,evidence:String(evidence).slice(0,3000)});if(status==='unmet'){rejectedBy.push(requirement);if(required)hardFailure=true;}};
  const upstream=(name,passed,present=true,required=true)=>add(name,present?(passed?'met':'unmet'):'unknown',present?`Original CareerOps ${name} predicate ${passed?'kept':'rejected'} this lead.`:`Missing source data; upstream conservative pass does not establish ${name}.`,required);
  upstream('careerops-title',title(job.title),Boolean(job.title));upstream('careerops-posting-age',age(job.postedAt),Number.isFinite(job.postedAt));upstream('careerops-posted-date',dates(job.postedAt),Number.isFinite(job.postedAt));upstream('careerops-content',content(job.description,scan.matchedTitleKeywords(job.title,portals.title_filter)),Boolean(job.description));upstream('careerops-country',countryGate(job.description),Boolean(job.description)&&Boolean(country));upstream('careerops-visa',visa(job.description),Boolean(job.description)&&Boolean(portals.visa_filter));upstream('careerops-salary',salary(job.salary),Boolean(job.salary)&&Boolean(portals.salary_filter));
  const cooling=cooldown(job);upstream('careerops-cooldown',!cooling.skip,true);
  const requested=String(filters.Employment||'').toLowerCase(),observed=item.employment_type||item.employmentType||observation.employment_type;
  const type=observed==='Internship'||intern(job.title)?'Internship':observed==='FT'||newgrad(job.title)?'FT':null;
  if(requested){const pass=type==='Internship'?requested.includes('internship'):type==='FT'?requested.includes('full-time'):null;add('employment',pass===null?'unknown':pass?'met':'unmet',`Configured ${filters.Employment}; source/title track ${type||'not disclosed'}. This is discovery triage.`,strength('Employment')==='Required');}
  if(workTerms.length){const known=workKnown(job.location,job.canonical_url||job.url,job.title);add('work-arrangement',known?(workGate(job.location,job.canonical_url||job.url,job.title)?'met':'unmet'):'unknown',known?`Original CareerOps location predicate checked explicit work-model location/title against ${filters['Work arrangement']}.`:'Work model is not explicit in provider location/title; technical description terms do not establish office policy.',strength('Work arrangement')==='Required');}
  add('location',job.location?(locationGate(job.location,job.canonical_url||job.url,job.title)?'met':'unmet'):'unknown',job.location?`Provider location: ${job.location}; user constraint: ${filters.Location||'none'}.`:'Employer location is not disclosed.',strength('Location')==='Required');
  for(const key of ['experience','graduation','availability','authorization','prior-application','company-limits'])add(key,'unknown',key==='authorization'?'Authorization/sponsorship is not inferred from country or a passed discovery filter.':`Agent must reconcile ${key} with current applicant evidence and this exact employer requirement before claiming eligibility.`);
  if(filters['Minimum base pay']&&!portals.salary_filter)add('minimum-base-pay','unknown',diagnostics[0],strength('Minimum base pay')==='Required');
  const decision=hardFailure?'ineligible':'review-needed';return {listingId:item.id||item.url,passed:!hardFailure,rejectedBy,checks,decision,explanation:hardFailure?'Excluded by a Required saved discovery constraint: '+rejectedBy.join(', '):'Passed configured required discovery gates; unresolved personal eligibility and narrative fit still require agent review.'};
 });
 return {results,diagnostics,provenance:{commit:'c78e14cdfd52f18a92e4a67694efab7ddef59385',filters:'scan.mjs exported predicates + title-keywords.mjs',personalScoresProduced:false}};
}
