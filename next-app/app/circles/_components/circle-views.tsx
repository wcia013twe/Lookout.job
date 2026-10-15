'use client';

import {useState, type CSSProperties, type ReactNode} from 'react';
import type {Detail, Post} from '../_lib/types';
import styles from './circle-views.module.css';
import CircleRoom from './circle-room';

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
 const action=post.content.type==='resource'?'View resource':post.content.type==='opportunity'?'View opportunity':post.content.type==='milestone'?'Celebrate':'Read more';
 const at=new Date(post.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'});
 return <button type="button" className={styles.event} onClick={()=>openPost(post)}><Avatar name={post.author} demo={demo}/><span className={styles.eventCopy}><span className={styles.eventMeta}>{post.author.replace(' (demo)','')} · <time dateTime={post.createdAt}>{at}</time></span><strong>{post.content.title}</strong><span className={styles.excerpt}>{post.content.body}</span><span className={styles.eventAction}>{action} <Arrow/></span></span></button>;
}

export default function CircleDashboard({detail,posts,demo,openPost,focused,controls,search,searching}:Props) {
 const [person,setPerson]=useState('');
 const published=posts.filter(post=>post.state==='published'&&post.revision===post.publishedRevision);
 const selected=detail.members.find(member=>member.id===person);
 const visible=selected&&!searching?published.filter(post=>post.author===selected.alias):published;
 const featured=searching?undefined:visible.find(post=>post.content.type==='milestone');
 const activity=visible.filter(post=>post.id!==featured?.id);
 const callout=featured&&/^(offer|offer received|offer accepted)$/i.test(featured.content.stage||'')?'Offered!':featured?.content.stage||'A new milestone!';
 const title=detail.circle.name.replace(' (demo)','');
 return <section className={styles.circle} aria-label={`${title} Circle`}>
  <header className={styles.identity}>
   <div className={styles.emblem}><CircleEmblem/></div>
   <div className={styles.identityCopy}><div className={styles.titleRow}><h1>{title}</h1>{controls}</div><div className={styles.memberLine}><span className={styles.avatarStack}>{detail.members.slice(0,5).map(member=><Avatar key={member.id} name={member.alias} demo={demo}/>)}</span><span>{detail.members.length} people in your corner · Private Circle</span></div></div>
  </header>
  {!focused&&<>
   <CircleRoom key={detail.circle.id} detail={detail} posts={published} demo={demo} person={person} selectPerson={setPerson}/>
   <div className={styles.search}>{search}</div>
   <div className={styles.dashboard}>
    <div className={styles.mainColumn}>
     <div className={styles.streamHeading}><h2>{searching?'Search results':selected?selected.alias.replace(' (demo)','')+'’s updates':'Around the Circle'}</h2>{selected&&!searching&&<button type="button" onClick={()=>setPerson('')}>Show everyone</button>}</div>
     {featured&&<article className={styles.celebration}>
      <div className={styles.celebrationPortrait}><Avatar name={featured.author} demo={demo} large/></div>
      <div className={styles.celebrationCopy}><h3 className={styles.offerCallout}><svg viewBox="0 0 72 44" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M67 5C48 0 51 37 6 31M15 23 5 31l11 6"/></svg>{callout}</h3><p className={styles.celebrationName}>{featured.author.replace(' (demo)','')}</p>{featured.content.company&&<p className={styles.company}>{featured.content.company}</p>}<button className={styles.primary} type="button" onClick={()=>openPost(featured)}>Celebrate <Arrow/></button></div>
     </article>}
     <section aria-label="Circle activity">{activity.length?activity.map(post=><EventLink key={post.id} post={post} openPost={openPost} demo={demo}/>):!featured&&<p className={styles.empty}>{searching?'No matching posts. Try another search.':selected?'No shared updates yet.':'It’s quiet here. New updates will appear when someone shares.'}</p>}</section>
    </div>

   </div>
  </>}
 </section>;
}
