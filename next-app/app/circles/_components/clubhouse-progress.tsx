import {useState} from 'react';
import type {Post} from '../_lib/types';
import {activityGoalProgress,parseCircleActivity} from '../../../../lib/circle-activity.mjs';
import AuthorshipLabel from './authorship-label';

export default function ClubhouseProgress({posts,demo,openPost}:{posts:Post[];demo:boolean;openPost:(post:Post)=>void}) {
 const [expanded,setExpanded]=useState(false);
 const updates=posts.filter(post=>{
  const activity=parseCircleActivity(post.content.body);
  return !post.parentId&&post.state==='published'&&post.revision===post.publishedRevision&&(post.content.type==='milestone'||activity.highlights.length>0||!!activity.goal||!!activity.help);
 }).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id));
 const visible=expanded?updates:updates.slice(0,3);
 return <section className="mb-6 border-b border-board-line pb-5" aria-labelledby="clubhouse-progress-title">
  <header className="mb-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"><h3 id="clubhouse-progress-title" className="text-base font-semibold">Trophy room</h3><p className="text-xs text-board-muted">{demo?'Fictional shared updates':'Shared with this Circle'}</p></header>
  {visible.length?<ul id="clubhouse-progress-updates" className="divide-y divide-board-line">{visible.map(post=>{
   const activity=parseCircleActivity(post.content.body),goal=activityGoalProgress(activity.goal);
   return <li key={post.id} className="py-4">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-board-muted"><strong className="text-sm text-board-text">{post.author.replace(' (demo)','')}</strong><AuthorshipLabel post={post}/><time dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'America/New_York'})}</time>{post.content.stage&&<span className="font-medium text-board-accent">{post.content.stage}</span>}</div>
    <button type="button" onClick={()=>openPost(post)} className="min-h-11 py-2 text-left text-sm font-semibold leading-relaxed hover:underline underline-offset-4">{post.content.title}</button>
    {!!activity.highlights.length&&<ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-board-text">{activity.highlights.map((highlight:string,index:number)=><li key={index}>{highlight}</li>)}</ul>}
    {activity.goal&&<div className="mt-2 max-w-md"><p className="text-sm leading-relaxed text-board-muted"><span className="font-medium text-board-text">Goal: </span>{activity.goal}</p>{goal&&<progress className="mt-2 block h-2 w-full accent-board-accent" max={goal.target} value={goal.completed} aria-label={`${post.author.replace(' (demo)','')}’s shared goal`} aria-valuetext={activity.goal}/>}</div>}
    {activity.help&&<p className="mt-2 text-sm leading-relaxed text-board-muted"><span className="font-medium text-board-text">Could use a hand: </span>{activity.help}</p>}
    {!activity.highlights.length&&!activity.goal&&!activity.help&&(post.content.insight||post.content.body)&&<p className="line-clamp-2 max-w-prose text-sm leading-relaxed text-board-muted">{post.content.insight||post.content.body}</p>}
    <button type="button" onClick={()=>openPost(post)} className="mt-1 min-h-11 text-xs font-medium text-board-accent hover:underline underline-offset-4">{post.content.type==='milestone'?'Celebrate & reply':'Open update & reply'}</button>
   </li>;
  })}</ul>:<p className="py-5 text-sm leading-relaxed text-board-muted">No progress shared yet. Write an update to share a win, a goal, or something you could use a hand with. Private tracker activity stays private.</p>}
  {updates.length>3&&<button type="button" className="min-h-11 text-sm font-medium text-board-accent hover:underline underline-offset-4" aria-expanded={expanded} aria-controls="clubhouse-progress-updates" onClick={()=>setExpanded(!expanded)}>{expanded?'Show latest updates':`View all ${updates.length} updates`}</button>}
 </section>;
}
