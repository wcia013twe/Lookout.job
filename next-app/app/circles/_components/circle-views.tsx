'use client';

import {useState, type CSSProperties} from 'react';
import type {Detail, Post} from '../_lib/types';
import {types} from '../_lib/types';
import styles from './circle-views.module.css';

export type CircleView = 'overview' | 'people' | 'moments';
type Props = {detail:Detail; posts:Post[]; demo:boolean; view:CircleView; changeView:(view:CircleView)=>void; openPost:(post:Post)=>void; focused:boolean};
const views = [{id:'overview',label:'Overview'},{id:'people',label:'People'},{id:'moments',label:'Moments'}] as const;
const portraitNames = ['Maya','Sam','Alex','Jordan','Priya','Taylor'];

export function CircleEmblem() {
 return <svg viewBox="0 0 100 100" fill="none" aria-hidden="true"><path d="M50 5 89 19v31c0 21-16 36-39 45C27 86 11 71 11 50V19L50 5Z" fill="currentColor" fillOpacity=".08" stroke="currentColor" strokeWidth="2"/><path d="m22 65 22-30 12 17 8-10 16 23H22Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="m36 46 8 3 5-6m10 7 5 4 5-5" stroke="currentColor" strokeWidth="1.5"/></svg>;
}

function Avatar({name,demo,large=false}:{name:string;demo:boolean;large?:boolean}) {
 const index=demo?portraitNames.findIndex(person=>name.startsWith(person)):-1;
 const style=index>=0?{'--portrait-x':`${(index%3)*50}%`,'--portrait-y':`${Math.floor(index/3)*100}%`} as CSSProperties:undefined;
 return <span className={`${styles.avatar} ${large?styles.avatarLarge:''} ${index>=0?styles.portrait:''}`} style={style} aria-hidden="true">{index<0?name.split(/\s+/).slice(0,2).map(part=>part[0]).join(''):null}</span>;
}

function EventLink({post,openPost,demo,compact=false}:{post:Post;openPost:(post:Post)=>void;demo:boolean;compact?:boolean}) {
 return <button type="button" className={`${styles.event} ${compact?styles.compactEvent:''}`} onClick={()=>openPost(post)}><Avatar name={post.author} demo={demo}/><span className={styles.eventCopy}><span className={styles.eventMeta}>{post.author.replace(' (demo)','')} · {types[post.content.type]}</span><strong>{post.content.title}</strong>{!compact&&<span className={styles.excerpt}>{post.content.body}</span>}{post.content.company&&<span className={styles.eventMeta}>{post.content.company}</span>}</span><span className={styles.arrow} aria-hidden="true">↗</span></button>;
}

export default function CircleViews({detail,posts,demo,view,changeView,openPost,focused}:Props) {
 const [person,setPerson]=useState('');
 const published=posts.filter(post=>post.state==='published'&&post.revision===post.publishedRevision);
 const milestones=published.filter(post=>post.content.type==='milestone');
 const resources=published.filter(post=>post.content.type==='resource'||post.content.type==='interview_report');
 const opportunity=published.find(post=>post.content.type==='opportunity');
 const featured=milestones[0];
 const selected=detail.members.find(member=>member.id===person)||detail.members.find(member=>published.some(post=>post.author===member.alias))||detail.members[0];
 const personPosts=selected?published.filter(post=>post.author===selected.alias):[];
 const title=detail.circle.name.replace(' (demo)','');
 return <section className={styles.circle} aria-label={`${title} Circle`}>
  <header className={styles.identity}>
   <div className={styles.emblem}><CircleEmblem/></div><div className={styles.identityCopy}><h1>{title}</h1><p>Different paths. A brighter next chapter — together.</p><div className={styles.memberLine}><span className={styles.avatarStack}>{detail.members.slice(0,5).map(member=><Avatar key={member.id} name={member.alias} demo={demo}/>)}</span><span>{detail.members.length} people in your corner · Private Circle</span></div></div><p className={styles.handwritten}>Good people.<br/>Brighter possibilities.</p>
  </header>
  <div className={styles.navigation}><nav aria-label="Circle views">{views.map(item=><button type="button" key={item.id} aria-current={view===item.id?'page':undefined} onClick={()=>changeView(item.id)}>{item.label}</button>)}</nav></div>
  {!focused&&<>
   {view==='overview'&&<div className={styles.overview}>
    <div className={styles.mainColumn}><section><div className={styles.sectionHeading}><h2>A little help for your next step.</h2><p>Good opportunities. Shared experience. People who get it.</p></div>{opportunity?<article className={styles.opportunity}><div className={styles.opportunityArt} aria-hidden="true"><CircleEmblem/></div><div><span className={styles.label}>Shared opportunity</span><h3>{opportunity.content.title}</h3><p>{opportunity.content.body}</p><button type="button" className={styles.primary} onClick={()=>openPost(opportunity)}>Explore the opportunity <span aria-hidden="true">↗</span></button></div></article>:<div className={styles.empty}>A good opportunity travels further when a friend shares it. Shared roles will appear here.</div>}</section>
     <section className={styles.resources}><div className={styles.sectionHeading}><h2>What’s helping us prepare</h2><p>Firsthand experience, useful sources, and things worth passing on.</p></div>{resources.length?resources.slice(0,3).map(post=><EventLink key={post.id} post={post} openPost={openPost} demo={demo}/>):<p className={styles.empty}>No shared preparation resources yet. There’s no posting schedule to keep up with.</p>}</section>
    </div>
    <aside className={styles.sideColumn}><section className={styles.latest}><h2>Around the Circle</h2>{published.length?published.slice(0,4).map(post=><EventLink key={post.id} post={post} openPost={openPost} demo={demo} compact/>):<p className={styles.empty}>It’s quiet here. Useful updates will appear when someone chooses to share.</p>}<button type="button" className={styles.textButton} onClick={()=>changeView('moments')}>See the moments <span aria-hidden="true">→</span></button></section><div className={styles.supportNote}><p className={styles.handwritten}>One person’s win.<br/>Everyone’s momentum.</p></div></aside>
   </div>}
   {view==='people'&&<><div className={styles.sectionHeading}><h2>Your crew, moving forward.</h2><p>Select a friend to explore what they chose to share.</p></div><div className={styles.peopleLayout}><div className={styles.constellation}><div className={styles.orbit} aria-hidden="true"/><div className={styles.centerEmblem}><CircleEmblem/><strong>{title}</strong><span>People. Support. Possibilities.</span></div><div className={styles.peopleNodes}>{detail.members.map((member,index)=>{const angle=(index/Math.max(detail.members.length,1))*Math.PI*2-Math.PI/2;const position={'--node-x':`${50+Math.cos(angle)*35}%`,'--node-y':`${50+Math.sin(angle)*35}%`} as CSSProperties;const recent=published.find(post=>post.author===member.alias);return <button type="button" className={styles.personNode} style={position} key={member.id} aria-pressed={selected?.id===member.id} onClick={()=>setPerson(member.id)}><Avatar name={member.alias} demo={demo} large/><strong>{member.alias.replace(' (demo)','')}</strong><span>{recent?recent.content.stage||types[recent.content.type]:'Nothing shared yet'}</span></button>;})}</div><p className={`${styles.handwritten} ${styles.orbitNote}`}>Same ambition.<br/>Kinder company.</p></div><aside className={styles.personDetail}><div className={styles.personHeader}>{selected&&<Avatar name={selected.alias} demo={demo} large/>}<h3>{selected?.alias.replace(' (demo)','')||'Your people'}</h3><p>Only what they chose to share.</p></div>{personPosts.length?personPosts.map(post=><EventLink key={post.id} post={post} openPost={openPost} demo={demo}/>):<p className={styles.empty}>No published updates from this person yet. Their private progress stays private.</p>}</aside></div></>}
   {view==='moments'&&<><div className={styles.sectionHeading}><h2>Good things are happening.</h2><p>Different paths. Real progress. A common forward.</p></div><div className={styles.momentsLayout}>{featured?<article className={styles.celebration}><div className={styles.laurel}><Avatar name={featured.author} demo={demo} large/><span aria-hidden="true">✧</span></div><div className={styles.celebrationCopy}><span className={styles.milestoneLabel}>{featured.content.stage||'Shared milestone'}</span><h3>{featured.content.title}</h3><p>{featured.content.company}</p><blockquote className={styles.handwritten}>{featured.content.body}</blockquote><button className={styles.primary} type="button" onClick={()=>openPost(featured)}>Celebrate with {featured.author.split(' ')[0]} <span aria-hidden="true">→</span></button></div></article>:<div className={styles.empty}><h3>The next chapter takes its own time.</h3><p>When someone chooses to share a milestone, we’ll make room for it here.</p></div>}<aside className={styles.latest}><h3>More moments, same people</h3>{milestones.slice(1).map(post=><EventLink key={post.id} post={post} openPost={openPost} demo={demo}/>)}{resources.slice(0,2).map(post=><EventLink key={post.id} post={post} openPost={openPost} demo={demo} compact/>)}<p className={styles.handwritten}>Further together.</p></aside></div><div className={styles.sharedWins}><h3>Shared moments</h3><div>{milestones.map(post=><button key={post.id} type="button" onClick={()=>openPost(post)}><Avatar name={post.author} demo={demo}/><span><strong>{post.author.split(' ')[0]}</strong><span>{post.content.stage||post.content.title}</span></span></button>)}</div></div></>}
  </>}
 </section>;
}
