'use client';

import {useState, useRef, type CSSProperties} from 'react';
import type {Detail, Post} from '../_lib/types';
import styles from './circle-room.module.css';
import {routines} from './room-motion';
import {useRoomMotion} from './use-room-motion';

type Props = {detail:Detail; posts:Post[]; demo:boolean; person:string; selectPerson:(id:string)=>void};
const sessionMembers = ['demo-peer','demo-sam','demo-alex','demo-jordan','demo-priya','demo-self'];
const sessions = [
 {action:'Celebrating an offer',detail:'A new chapter at Example Labs',value:null},
 {action:'Practicing interviews',detail:'2 of 3 practice prompts',value:67},
 {action:'Preparing for a final round',detail:'1 of 2 topics reviewed',value:50},
 {action:'Taking a coffee break',detail:'A little room to recharge',value:null},
 {action:'Exploring opportunities',detail:'3 of 5 roles reviewed',value:60},
 {action:'Applying',detail:'2 of 3 session tasks',value:67},
];
const nameOf=(alias:string)=>alias.replace(' (demo)','');
function sharedActivity(post:Post|undefined) {
 if(!post)return {action:'No shared activity',detail:'Activity stays private until shared',value:null};
 return {action:post.content.type==='milestone'?`Shared: ${post.content.stage||'a milestone'}`:post.content.type==='resource'?'Shared a preparation resource':post.content.type==='opportunity'?'Shared an opportunity':'Shared an update',detail:post.content.title,value:null};
}

export default function CircleRoom({detail,posts,demo,person,selectPerson}:Props) {
 const [paused,setPaused]=useState(false);
 const [ambience,setAmbience]=useState('rain');
 const [page,setPage]=useState(0);
 const members=detail.members;
 const pageCount=Math.max(1,Math.ceil(members.length/6));
 const currentPage=Math.min(page,pageCount-1);
 const visible=members.slice(currentPage*6,currentPage*6+6);
 const selected=members.find(member=>member.id===person);
 const roomRef=useRef<HTMLDivElement>(null);
 useRoomMotion(roomRef,paused,visible.map(member=>member.id).join('|'));
 return <section className={styles.roomSection} aria-labelledby="circle-room-title">
  <div className={styles.toolbar}>
   <div><h2 id="circle-room-title">The clubhouse</h2></div>
   <div className={styles.controls}>
    <label className={styles.ambience}><span className={styles.srOnly}>Room ambience</span><select value={ambience} onChange={event=>setAmbience(event.target.value)}><option value="rain">Rainy evening</option><option value="warm">Lamplight</option></select></label>
    <button type="button" aria-pressed={paused} onClick={()=>setPaused(!paused)}>{paused?'Resume motion':'Pause motion'}</button>
   </div>
  </div>
  <div className={styles.viewport}>
   <div ref={roomRef} className={styles.room} data-paused={paused} data-ambience={ambience}>
    <div className={styles.backdrop} role="img" aria-label="Cozy clubhouse with rainy arched windows, warm study desks, a practice whiteboard, and a green sofa"/>
    <div className={styles.roomPlaque}><span className={styles.lamp}/><span>The clubhouse</span><span className={styles.plaqueNote}>{demo?'Fictional sessions':'Shared updates'}</span></div>
    {visible.map((member,index)=>{
     const sessionIndex=sessionMembers.indexOf(member.id);
     const activity=demo&&sessionIndex>=0?sessions[sessionIndex]:sharedActivity(posts.find(post=>post.author===member.alias));
     const name=nameOf(member.alias);
     const routineIndex=demo&&sessionIndex>=0?sessionIndex:index;
     const routine=routines[routineIndex],sprite=routine.sprite;
     const style={'--move-x':`${routine.station.x}cqw`,'--move-y':`${routine.station.y*2/3}cqw`,'--sprite-x':`${sprite%3*50}%`,'--sprite-y':`${Math.floor(sprite/3)*100}%`,'--walk-x':`${sprite*20}%`} as CSSProperties;
     return <button key={member.id} type="button" className={styles.character} style={style} data-routine={routineIndex} data-task={routine.task} data-mode="working" aria-pressed={person===member.id} onClick={()=>selectPerson(person===member.id?'':member.id)} aria-label={`${name}: ${activity.action}. ${activity.detail}. ${person===member.id?'Show everyone':'Show shared updates'}`}>
      <span className={styles.bubble}><strong>{name}{member.self&&<small>you</small>}</strong><span className={styles.activity}>{activity.action}</span><span className={styles.journey} data-journey/>{activity.value!==null&&<span className={styles.progress} role="progressbar" aria-label={`${name}'s fictional session tasks`} aria-valuenow={activity.value} aria-valuemin={0} aria-valuemax={100}><span style={{width:`${activity.value}%`}}/></span>}<span className={styles.sessionDetail}>{activity.detail}</span></span>
      <span className={styles.sprite} aria-hidden="true"><span className={styles.walkFrame}/></span><span className={styles.shadow} aria-hidden="true"/>
     </button>;
    })}
    {!members.length&&<div className={styles.empty}>The lights are on.<br/>Your people will make it home.<p>Invite friends from Circle settings.</p></div>}
   </div>
  </div>
  <div className={styles.caption}><p>{demo?'Fictional activity · Example progress, not live account activity.':'Illustrated avatars · Room movement is decorative, not online presence.'} <span>Choose a character to see their shared updates.</span></p>{selected&&<button type="button" onClick={()=>selectPerson('')}>Show everyone</button>}{pageCount>1&&<div className={styles.pagination}><button type="button" disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>Previous people</button><span>{currentPage+1} / {pageCount}</span><button type="button" disabled={currentPage===pageCount-1} onClick={()=>setPage(currentPage+1)}>More people</button></div>}</div>
 </section>;
}
