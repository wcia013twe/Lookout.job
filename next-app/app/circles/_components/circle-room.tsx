'use client';

import {useEffect, useState, useRef, type CSSProperties} from 'react';
import type {Detail, Post} from '../_lib/types';
import styles from './circle-room.module.css';
import {routines} from './room-motion';
import {companions} from './companions';
import {useRoomMotion} from './use-room-motion';

type Props = {detail:Detail; posts:Post[]; demo:boolean; person:string; selectPerson:(id:string)=>void};
export default function CircleRoom({detail,demo,person,selectPerson}:Props) {
 const [paused,setPaused]=useState(false);
 const [ambience,setAmbience]=useState('moon');
 const [gathered,setGathered]=useState(false);
 const [selectedCompanion,setSelectedCompanion]=useState<string|null>(null);
 const [greeting,setGreeting]=useState<{id:string;at:number}|null>(null);
 const roomRef=useRef<HTMLDivElement>(null);
 useRoomMotion(roomRef,paused,'companions',gathered);
 useEffect(()=>{if(!greeting)return;const timer=setTimeout(()=>setGreeting(null),4500);return()=>clearTimeout(timer);},[greeting]);
 const selected=detail.members.find(member=>member.id===person);
 const greeted=companions.find(companion=>companion.id===selectedCompanion);
 const linkedMember=demo&&greeted?detail.members.find(member=>member.id===greeted.member):undefined;
 return <section className={styles.roomSection} aria-labelledby="circle-room-title">
  <div className={styles.toolbar}>
   <div><h2 id="circle-room-title">The cloud cottage</h2><p>Five little companions. A whole lot of company.</p></div>
   <div className={styles.controls}>
    <label><span className={styles.srOnly}>Room ambience</span><select value={ambience} onChange={event=>setAmbience(event.target.value)}><option value="moon">Moonlight</option><option value="warm">Starlight lamps</option></select></label>
    <button type="button" aria-pressed={gathered} onClick={()=>setGathered(!gathered)}>{gathered?'Back to stations':'Gather on the rug'}</button>
    <button type="button" aria-pressed={paused} onClick={()=>setPaused(!paused)}>{paused?'Resume motion':'Pause motion'}</button>
   </div>
  </div>
  <div className={styles.viewport}>
   <div ref={roomRef} className={styles.room} data-paused={paused} data-gathered={gathered} data-ambience={ambience}>
    <div className={styles.backdrop} role="img" aria-label="Moonlit cloud cottage with a cloud-shaped window, tiny laptop desk, practice board, book table, star lamps and a lilac beanbag"/>
    <div className={styles.roomPlaque}><span className={styles.lamp}/><span>The cloud cottage</span><span className={styles.plaqueNote}>Companion playground</span></div>
    {companions.map((companion,index)=>{
     const routine=routines[index];
     const reacting=greeting?.id===companion.id;
     const style={'--move-x':`${routine.station.x}cqw`,'--move-y':`${routine.station.y*2/3}cqw`,'--companion-image':`url('/circles/${companion.id}.webp')`} as CSSProperties;
     return <button key={companion.id} type="button" className={styles.character} style={style} data-routine={index} data-task={routine.task} data-mode="working" data-reaction={reacting} aria-pressed={selectedCompanion===companion.id} onClick={()=>{setSelectedCompanion(companion.id);setGreeting({id:companion.id,at:Date.now()});}} aria-label={`Say hello to ${companion.name}`}>
      <span className={styles.bubble}><strong>{companion.name}</strong><span className={styles.activity}>{gathered?'Hanging out together':demo?companion.action:companion.station}</span><span className={styles.journey} data-journey/>{demo&&companion.value!==null&&<span className={styles.progress} role="progressbar" aria-label={`${companion.name}'s fictional session`} aria-valuenow={companion.value} aria-valuemin={0} aria-valuemax={100}><span style={{width:`${companion.value}%`}}/></span>}<span className={styles.sessionDetail}>{demo?companion.detail:'Decorative companion'}</span></span>
      <span className={styles.sprite} aria-hidden="true"/>
      <span className={styles.sparkles} aria-hidden="true"><svg viewBox="0 0 100 90" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 22 3-8 3 8 8 3-8 3-3 8-3-8-8-3 8-3Zm65-9 2-6 2 6 6 2-6 2-2 6-2-6-6-2 6-2Zm7 48 3-8 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z"/></svg></span>
      <span className={styles.musicNotes} aria-hidden="true"><svg viewBox="0 0 60 90" fill="none" stroke="currentColor" strokeWidth="3"><path d="M16 48V21l24-6v27M16 27l24-6"/><ellipse cx="10" cy="49" rx="6" ry="4" fill="currentColor"/><ellipse cx="34" cy="43" rx="6" ry="4" fill="currentColor"/></svg></span>
      <span className={styles.shadow} aria-hidden="true"/>
     </button>;
    })}
   </div>
  </div>
  <div className={styles.greeting} role="status" aria-live="polite"><p>{greeted?greeted.greeting:'Tap a companion to say hello, or invite everyone onto the rug.'}</p>{linkedMember&&<button type="button" onClick={()=>selectPerson(linkedMember.id)}>See {linkedMember.alias.replace(' (demo)','')}’s shared updates</button>}</div>
  <div className={styles.caption}><p>{demo?'Fictional companion sessions · Example progress, not live account activity.':'Decorative companions · Their routines do not indicate live agent or member activity.'} <span>Your people’s shared updates are in the constellation below.</span></p>{selected&&<button type="button" onClick={()=>selectPerson('')}>Show everyone</button>}</div>
 </section>;
}
