'use client';
import {useEffect,useState} from 'react';
import type {Circle,Detail,Request} from '../_lib/types';
import {companionForMember} from './companions';
import styles from './circle-list.module.css';

type Props={circle:Circle;request:Request;demo:boolean;busy:boolean;open:()=>void;manage:()=>void};
export default function CircleListItem({circle,request,demo,busy,open,manage}:Props){
 const [members,setMembers]=useState<Detail['members']>([]);
 const [state,setState]=useState<'loading'|'ready'|'error'>('loading');
 useEffect(()=>{
  let current=true;setMembers([]);setState('loading');
  request<Detail>('circles.read',{circleId:circle.id}).then(result=>{
   if(!current)return;
   setMembers(result.members);setState('ready');
  }).catch(()=>{if(current)setState('error');});
  return()=>{current=false;};
 },[circle.id,request]);
 const name=circle.name.replace(' (demo)','');
 return <li className={styles.circle}>
  <img className={styles.banner} src="/circles/cloud-cottage.webp" alt="" width="1536" height="1024"/>
  <div className={styles.details}>
   <div className={styles.heading}><div><h3>{name}</h3><p>Private Circle · {circle.owner?'Owner':'Member'}</p></div><div className={styles.actions}><button type="button" className={styles.open} disabled={busy} aria-label={`Open ${name}`} title="Open Circle" onClick={open}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 4h5v16h-5M3 12h12m-5-5 5 5-5 5"/></svg></button><button type="button" disabled={busy} aria-label={`Manage ${name}`} title="Circle settings" onClick={manage}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m10 3-.5 2a7 7 0 0 0-2 1L5.5 5.5l-2 3.5L5 10.5a7 7 0 0 0 0 3L3.5 15l2 3.5L7.5 18a7 7 0 0 0 2 1L10 21h4l.5-2a7 7 0 0 0 2-1l2 .5 2-3.5-1.5-1.5a7 7 0 0 0 0-3L20.5 9l-2-3.5-2 .5a7 7 0 0 0-2-1L14 3h-4Z"/><circle cx="12" cy="12" r="3"/></svg></button></div></div>
   <div className={styles.members}>
    {state==='ready'?<><ul aria-label={`Members of ${name}`} className={styles.avatars}>{members.slice(0,5).map(member=><li key={member.id} title={member.alias.replace(' (demo)','')}><span className={styles.avatar} aria-hidden="true">{demo?<span style={{backgroundImage:`url('/circles/${companionForMember(member.alias).id}.webp')`}}/>:member.alias.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('')}</span><span className="sr-only">{member.alias.replace(' (demo)','')}</span></li>)}</ul><p>{members.length} {members.length===1?'member':'members'} · Private Circle</p></>:<p role="status">{state==='loading'?'Loading members…':'Members could not be loaded. Open the Circle to try again.'}</p>}

   </div>
  </div>
 </li>;
}
