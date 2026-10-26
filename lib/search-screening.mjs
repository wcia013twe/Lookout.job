import {executeCareerTask} from '../runner/career-tools.mjs';
export async function screenSearchDiscoveries(dispatch,request,{evaluate=input=>executeCareerTask('filter-discovery',input)}={}){
 const call=async(operation,payload)=>{const r=await dispatch(operation,payload);if(r.error)throw r.error;return r.data;};
 try{
  const replay=await call('search.screenings.read',{request});if(replay)return {data:{...replay,replayed:true},error:null};
  const run=await call('search.run.read',{runId:request.runId}),context=await call('search.context',{profileId:run.profile_id});
  const profile=context.documents?.find(d=>d.kind==='profile'&&d.id===run.profile_id);if(!profile)throw {code:'P0002'};
  const wanted=new Set(request.listingIds),found=new Map();
  for(let offset=0;found.size<wanted.size&&offset<=5000;){const page=await call('search.discoveries.read',{runId:request.runId,offset,limit:100});for(const row of page.listings||[])if(wanted.has(row.id))found.set(row.id,row);if(page.nextOffset===null)break;if(!Number.isSafeInteger(page.nextOffset)||page.nextOffset<=offset)throw {code:'22023',message:'Search discovery pagination is invalid'};offset=page.nextOffset;}
  if(found.size!==wanted.size)throw {code:'P0002'};
  const portals=context.documents.find(d=>d.kind==='portals')?.projection||{};
  const evaluated=await evaluate({profile:profile.projection,applicant:context.profile,listings:request.listingIds.map(id=>found.get(id)),portals,now:Date.now()});
  const screenings=evaluated.results.map(r=>({listingId:r.listingId,observationId:found.get(r.listingId).observation.id,expectedVersion:found.get(r.listingId).screeningVersion||0,decision:r.decision,checks:r.checks,explanation:r.explanation}));
  const data=await call('search.screenings.commit',{request,expectedPersonalVersion:context.personalVersion,expectedProfileVersion:profile.version,screenings,diagnostics:evaluated.diagnostics});return {data,error:null};
 }catch(error){return {error:error?.code?error:{code:'22023',message:'Search filtering failed: '+String(error?.message||'upstream adapter unavailable').slice(0,170)}};}
}
