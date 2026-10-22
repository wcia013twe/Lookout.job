'use client';

import {useRef,useState,type ReactNode} from 'react';
import type {Content,Detail,Post,Request} from '../_lib/types';
import {types} from '../_lib/types';
import identity from './circle-views.module.css';
import styles from './conversation.module.css';
import CircleRoom from './circle-room';
import CircleChat from './circle-chat';
import CircleFeed from './circle-feed';
import Editor from './editor';
import JobAttachment from './job-attachment';
import SharedAttachments,{hasAttachedJob} from './shared-attachments';
import {companionForMember} from './companions';
import {CompanyLogo} from '../../../components/role-card';

type Props={request:Request;initialChannel?:'clubhouse'|'settings';detail:Detail;posts:Post[];demo:boolean;openPost:(post:Post)=>void;focused:boolean;controls:ReactNode;settings:ReactNode;pagination:ReactNode;search:ReactNode;searching:boolean;busy:boolean;save:(content:Content)=>Promise<void>};
const clean=(name:string)=>name.replace(' (demo)','');
export function CircleEmblem(){return <svg viewBox="0 0 100 100" fill="none" aria-hidden="true"><path d="M50 5 89 19v31c0 21-16 36-39 45C27 86 11 71 11 50V19L50 5Z" fill="currentColor" fillOpacity=".08" stroke="currentColor" strokeWidth="2"/><path d="m22 65 22-30 12 17 8-10 16 23H22Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg>;}
function Icon({kind}:{kind:string}){return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind==='settings'?<><path d="m10 3-.5 2a7 7 0 0 0-2 1L5.5 5.5l-2 3.5L5 10.5a7 7 0 0 0 0 3L3.5 15l2 3.5L7.5 18a7 7 0 0 0 2 1L10 21h4l.5-2a7 7 0 0 0 2-1l2 .5 2-3.5-1.5-1.5a7 7 0 0 0 0-3L20.5 9l-2-3.5-2 .5a7 7 0 0 0-2-1L14 3h-4Z"/><circle cx="12" cy="12" r="3"/></>:kind==='clubhouse'?<><path d="m3 10 9-7 9 7v10H3V10Z"/><path d="M9 20v-7h6v7"/></>:kind==='chat'?<path d="M20 11a8 8 0 0 1-8 8H5l-4 3 2-7a8 8 0 1 1 17-4Z"/>:kind==='round'?<><rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v4m8-4v4M8 12h8m-8 4h5"/></>:kind==='offers'?<><rect x="2" y="6" width="8" height="14" rx="2"/><rect x="14" y="3" width="8" height="17" rx="2"/><path d="M5 10h2m-2 4h2m10-7h2m-2 4h2"/></>:kind==='resource'?<><path d="M12 5c-3-2-7-2-10-1v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Zm0 0v15"/></>:<><path d="M8 12h8m-4-4v8"/><rect x="3" y="3" width="18" height="18" rx="4"/></>}</svg>;}
function Avatar({name,demo}:{name:string;demo:boolean}){return <span className={styles.avatar} aria-hidden="true">{demo?<span style={{backgroundImage:`url('/circles/${companionForMember(name).id}.webp')`}}/>:clean(name).split(/\s+/).slice(0,2).map(x=>x[0]).join('')}</span>;}
export function ContextChips({content}:{content:Content}){
 const hasJob=!hasAttachedJob(content)&&!!(content.company||content.role||content.jobId||content.jobUrl);
 return <>{hasJob&&<JobAttachment content={content}/>}{content.contexts&&<SharedAttachments contexts={content.contexts} primary={content}/>}<div className={styles.chips} aria-label="Other attached context">{!hasJob&&content.stage&&<span className={styles.stage}><Icon kind="round"/>{content.stage}</span>}{content.offers&&<span><Icon kind="offers"/>{content.offers.map(o=>o.company).join(' / ')}</span>}</div></>;
}

const channels=[{id:'clubhouse',label:'Clubhouse',icon:'clubhouse'},{id:'intel',label:'Experiences',icon:'round'},{id:'resource',label:'Resources',icon:'resource'},{id:'settings',label:'Circle settings',icon:'settings'}];
export default function CircleDashboard({initialChannel='clubhouse',request,detail,posts,demo,openPost,focused,controls,settings,pagination,search,searching,busy,save}:Props){
 const [person,setPerson]=useState(''),[channel,setChannel]=useState(initialChannel as string),[sharing,setSharing]=useState(false);
 const composer=useRef<HTMLDivElement>(null);
 const published=posts.filter(post=>!post.parentId&&post.state==='published'&&post.revision===post.publishedRevision);
 const selected=detail.members.find(member=>member.id===person);
 const visible=published.filter(post=>(!selected||post.authorId===selected.id)&&(!!selected||(channel==='resource'?post.content.type==='resource':post.content.type!=='resource'&&post.content.type!=='discussion')));
 const chat=published.filter(post=>post.content.type==='discussion');
 const title=clean(detail.circle.name);
 function selectPerson(id:string){setPerson(id);if(id)setChannel('intel');requestAnimationFrame(()=>document.getElementById('circle-conversation-title')?.scrollIntoView({block:'start'}));}
 function navigate(id:string){setChannel(id);setPerson('');setSharing(false);}
 return <section className={identity.circle} aria-label={`${title} Circle`}>
  <header className={identity.identity}><div className={identity.emblem}><CircleEmblem/></div><div className={identity.identityCopy}><div className={identity.titleRow}><h1>{title}</h1>{controls}</div><div className={identity.memberLine}><span className={styles.miniMembers}>{detail.members.slice(0,5).map(member=><Avatar key={member.id} name={member.alias} demo={demo}/>)}</span><span>{detail.members.length} members · Private Circle</span></div></div></header>
  {!focused&&<div className={styles.workspace}>
   <aside className={styles.rail} aria-label="Circle navigation"><p className={styles.railTitle}>Your Circle</p><nav aria-label="Circle spaces">{channels.map(item=><button key={item.id} type="button" aria-pressed={channel===item.id} onClick={()=>navigate(item.id)}><Icon kind={item.icon}/>{item.label}</button>)}</nav></aside>
   <section className={styles.conversations} aria-labelledby="circle-conversation-title">
    <header className={styles.chatHeader}><div><h2 id="circle-conversation-title">{channel==='clubhouse'?'Clubhouse':channel==='settings'?'Circle settings':searching?'Search results':channels.find(c=>c.id===channel)?.label}</h2><p>{channel==='clubhouse'?'Your people, making progress together.':channel==='settings'?'Manage your people, invites, and sharing permissions.':selected?`Shared by ${clean(selected.alias)}`:channel==='intel'?'Interview experiences, offers, and the inside story.':'Good finds. Useful reads. Shared by your people.'}</p></div>{channel!=='clubhouse'&&channel!=='settings'&&<details className={styles.search}><summary aria-label="Search contributions"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></svg></summary><div>{search}</div></details>}</header>
    {channel==='settings'?settings:channel==='clubhouse'?<>
     <CircleRoom embedded key={detail.circle.id} detail={detail} posts={published} demo={demo} activityControl={<div className={styles.activityControl}><button type="button" role="switch" aria-checked={sharing} aria-controls="clubhouse-activity-composer" aria-describedby="clubhouse-activity-hint" onClick={()=>setSharing(!sharing)}><span className={styles.switchTrack} aria-hidden="true"><span/></span><span>Share activity</span><span className={styles.switchState}>{sharing?'On':'Off'}</span></button><p id="clubhouse-activity-hint">{sharing?'Add an update below, then review before sharing.':'Off until you choose to add an update.'}</p></div>} person={person} selectPerson={selectPerson} openPost={openPost}/>
     {sharing&&<div id="clubhouse-activity-composer" ref={composer} className={styles.composerWrap}><Editor demo={demo} inline activityUpdate busy={busy} save={save} cancel={()=>setSharing(false)}/></div>}
    </>:<>
     <div className={styles.streamHeading}><h3>{channel==='intel'?'From inside the process':'The shared shelf'}</h3><span>{demo?'Fictional examples':'Shared by members'}</span></div>
     {selected&&<div className={styles.personFilter}><span>Shared by {clean(selected.alias)}</span><button type="button" onClick={()=>setPerson('')}>Show everyone</button></div>}
     <div className={styles.messages} aria-label={channel==='intel'?'Company experiences':'Shared resources'}>{visible.length?visible.map(post=><article key={post.id} className={styles.messageRow}><Avatar name={post.author} demo={demo}/><div className={styles.messageContent}><div className={styles.messageMeta}><strong>{clean(post.author)}</strong><span>{types[post.content.type]}</span><time dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'America/New_York'})}</time></div><button type="button" className={styles.threadTitle} onClick={()=>openPost(post)}>{post.content.title}</button><ContextChips content={post.content}/><p>{post.content.type==='interview_report'?(post.content.insight||post.content.body):(post.content.body||post.content.insight)}</p>{post.content.offers&&<div className={styles.offerPreview}>{post.content.offers.map((offer,index)=><div key={index}><div className={styles.offerCompany}><span className={styles.companyLogo}><CompanyLogo company={offer.company}/></span><strong>{offer.company}</strong></div><span>{offer.role||offer.location}</span>{offer.base&&<span>{offer.base} base</span>}</div>)}</div>}<button type="button" className={styles.threadAction} onClick={()=>openPost(post)}><Icon kind="chat"/>{post.content.type==='milestone'?'Celebrate & reply':'Open thread & reply'}<span aria-hidden="true">→</span></button></div></article>):<div className={styles.empty}><Icon kind={channel==='intel'?'round':'resource'}/><h3>{searching?'No matches yet.':channel==='intel'?'Your inside story starts here.':'A shelf worth building together.'}</h3><p>{searching?'Adjust your search or filters.':channel==='intel'?'Share an interview experience, compare offers, or ask about a company.':'Share a useful read, a preparation resource, or something that helped.'}</p>{selected&&<button type="button" onClick={()=>setPerson('')}>Show everyone</button>}</div>}</div>
     {pagination}
     <div ref={composer} className={styles.composerWrap}><Editor demo={demo} key={channel} inline initial={{type:channel==='resource'?'resource':'interview_report',title:'',body:'',sources:[],provenance:'user_confirmed',personalDisclosure:false}} contexts={published.map(p=>p.content)} busy={busy} save={save} cancel={()=>{}}/></div>
    </>}
    {channel==='clubhouse'&&<CircleFeed key={detail.circle.id} circleId={detail.circle.id} request={request} openPost={openPost} demo={demo}/>}
    <div hidden={channel!=='clubhouse'}><CircleChat forumPosts={published.filter(p=>p.content.type!=='discussion')} posts={chat} demo={demo} busy={busy} save={save} openPost={openPost}/></div>
   </section>
  </div>}
 </section>;
}
