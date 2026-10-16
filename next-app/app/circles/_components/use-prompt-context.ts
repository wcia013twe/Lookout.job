'use client';
import {useWorkspace} from '../../../lib/workspace';
import {trackerProgress} from '../../../../lib/tracker-display.mjs';
import {applicationContext,referralContext,publicContextUrl} from '../../../../lib/circle-attachments.mjs';
import type {Content,SharedContext} from '../_lib/types';
export type ContextOption={key:string;group:'Applications'|'Referrals'|'Circle';context:SharedContext};
const demoApplications=[{id:'robinhood',company:'Robinhood',title:'Backend Engineer, Distributed Systems and Reliability',stage:'Applied'},{id:'stripe',company:'Stripe',title:'Infrastructure Engineer',stage:'Interview'}];
const demoReferrals=[{id:'stripe-contact',company:'Stripe',contact:'Jamie Chen (demo)',title:'Infrastructure Engineer'},{id:'robinhood-contact',company:'Robinhood',contact:'Alex Morgan (demo)',title:'Technical recruiter'}];
export default function usePromptContext(demo:boolean,shared:Content[]):ContextOption[]{
 const w=useWorkspace();
 const items:ContextOption[]=[];
 if(demo){
  for(const row of demoApplications)items.push({key:`demo-app-${row.id}`,group:'Applications',context:applicationContext(row,row.stage) as SharedContext});
  for(const row of demoReferrals)items.push({key:`demo-referral-${row.id}`,group:'Referrals',context:referralContext(row) as SharedContext});
 }else if(w?.user&&w.state){
  const ids=[...new Set<string>([...(w.state.tracker?.ids||[]),...Object.keys(w.state.workflow?.applications||{})])];
  for(const id of ids){const row={...w.roles?.find((r:{id:string})=>r.id===id),...w.state.workflow?.applications?.[id]};if(row.company&&row.title)items.push({key:`app-${id}`,group:'Applications',context:applicationContext(row,trackerProgress(row,w.state.tracker?.items?.[id]||{}).status) as SharedContext});}
  for(const row of w.state.network?.referrals||[])items.push({key:`referral-${row.id}`,group:'Referrals',context:referralContext(row) as SharedContext});
 }
 shared.forEach((row,index)=>{
  for(const [contextIndex,context] of (row.contexts||[]).entries())items.push({key:`circle-context-${index}-${contextIndex}`,group:'Circle',context:{...context}});
  if(row.role||row.jobUrl||row.jobId)items.push({key:`circle-job-${index}`,group:'Circle',context:applicationContext({...row,title:row.role||''},row.stage) as SharedContext});
  for(const [sourceIndex,source] of row.sources.entries()){const url=publicContextUrl(source.url);if(url)items.push({key:`circle-source-${index}-${sourceIndex}`,group:'Circle',context:{kind:'resource',label:source.label.slice(0,200),url}});}
 });
 return items.filter((item,index,all)=>all.findIndex(other=>JSON.stringify(other.context)===JSON.stringify(item.context))===index);
}
