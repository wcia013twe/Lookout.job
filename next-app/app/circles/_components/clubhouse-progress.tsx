import {useState} from 'react';
import type {Post} from '../_lib/types';
import {activityGoalProgress,parseCircleActivity} from '../../../../lib/circle-activity.mjs';
import AuthorshipLabel from './authorship-label';
import {companionForMember} from './companions';
import styles from './clubhouse-progress.module.css';

function Trophy(){return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 3h8v6a4 4 0 0 1-8 0V3Zm0 2H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4m-4 2v5m-4 3h8m-6-3h4v3"/></svg>;}
export default function ClubhouseProgress({posts,demo,openPost}:{posts:Post[];demo:boolean;openPost:(post:Post)=>void}) {
 const [expanded,setExpanded]=useState(false);
 const updates=posts.filter(post=>{
  const activity=parseCircleActivity(post.content.body);
  return !post.parentId&&post.state==='published'&&post.revision===post.publishedRevision&&(post.content.type==='milestone'||activity.highlights.length>0||!!activity.goal||!!activity.help);
 }).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id));
 const visible=expanded?updates:updates.slice(0,3);
 return <section className={styles.room} aria-labelledby="clubhouse-progress-title">
  <header className={styles.header}><span className={styles.trophy}><Trophy/></span><div><h3 id="clubhouse-progress-title">Trophy room</h3><p>Small steps. Big moments. Your people.</p></div><span className={styles.disclosure}>{demo?'Fictional updates':'Shared with your Circle'}</span></header>
  {visible.length?<ul id="clubhouse-progress-updates" className={styles.updates}>{visible.map(post=>{
   const activity=parseCircleActivity(post.content.body),goal=activityGoalProgress(activity.goal),name=post.author.replace(' (demo)','');
   return <li key={post.id} className={styles.update}>
    <span className={styles.avatar} aria-hidden="true">{demo?<span style={{backgroundImage:`url('/circles/${companionForMember(post.author).id}.webp')`}}/>:name.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('')}</span>
    <div className={styles.content}>
     <div className={styles.meta}><strong>{name}</strong><AuthorshipLabel post={post}/><time dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'America/New_York'})}</time></div>
     <button type="button" onClick={()=>openPost(post)} className={styles.title}>{post.content.title}</button>
     {!!activity.highlights.length&&<ul className={styles.highlights}>{activity.highlights.map((highlight:string,index:number)=><li key={index}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>{highlight}</li>)}</ul>}
     {activity.goal&&<div className={styles.goal}><div><span>Shared goal</span>{goal&&<strong>{goal.completed}<span> / {goal.target}</span></strong>}</div><p>{goal?goal.label:activity.goal}</p>{goal&&<div className={styles.track} role="progressbar" aria-label={`${name}’s shared goal`} aria-valuemin={0} aria-valuemax={goal.target} aria-valuenow={goal.completed} aria-valuetext={activity.goal}><span style={{width:`${goal.percent}%`}}/></div>}</div>}
     {activity.help&&<p className={styles.help}><strong>Could use a hand</strong>{activity.help}</p>}
     {!activity.highlights.length&&!activity.goal&&!activity.help&&(post.content.insight||post.content.body)&&<p className={styles.summary}>{post.content.insight||post.content.body}</p>}
     <footer className={styles.footer}>{post.content.stage&&<span className={styles.stage}>{post.content.stage}</span>}<button type="button" onClick={()=>openPost(post)}>{post.content.type==='milestone'?'Celebrate & reply':'Open update & reply'}<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg></button></footer>
    </div>
   </li>;
  })}</ul>:<div className={styles.empty}><Trophy/><h4>Make room for your first win.</h4><p>Write an update to share a milestone, a goal, or a little progress. Your private tracker stays private.</p></div>}
  {updates.length>3&&<button type="button" className={styles.more} aria-expanded={expanded} aria-controls="clubhouse-progress-updates" onClick={()=>setExpanded(!expanded)}>{expanded?'Show latest updates':`View all ${updates.length} updates`}</button>}
 </section>;
}
