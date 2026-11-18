import {asset} from '../../../lib/workspace';
import {useState} from 'react';
import type {Detail,Post} from '../_lib/types';
import {activityGoalProgress,parseCircleActivity} from '../../../../lib/circle-activity.mjs';
import AuthorshipLabel from './authorship-label';
import {companionForMember} from './companions';
import styles from './clubhouse-progress.module.css';

function Trophy(){return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 3h8v6a4 4 0 0 1-8 0V3Zm0 2H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4m-4 2v5m-4 3h8m-6-3h4v3"/></svg>;}
export default function ClubhouseProgress({posts,detail,demo,openPost,milestonesOnly=false}:{posts:Post[];detail:Detail;demo:boolean;openPost:(post:Post)=>void;milestonesOnly?:boolean}) {
 const [expanded,setExpanded]=useState(false),[view,setView]=useState<'journey'|'wins'>('journey');
 const updates=posts.filter(post=>{
  const activity=parseCircleActivity(post.content.body);
  return !post.parentId&&post.state==='published'&&post.revision===post.publishedRevision&&(post.content.type==='milestone'||(!milestonesOnly&&(activity.highlights.length>0||!!activity.goal||!!activity.help)));
 }).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id));
 const visible=expanded?updates:updates.slice(0,3);
 const stages=[{value:'exploring',label:'Exploring'},{value:'applying',label:'Applying'},{value:'interviewing',label:'Interviewing'},{value:'offer',label:'Offer'},{value:null,label:'Stage not shared'}] as const;
 return <section className={styles.room} aria-labelledby="clubhouse-progress-title">
  <header className={styles.header}><div><h3 id="clubhouse-progress-title">Circle Momentum</h3>{demo&&<p>Fictional updates</p>}</div><div className={styles.toggle} aria-label="Momentum view"><button type="button" aria-pressed={view==='journey'} onClick={()=>setView('journey')}>Journey</button><button type="button" aria-pressed={view==='wins'} onClick={()=>setView('wins')}>Wins</button></div></header>
  {view==='journey'?<div><details className={styles.countDetails}><summary>How counts work</summary><p>UTC week: Monday 00:00 to next Monday 00:00. Counts include submitted applications and completed recruiter calls, technical rounds, and interviews with a recorded date. These are tracked records, not verified outcomes or deduplicated interviews.</p></details>{detail.members.some(member=>member.progress)?stages.map(stage=>{const members=detail.members.filter(member=>member.progress&&member.progress.careerStage===stage.value);return members.length?<section key={stage.label} className={styles.stageGroup}><h4>{stage.label}</h4><ul>{members.map(member=><li key={member.id}><strong>{member.alias.replace(' (demo)','')}</strong><span>{member.progress!.applications} applications · {member.progress!.interviews} interview activities</span></li>)}</ul></section>:null;}):<p className={styles.week}>No one has shared counts yet. Manage sharing in Circle settings.</p>}</div>:<>{visible.length?<ul id="clubhouse-progress-updates" className={styles.updates}>{visible.map(post=>{
   const activity=parseCircleActivity(post.content.body),goal=activityGoalProgress(activity.goal),name=post.author.replace(' (demo)','');
   return <li key={post.id} className={styles.update}>
    <span className={styles.avatar} aria-hidden="true">{demo?<span style={{backgroundImage:`url('${asset(`circles/${companionForMember(post.author).id}.webp`)}')`}}/>:name.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('')}</span>
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
  })}</ul>:<div className={styles.empty}><Trophy/><h4>No wins shared yet.</h4><p>Share a milestone when you’re ready.</p></div>}
  {updates.length>3&&<button type="button" className={styles.more} aria-expanded={expanded} aria-controls="clubhouse-progress-updates" onClick={()=>setExpanded(!expanded)}>{expanded?'Show latest updates':`View all ${updates.length} updates`}</button>}
  </>}
 </section>;
}
