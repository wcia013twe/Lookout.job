import {companyKey} from './network-model.mjs';
import {companyContexts} from './company-knowledge.mjs';
import {trackerProgress,sharedTrackerStage} from './tracker-display.mjs';
import {currentTimelineItems} from './application-timeline.mjs';

// Recommendations come from the owned process, never inferred from shared posts.
export function interviewingCompanies({roles=[],tracker={},applications={}}={}) {
 const result=new Map();
 for(const id of new Set([...(tracker.ids||[]),...Object.keys(applications)])){
  const row={...roles.find(role=>role.id===id),...applications[id]};
  const progress=trackerProgress(row,tracker.items?.[id]||{}),key=companyKey(row.company);
  if(!key||['Rejected','Withdrawn'].includes(progress.status)||progress.level<2||progress.level>3)continue;
  const nextRound=currentTimelineItems(row).find(item=>item.phase==='scheduled'&&(progress.level===2?['recruiter_call','phone_screen']:['technical_round','interview','onsite']).includes(item.kind));
  const candidate={key,company:row.company,role:row.title||'',stage:nextRound?.label||progress.status,level:progress.level};
  if(!result.has(key)||candidate.level>result.get(key).level)result.set(key,candidate);
 }
 return [...result.values()].sort((a,b)=>b.level-a.level||a.company.localeCompare(b.company));
}

// A bounded view of readable source threads, not a global/company activity count.
export function companySpaces(posts,recommendations=[]) {
 const spaces=new Map(recommendations.map(item=>[item.key,{...item,recommended:true,posts:[]}]));
 for(const post of posts){
  if(post.parentId||post.state!=='published'||post.revision!==post.publishedRevision)continue;
  for(const context of companyContexts(post.content)){
   const key=companyKey(context.company);if(!key)continue;
   if(!spaces.has(key))spaces.set(key,{key,company:context.company,role:context.role||'',stage:'',recommended:false,posts:[]});
   const space=spaces.get(key);
   if(!space.posts.some(item=>item.id===post.id))space.posts.push(post);
  }
 }
 return [...spaces.values()];
}
export function companyTopics(posts){
 const labels={interview_report:'Interview experiences',timeline:'Recruiting timelines',milestone:'Process updates',discussion:'Questions & advice',offer_comparison:'Offer decisions',resource:'Prep resources',opportunity:'Role discoveries'};
 return [...new Set(posts.map(post=>labels[post.content.type]).filter(Boolean))].slice(0,3);
}

// Rank only source contexts attached to this company; never borrow another
// company’s role/stage to make a discussion appear personally relevant.
export function companyConversations(space,limit=3){
 const targetStage=companyKey(space.stage),targetLevel=space.level??sharedTrackerStage(space.stage).level;
 return space.posts.filter(post=>post.state==='published'&&post.revision===post.publishedRevision&&!post.parentId).map(post=>{
  const contexts=companyContexts(post.content).filter(context=>companyKey(context.company)===space.key);
  const candidates=contexts.map(context=>{
   const stage=context.stage||post.content.stage||'',role=context.role||'';
   const exactStage=!!targetStage&&companyKey(stage)===targetStage;
   const sameStage=targetLevel>=0&&sharedTrackerStage(stage).level===targetLevel;
   const roleMatch=!!space.role&&companyKey(role)===companyKey(space.role);
   return {stage,role,score:(exactStage?50:sameStage?25:0)+(roleMatch?15:role&&space.role?-15:0)};
  }).sort((a,b)=>b.score-a.score);
  return {post,...(candidates[0]||{stage:'',role:'',score:-100})};
 }).sort((a,b)=>b.score-a.score||(b.post.content.experienceDate||'').localeCompare(a.post.content.experienceDate||'')||a.post.id.localeCompare(b.post.id)).slice(0,limit);
}

// These are scoped source counts, never inferred population statistics.
/** @param {any} space @param {{roles?: any[], partial?: boolean, now?: number}} [options] */
export function companyActivity(space,{roles=[],partial=false,now=Date.now()}={}){
 const listings=new Map();
 for(const role of roles){
  if(companyKey(role.company)!==space.key)continue;
  const key=role.applicationUrl&&role.applicationUrl!=='#'?role.applicationUrl:role.id;
  if(!key)continue;
  const previous=listings.get(key);
  const checked=Date.parse(role.postingObservation?.checkedAt||''),prior=Date.parse(previous?.postingObservation?.checkedAt||'');
  if(!previous||Number.isFinite(checked)&&(!Number.isFinite(prior)||checked>prior))listings.set(key,role);
 }
 const recent=[...listings.values()].filter(role=>{
  const checked=Date.parse(role.postingObservation?.checkedAt||''),age=now-checked;
  return Number.isFinite(checked)&&age>=0&&age<=72*3600000&&['active','expired'].includes(role.postingObservation?.liveness);
 });
 const active=recent.filter(role=>role.postingObservation.liveness==='active').length;
 const insightTypes=new Set(['interview_report','timeline','milestone','discussion','offer_comparison']);
 const insights=new Set(space.posts.filter(post=>post.state==='published'&&post.revision===post.publishedRevision&&!post.parentId&&insightTypes.has(post.content.type)).map(post=>post.id)).size;
 return {activeJobs:recent.length&&(active||recent.length===listings.size)?active:null,activeJobsPartial:recent.length<listings.size,sharedInsights:partial&&!insights?null:insights,insightsPartial:partial,applicants:null,atYourStage:null};
}
