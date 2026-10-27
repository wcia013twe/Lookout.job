import {companyKey} from './network-model.mjs';
import {companyContexts} from './company-knowledge.mjs';
import {trackerProgress} from './tracker-display.mjs';

// Recommendations come from the owned process, never inferred from shared posts.
export function interviewingCompanies({roles=[],tracker={},applications={}}={}) {
 const result=new Map();
 for(const id of new Set([...(tracker.ids||[]),...Object.keys(applications)])){
  const row={...roles.find(role=>role.id===id),...applications[id]};
  const progress=trackerProgress(row,tracker.items?.[id]||{}),key=companyKey(row.company);
  if(!key||['Rejected','Withdrawn'].includes(progress.status)||progress.level<2||progress.level>3)continue;
  const candidate={key,company:row.company,role:row.title||'',stage:progress.status,level:progress.level};
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
