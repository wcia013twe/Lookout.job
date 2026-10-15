'use client';

import {useState, type CSSProperties, type ReactNode} from 'react';
import type {Detail, Post} from '../_lib/types';
import styles from './circle-views.module.css';
import CircleRoom from './circle-room';

type Props = {detail:Detail; posts:Post[]; demo:boolean; openPost:(post:Post)=>void; focused:boolean; controls:ReactNode; search:ReactNode; searching:boolean};
const portraitNames = ['Maya','Sam','Alex','Jordan','Priya','Wesley'];
const characterNames = ['Wesley','Maya','Sam','Alex','Jordan','Priya'];
const cleanName=(name:string)=>name.replace(' (demo)','');
const postKind=(post:Post)=>post.content.type==='milestone'?'Milestone':post.content.type==='resource'?'Resource':post.content.type==='opportunity'?'Opportunity':'Conversation';

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

function RoomPortrait({name,demo,full=false}:{name:string;demo:boolean;full?:boolean}) {
 const index=demo?characterNames.findIndex(person=>name.startsWith(person)):-1;
 if(index<0)return <Avatar name={name} demo={false}/>;
 return <span className={full?styles.characterFigure:styles.roomPortrait} aria-hidden="true"><span style={{'--character-x':`${index%3*50}%`,'--character-y':`${Math.floor(index/3)*100}%`} as CSSProperties}/></span>;
}

function EventLink({post,openPost,demo}:{post:Post;openPost:(post:Post)=>void;demo:boolean}) {
 const action=post.content.type==='resource'?'Open resource':post.content.type==='opportunity'?'Explore opportunity':post.content.type==='milestone'?'Celebrate together':'Read the conversation';
 const at=new Date(post.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'});
 return <article className={styles.event}>
  <div className={styles.authorPortrait}><RoomPortrait name={post.author} demo={demo}/></div>
  <div className={styles.note}><div className={styles.noteMeta}><strong>{cleanName(post.author)}</strong><span>{postKind(post)}</span><time dateTime={post.createdAt}>{at}</time></div>
   <button type="button" className={styles.noteLink} onClick={()=>openPost(post)}><h3>{post.content.title}</h3><p>{post.content.body||post.content.insight}</p><span className={styles.eventAction}>{!post.content.body?'View context':action}<Arrow/></span></button>
  </div>
 </article>;
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
   <section className={styles.noticeboard} aria-labelledby="community-feed-title">
    <header className={styles.boardHeading}><div className={styles.boardIntro}><h2 id="community-feed-title">Around the Circle</h2><p>The good news, useful finds, and little things worth sharing.</p><p className={styles.constellationHint}>Choose someone here or in the room to see what they’ve shared.</p></div>
     <nav className={styles.constellation} data-grid={detail.members.length>8} aria-label="Filter shared updates by person"><span className={styles.orbit} aria-hidden="true"/><button type="button" className={styles.everyone} aria-pressed={!selected} onClick={()=>setPerson('')}><CircleEmblem/><span>Everyone</span></button>{detail.members.map((member,index)=>{const angle=index/Math.max(detail.members.length,1)*Math.PI*2-Math.PI/2;return <button type="button" className={styles.personNode} key={member.id} style={{'--node-x':`${50+Math.cos(angle)*36}%`,'--node-y':`${50+Math.sin(angle)*36}%`} as CSSProperties} aria-pressed={selected?.id===member.id} onClick={()=>setPerson(person===member.id?'':member.id)}><RoomPortrait name={member.alias} demo={demo}/><span>{cleanName(member.alias)}</span></button>;})}</nav>
    </header>
    <div className={styles.boardBody}>
     <div className={styles.boardTools}><div className={styles.streamHeading}><h3>{searching?'Search results':selected?cleanName(selected.alias)+'’s updates':'On the board'}</h3>{selected&&!searching&&<button type="button" onClick={()=>setPerson('')}>Show everyone</button>}</div><details key={searching?'results':'browse'} className={styles.search} open={searching||undefined}><summary>Find a shared update <Arrow/></summary><div>{search}</div></details></div>
     <div className={styles.boardContent}>
      {featured&&<article className={styles.celebration}>
       <div className={styles.celebrationFigure}><RoomPortrait name={featured.author} demo={demo} full/></div>
       <div className={styles.celebrationCopy}><div className={styles.celebrationMeta}><span>{cleanName(featured.author)} shared a milestone</span><span className={styles.pin} aria-hidden="true"/></div><h3>{callout}</h3><h4>{featured.content.title}</h4><p>{featured.content.body||featured.content.insight}</p>{featured.content.company&&<span className={styles.company}>{featured.content.company}</span>}<button className={styles.primary} type="button" onClick={()=>openPost(featured)}>Celebrate with {cleanName(featured.author).split(' ')[0]} <Arrow/></button></div>
      </article>}
      <div className={styles.posts} aria-label="Shared Circle updates">{activity.length?activity.map(post=><EventLink key={post.id} post={post} openPost={openPost} demo={demo}/>):!featured&&<div className={styles.empty}><CircleEmblem/><h3>{searching?'Nothing on the board matches yet.':selected?'A little quiet in this corner.':'The board is ready for your first story.'}</h3><p>{searching?'Try a different search or clear your filters.':selected?'Their shared updates will appear here.':'Use Share above to add a milestone, resource, or opportunity for your people.'}</p></div>}</div>
     </div>
    </div>
    <footer className={styles.boardFooter}><span>Shared with your Circle, by choice.</span><span>Different paths. Same corner.</span></footer>
   </section>
  </>}
 </section>;
}
