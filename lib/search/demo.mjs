import {profileDocument,portalsDocument,parseDocument} from './documents.mjs';
export function searchDemo(){
 const profile={id:'demo-search',name:'Systems roles (fictional)',active:true,filters:{Employment:'Full-time, Internship',Location:'United States'},priorities:{Growth:'Very important'},instructions:'## Goals\nExplore backend systems and developer infrastructure.\n## Exceptions\nReview promising teams when leveling is unclear.'};
 const portals={tracked_companies:[{id:'demo-source',name:'Example Systems (fictional)',kind:'careers',careers_url:'https://example.com/careers',enabled:true}],search_queries:['fictional backend engineering internships'],title_filter:{positive:['Software Engineer','Backend'],negative:['word:Senior']},location_filter:{allow:['United States','Remote'],strict:false}};
 const documents=[['profile',profile.id,profileDocument(profile)],['rules','shared','Show location and preserve unknown eligibility.'],['portals','shared',portalsDocument(portals)]].map(([kind,id,content])=>({kind,id,version:1,...parseDocument(kind,content)}));
 const run={id:'demo-run',profile_id:profile.id,state:'partial',version:3,mode:'fresh',days:3,summary:'Fictional search: one employer portal reviewed, one discovery saved; web search unavailable.',created_at:'2026-10-20T12:00:00Z',contextChanged:false,sources:[{source_id:'portal:demo-source',state:'completed',version:1,source:portals.tracked_companies[0],coverage:'exhaustive',counts:{found:1},checkpoint:{page:1},blocker:''},{source_id:'query:1',state:'blocked',version:1,source:{query:portals.search_queries[0]},coverage:'inaccessible',counts:{found:0},checkpoint:{},blocker:'Fictional example: personal agent search unavailable.'}]};
 return {documents,profileId:profile.id,runs:[run],listings:[{id:'demo-listing',company:'Example Systems (fictional)',title:'Backend Engineering Intern',location:'New York, United States',canonical_url:'https://example.com/jobs/demo',screening:{version:1,decision:'review-needed',explanation:'Fictional copied search filters kept this lead; graduation and authorization remain unresolved before personal eligibility can be claimed.',checks:[{requirement:'graduation',status:'unknown',evidence:'Fictional JD omits graduation window.'},{requirement:'careerops-title',status:'met',evidence:'Fictional saved result: the configured original title filter kept this lead.'},{requirement:'authorization',status:'unknown',evidence:'A passed discovery filter does not establish personal work authorization.'},{requirement:'careerops-salary',status:'not-applicable',evidence:'No salary constraint is configured in this fictional profile.'}]},observation:{liveness:'active',evidence:'Fictional employer observation for demonstration only.',description:'Fictional internship working on backend infrastructure.',employer_posted_at:null,source_list_age_days:2},possibleDuplicates:[],applications:[]}]};
}
// Keep the demo's existing preference controls and document editor on one state.
export function synchronizeSearchDemo(data,preferences={}){
 const docs=[...data.documents];
 for(const p of preferences.profiles||[]){
  const current=docs.find(d=>d.kind==='profile'&&d.id===p.id);
  const parsed=parseDocument('profile',profileDocument(p));
  if(!current)docs.push({kind:'profile',id:p.id,version:p.version||1,...parsed});
  else if(JSON.stringify(current.projection)!==JSON.stringify(parsed.projection))Object.assign(current,{...parsed,version:Math.max(current.version+1,p.version||1)});
 }
 if(preferences.profiles?.length){
  data.profileId=preferences.profiles[0].id;data.runs=data.runs.map(r=>({...r,profile_id:data.profileId}));
  data.documents=docs.filter(d=>d.kind!=='profile'||preferences.profiles.some(p=>p.id===d.id));
 }else data.documents=docs;
 if(preferences.targets){
  const portal=data.documents.find(d=>d.kind==='portals');
  const next=preferences.targets.map(t=>({...portal.projection.tracked_companies.find(s=>s.id===t.id),id:t.id,name:t.name,kind:t.kind,careers_url:t.address,enabled:portal.projection.tracked_companies.find(s=>s.id===t.id)?.enabled??true}));
  if(JSON.stringify(next)!==JSON.stringify(portal.projection.tracked_companies))Object.assign(portal,{...parseDocument('portals',portalsDocument({...portal.projection,tracked_companies:next})),version:portal.version+1});
 }
 return data;
}
