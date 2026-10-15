'use client';

import {useState, type CSSProperties, type ReactNode} from 'react';
import type {Detail, Post} from '../_lib/types';
import {types} from '../_lib/types';
import styles from './circle-views.module.css';

type Props = {detail:Detail; posts:Post[]; demo:boolean; openPost:(post:Post)=>void; focused:boolean; controls:ReactNode; search:ReactNode; searching:boolean};
const portraitNames = ['Maya','Sam','Alex','Jordan','Priya','Taylor'];

export function CircleEmblem() {
 return <svg viewBox="0 0 100 100" fill="none" aria-hidden="true"><path d="M50 5 89 19v31c0 21-16 36-39 45C27 86 11 71 11 50V19L50 5Z" fill="currentColor" fillOpacity=".08" stroke="currentColor" strokeWidth="2"/><path d="m22 65 22-30 12 17 8-10 16 23H22Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="m36 46 8 3 5-6m10 7 5 4 5-5" stroke="currentColor" strokeWidth="1.5"/></svg>;
}

function Avatar({name,demo,large=false}:{name:string;demo:boolean;large?:boolean}) {
 const index=demo?portraitNames.findIndex(person=>name.startsWith(person)):-1;
 const style=index>=0?{'--portrait-x':`${(index%3)*50}%`,'--portrait-y':`${Math.floor(index/3)*100}%`} as CSSProperties:undefined;
 return <span className={`${styles.avatar} ${large?styles.avatarLarge:''} ${index>=0?styles.portrait:''}`} style={style} aria-hidden="true">{index<0?name.split(/\s+/).slice(0,2).map(part=>part[0]).join(''):null}</span>;
}

function Arrow() {
 return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg>;
}

function EventLink({post,openPost,demo}:{post:Post;openPost:(post:Post)=>void;demo:boolean}) {
 return <button type="button" className={styles.event} onClick={()=>openPost(post)}><Avatar name={post.author} demo={demo}/><span className={styles.eventCopy}><span className={styles.eventMeta}>{post.author.replace(' (demo)','')} · {types[post.content.type]}</span><strong>{post.content.title}</strong><span className={styles.excerpt}>{post.content.body}</span></span><Arrow/></button>;
}

export default function CircleDashboard({detail,posts,demo,openPost,focused,controls,search,searching}:Props) {
 const [person,setPerson]=useState('');
 const published=posts.filter(post=>post.state==='published'&&post.revision===post.publishedRevision);
 const milestones=published.filter(post=>post.content.type==='milestone');
 const resources=published.filter(post=>post.content.type==='resource'||post.content.type==='interview_report');
 const opportunity=published.find(post=>post.content.type==='opportunity');
 const featured=milestones[0];
 const selected=detail.members.find(member=>member.id===person);
 const selectedPosts=selected?published.filter(post=>post.author===selected.alias):[];
 const title=detail.circle.name.replace(' (demo)','');
 return <section className={styles.circle} aria-label={`${title} Circle`}>
  <header className={styles.identity}>
   <div className={styles.emblem}><CircleEmblem/></div>
   <div className={styles.identityCopy}><div className={styles.titleRow}><h1>{title}</h1>{controls}</div><p>Different paths. A brighter next chapter — together.</p><div className={styles.memberLine}><span className={styles.avatarStack}>{detail.members.slice(0,5).map(member=><Avatar key={member.id} name={member.alias} demo={demo}/>)}</span><span>{detail.members.length} people in your corner · Private Circle</span></div></div>
  </header>
  {!focused&&<>
   <div className={styles.search}>{search}</div>
   {searching?<section aria-label="Search results">{published.length?published.map(post=><EventLink key={post.id} post={post} openPost={openPost} demo={demo}/>):<p className={styles.empty}>No matching shared posts. Try another search or fewer filters.</p>}</section>:<div className={styles.dashboard}>
    <div className={styles.mainColumn}>
     <section aria-labelledby="circle-moments-title">
      <div className={styles.sectionHeading}><h2 id="circle-moments-title">Good things are happening.</h2><p>One person’s win. Everyone’s momentum.</p></div>
      {featured?<article className={styles.celebration}><div className={styles.celebrationPortrait}><Avatar name={featured.author} demo={demo} large/><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1c1.5 6 5 9.5 11 11-6 1.5-9.5 5-11 11C10.5 17 7 13.5 1 12 7 10.5 10.5 7 12 1Z" fill="currentColor"/></svg></div><div><span className={styles.milestoneLabel}>{featured.content.stage||'Shared milestone'}</span><h3>{featured.content.title}</h3><p className={styles.company}>{featured.content.company}</p><blockquote className={styles.handwritten}>{featured.content.body}</blockquote><button className={styles.primary} type="button" onClick={()=>openPost(featured)}>Celebrate with {featured.author.split(' ')[0]} <Arrow/></button></div></article>:<p className={styles.empty}>There’s room for the next good moment, whenever someone is ready to share it.</p>}
      {milestones.length>1&&<div className={styles.momentStrip}>{milestones.slice(1,4).map(post=><button type="button" key={post.id} onClick={()=>openPost(post)}><Avatar name={post.author} demo={demo}/><span><strong>{post.author.split(' ')[0]}</strong><span>{post.content.stage||post.content.title}</span></span><Arrow/></button>)}</div>}
     </section>
     {opportunity&&<section className={styles.opportunity}><span className={styles.label}>Shared opportunity</span><h2>{opportunity.content.title}</h2><p>{opportunity.content.body}</p><button className={styles.primary} type="button" onClick={()=>openPost(opportunity)}>Explore the opportunity <Arrow/></button></section>}
     <section className={styles.resources} aria-labelledby="circle-resources-title"><div className={styles.sectionHeading}><h2 id="circle-resources-title">What’s helping us prepare</h2></div>{resources.length?resources.map(post=><EventLink key={post.id} post={post} openPost={openPost} demo={demo}/>):<p className={styles.empty}>Shared tips and useful resources will appear here.</p>}</section>
    </div>
    <aside className={styles.sideColumn}>
     <section className={styles.people} aria-labelledby="circle-people-title"><h2 id="circle-people-title">Your people</h2><div className={[styles.constellation,detail.members.length>8?styles.peopleGrid:''].join(' ')}><div className={styles.orbit} aria-hidden="true"/><div className={styles.centerEmblem} aria-hidden="true"><CircleEmblem/></div><div className={styles.peopleNodes}>{detail.members.map((member,index)=>{const angle=(index/Math.max(detail.members.length,1))*Math.PI*2-Math.PI/2;const position={'--node-x':`${50+Math.cos(angle)*35}%`,'--node-y':`${50+Math.sin(angle)*35}%`} as CSSProperties;return <button type="button" className={styles.personNode} style={position} key={member.id} aria-pressed={selected?.id===member.id} onClick={()=>setPerson(person===member.id?'':member.id)}><Avatar name={member.alias} demo={demo}/><strong>{member.alias.replace(' (demo)','')}</strong></button>;})}</div></div>{selected&&<div className={styles.personDetail}><div className={styles.personHeading}><h3>{selected.alias.replace(' (demo)','')}</h3><button type="button" onClick={()=>setPerson('')}>Show everyone</button></div>{selectedPosts.length?selectedPosts.map(post=><EventLink key={post.id} post={post} openPost={openPost} demo={demo}/>):<p className={styles.empty}>No shared updates yet.</p>}</div>}<p className={styles.handwritten}>Same ambition.<br/>Kinder company.</p></section>
     {!selected&&<section className={styles.latest}><h2>Around the Circle</h2>{published.length?published.slice(0,4).map(post=><EventLink key={post.id} post={post} openPost={openPost} demo={demo}/>):<p className={styles.empty}>It’s quiet here. New shared updates will appear when someone has something to share.</p>}</section>}
    </aside>
   </div>}
  </>}
 </section>;
}
