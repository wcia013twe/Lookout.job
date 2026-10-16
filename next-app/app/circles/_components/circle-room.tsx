'use client';

import {useEffect, useState, useRef, type ReactNode, type CSSProperties} from 'react';
import type {Detail, Post} from '../_lib/types';
import {activityGoalProgress,parseCircleActivity,sharedMemberActivity} from '../../../../lib/circle-activity.mjs';
import styles from './circle-room.module.css';
import {routines} from './room-motion';
import {companions} from './companions';
import {useRoomMotion} from './use-room-motion';

type Props = {embedded?:boolean;activityControl?:ReactNode;detail:Detail; posts:Post[]; demo:boolean; person:string; selectPerson:(id:string)=>void;openPost:(post:Post)=>void};
export default function CircleRoom({embedded=false,activityControl,detail,posts,demo,person,selectPerson,openPost}:Props) {
 const [memberPage,setMemberPage]=useState(0);
 const [paused,setPaused]=useState(false);
 const [ambience,setAmbience]=useState('moon');
 const [gathered,setGathered]=useState(false);
 const [selectedCompanion,setSelectedCompanion]=useState<string|null>(null);
 const [greeting,setGreeting]=useState<{id:string;at:number}|null>(null);
 const roomRef=useRef<HTMLDivElement>(null);
 const allOccupants=demo?[...companions.map(companion=>({companion,member:detail.members.find(member=>member.id===companion.member),key:companion.id})).filter(item=>item.member),...detail.members.filter(member=>!companions.some(companion=>companion.member===member.id)).map(member=>({companion:companions[0],member,key:member.id}))]:detail.members.map((member,index)=>({companion:companions[index%companions.length],member,key:member.id}));
 const page=Math.min(memberPage,Math.max(0,Math.ceil(allOccupants.length/5)-1));
 const occupants=allOccupants.slice(page*5,page*5+5);
 useRoomMotion(roomRef,paused||!!selectedCompanion,occupants.map(item=>item.key).join(','),gathered);
 const cardRef=useRef<HTMLElement>(null),triggerRef=useRef<HTMLButtonElement|null>(null);
 useEffect(()=>{if(selectedCompanion)cardRef.current?.focus();},[selectedCompanion]);
 function closeActivity(){setSelectedCompanion(null);triggerRef.current?.focus();}
 useEffect(()=>{if(!greeting)return;const timer=setTimeout(()=>setGreeting(null),4500);return()=>clearTimeout(timer);},[greeting]);
 const selected=detail.members.find(member=>member.id===person);
 const occupant=occupants.find(item=>item.key===selectedCompanion);
 const greeted=occupant?.companion,linkedMember=occupant?.member;
 const updates:Post[]=linkedMember?sharedMemberActivity(posts,linkedMember.alias):[];
 const activityPost=updates.find(post=>{const activity=parseCircleActivity(post.content.body);return activity.highlights.length||activity.goal||activity.help;});
 const activity=parseCircleActivity(activityPost?.content.body);
 const goalProgress=activityGoalProgress(activity.goal);
 const name=linkedMember?.alias.replace(' (demo)','')||greeted?.name||'';
 const latest=updates[0];
 const date=(value:string)=>new Date(value).toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'America/New_York'});

 return <section className={styles.roomSection} data-embedded={embedded} aria-labelledby="circle-room-title">
  <div className={styles.toolbar}>
   <div><h2 id="circle-room-title">The cloud cottage</h2><p>Your people. A little progress. A whole lot of company.</p></div>
   <div className={styles.controls}>
    {allOccupants.length>5&&<><button type="button" disabled={page===0} onClick={()=>{setMemberPage(page-1);setSelectedCompanion(null);}}>Previous people</button><span className={styles.pageCount}>{page+1} / {Math.ceil(allOccupants.length/5)}</span><button type="button" disabled={(page+1)*5>=allOccupants.length} onClick={()=>{setMemberPage(page+1);setSelectedCompanion(null);}}>Next people</button></>}
    <label><span className={styles.srOnly}>Room ambience</span><select value={ambience} onChange={event=>setAmbience(event.target.value)}><option value="moon">Moonlight</option><option value="warm">Starlight lamps</option></select></label>
    <button type="button" aria-pressed={gathered} onClick={()=>setGathered(!gathered)}>{gathered?'Back to stations':'Gather on the rug'}</button>
    <button type="button" aria-pressed={paused} onClick={()=>setPaused(!paused)}>{paused?'Resume motion':'Pause motion'}</button>
   </div>
  </div>
  {activityControl}
  <div className={styles.roomWithActivity}>
  <div className={styles.viewport}>
   <div ref={roomRef} className={styles.room} data-paused={paused||!!selectedCompanion} data-gathered={gathered} data-ambience={ambience}>
    <div className={styles.backdrop} role="img" aria-label="Moonlit cloud cottage with a cloud-shaped window, tiny laptop desk, practice board, book table, star lamps and a lilac beanbag"/>
    <div className={styles.roomPlaque}><span className={styles.lamp}/><span>The cloud cottage</span><span className={styles.plaqueNote}>Circle clubhouse</span></div>
    {occupants.map(({companion,member,key},index)=>{
     const routine=routines[index%routines.length];
     const reacting=greeting?.id===companion.id;
     const style={'--move-x':`${routine.station.x}cqw`,'--move-y':`${routine.station.y*2/3}cqw`,'--companion-image':`url('/circles/${companion.id}.webp')`} as CSSProperties;
     return <button key={key} type="button" className={styles.character} style={style} data-routine={index} data-task={routine.task} data-mode="working" data-reaction={reacting} aria-pressed={selectedCompanion===key} aria-expanded={selectedCompanion===key} aria-controls="companion-activity" onClick={event=>{triggerRef.current=event.currentTarget;setSelectedCompanion(selectedCompanion===key?null:key);setGreeting({id:companion.id,at:Date.now()});}} aria-label={`See ${member?.alias.replace(' (demo)','')||companion.name}’s recent activity`}>
      <span className={styles.bubble} data-bubble><strong>{member?.alias.replace(' (demo)','')||companion.name}</strong><span className={styles.activity}>{gathered?'Hanging out together':member?'View shared activity':companion.station}</span><span className={styles.journey} data-journey/><span className={styles.sessionDetail}>{demo?companion.detail:'Decorative companion'}</span></span>
      <span className={styles.sprite} aria-hidden="true"/>
      <span className={styles.sparkles} aria-hidden="true"><svg viewBox="0 0 100 90" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 22 3-8 3 8 8 3-8 3-3 8-3-8-8-3 8-3Zm65-9 2-6 2 6 6 2-6 2-2 6-2-6-6-2 6-2Zm7 48 3-8 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z"/></svg></span>
      <span className={styles.musicNotes} aria-hidden="true"><svg viewBox="0 0 60 90" fill="none" stroke="currentColor" strokeWidth="3"><path d="M16 48V21l24-6v27M16 27l24-6"/><ellipse cx="10" cy="49" rx="6" ry="4" fill="currentColor"/><ellipse cx="34" cy="43" rx="6" ry="4" fill="currentColor"/></svg></span>
      <span className={styles.shadow} aria-hidden="true"/>
     </button>;
    })}
   </div>
  </div>
  {embedded&&!occupant&&<aside className={styles.statusPlaceholder} aria-label="Companion status"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M7 9h10M7 13h7m-7 4h4"/></svg><h3>In their corner</h3><p>Click a companion to see their recent activity, this week’s goal, and how you can help.</p><span>Only updates they choose to share.</span></aside>}
  {occupant&&<section ref={cardRef} tabIndex={-1} id="companion-activity" className={styles.activityCard} aria-labelledby="companion-activity-title" onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();closeActivity();}}}>
   <header className={styles.activityHeader}><span className={styles.statusAvatar} style={{backgroundImage:`url('/circles/${greeted?.id}.webp')`}} aria-hidden="true"/><div><h3 id="companion-activity-title">{name}’s progress</h3><p>{demo?'Fictional shared updates': 'Shared with this Circle'}</p></div><button type="button" onClick={closeActivity} aria-label="Close activity"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg></button></header>
   {latest?<>
    <p className={styles.activityHeadline}>{latest.content.title}</p>
    <p className={styles.activityDate}>Latest shared update · <time dateTime={latest.createdAt}>{date(latest.createdAt)}</time></p>
    {activityPost&&<>
     {activity.goal&&<div className={styles.goal}>
      <div className={styles.goalHeading}><h4>This week’s goal</h4>{goalProgress&&<span>{goalProgress.percent}%</span>}</div>
      {goalProgress?<><div className={styles.goalNumbers}><strong>{goalProgress.completed}<span> / {goalProgress.target}</span></strong><span>{goalProgress.label}</span></div><div className={styles.goalTrack} role="progressbar" aria-label={`${name}’s weekly goal`} aria-valuemin={0} aria-valuemax={goalProgress.target} aria-valuenow={goalProgress.completed} aria-valuetext={activity.goal}><span style={{width:`${goalProgress.completed/goalProgress.target*100}%`}}/>{goalProgress.target<=12&&<div className={styles.goalTicks} aria-hidden="true">{Array.from({length:goalProgress.target},(_,index)=><span key={index}/>)}</div>}</div><p className={styles.goalCaption}>{goalProgress.completed===goalProgress.target?'Goal complete. A moment worth celebrating.':`${goalProgress.target-goalProgress.completed} more to reach this goal`}</p></>:<p>{activity.goal}</p>}
     </div>}
     {activity.highlights.length>0&&<ul className={styles.highlights}>{activity.highlights.map((highlight:string,index:number)=>{
      const count=highlight.match(/^([A-Za-z]+) (\d+) (.+)$/);
      return <li key={index}><span className={styles.highlightMark}>{count?count[2]:<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>}</span><span>{count?`${count[1]} ${count[3]}`:highlight}</span></li>;
     })}</ul>}
     {activity.help&&<div className={styles.help}><h4>Could use a hand with…</h4><p>{activity.help}</p></div>}
     {activityPost.id!==latest.id&&<p className={styles.activityDate}>Activity details shared {date(activityPost.createdAt)}</p>}
    </>}
    {!activity.highlights.length&&<ul className={styles.recentPosts}>{updates.slice(0,3).map(post=><li key={post.id}><button type="button" onClick={()=>openPost(post)}>{post.content.title}</button><time dateTime={post.createdAt}>{date(post.createdAt)}</time></li>)}</ul>}
    <div className={styles.activityActions}><button type="button" onClick={()=>openPost(latest)}>{linkedMember?.self?'Open your update':`Cheer ${name} on`}</button>{activity.help&&activityPost&&!linkedMember?.self&&<button type="button" onClick={()=>openPost(activityPost)}>Offer to help</button>}</div>
    <p className={styles.activityFootnote}>Opens the shared thread. Your reply stays a draft until you share it.</p>
   </>:<div className={styles.activityEmpty}><p>No recent shared updates.</p><p>{linkedMember?`${name}’s updates will appear here when they choose to share.`:'This companion has no linked Circle member.'}</p></div>}
   {linkedMember&&<button type="button" className={styles.allUpdates} onClick={()=>{selectPerson(linkedMember.id);closeActivity();}}>See {name}’s shared updates <span aria-hidden="true">→</span></button>}
  </section>}
  </div>
  <div className={styles.caption}><p>{demo?'Fictional clubhouse · Example activity, not live account data.':'Companion movement is decorative. Activity cards show only updates members have shared.'} <span>Tap a companion to see their person’s recent activity.</span></p>{selected&&<button type="button" onClick={()=>selectPerson('')}>Show everyone</button>}</div>
 </section>;
}
