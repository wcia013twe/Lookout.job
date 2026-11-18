'use client';
import {asset} from '../../../lib/workspace';

import {formatPostDate} from "../_lib/post-date";
import {useRef,useState,type ReactNode} from 'react';
import AuthorshipLabel from './authorship-label';
import type {Content,Detail,Post} from '../_lib/types';
import {types} from '../_lib/types';
import identity from './circle-views.module.css';
import styles from './conversation.module.css';
import CircleRoom from './circle-room';
import ClubhouseProgress from './clubhouse-progress';
import layout from './clubhouse-layout.module.css';
import CircleChat from './circle-chat';
import Editor from './editor';
import JobAttachment from './job-attachment';
import SharedAttachments,{hasAttachedJob} from './shared-attachments';
import {companionForMember} from './companions';
import {CompanyLogo} from '../../../components/role-card';
import {secondary} from '../../../components/ui';
import ForumMentionText from './forum-mention-text';
import {circleActivity} from '../../../../lib/circle-activity.mjs';

type Props={initialChannel?:'clubhouse'|'settings';detail:Detail;posts:Post[];demo:boolean;openPost:(post:Post)=>void;focused:boolean;controls:ReactNode;customize:ReactNode;settings:ReactNode;pagination:ReactNode;search:ReactNode;searching:boolean;busy:boolean;save:(content:Content)=>Promise<void>};
const clean=(name:string)=>name.replace(' (demo)','');
export function CircleEmblem(){return <svg viewBox="0 0 100 100" fill="none" aria-hidden="true"><path d="M50 5 89 19v31c0 21-16 36-39 45C27 86 11 71 11 50V19L50 5Z" fill="currentColor" fillOpacity=".08" stroke="currentColor" strokeWidth="2"/><path d="m22 65 22-30 12 17 8-10 16 23H22Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg>;}
function Icon({kind}:{kind:string}){return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind==='settings'?<><path d="m10 3-.5 2a7 7 0 0 0-2 1L5.5 5.5l-2 3.5L5 10.5a7 7 0 0 0 0 3L3.5 15l2 3.5L7.5 18a7 7 0 0 0 2 1L10 21h4l.5-2a7 7 0 0 0 2-1l2 .5 2-3.5-1.5-1.5a7 7 0 0 0 0-3L20.5 9l-2-3.5-2 .5a7 7 0 0 0-2-1L14 3h-4Z"/><circle cx="12" cy="12" r="3"/></>:kind==='clubhouse'?<><path d="m3 10 9-7 9 7v10H3V10Z"/><path d="M9 20v-7h6v7"/></>:kind==='chat'?<path d="M20 11a8 8 0 0 1-8 8H5l-4 3 2-7a8 8 0 1 1 17-4Z"/>:kind==='round'?<><rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v4m8-4v4M8 12h8m-8 4h5"/></>:kind==='offers'?<><rect x="2" y="6" width="8" height="14" rx="2"/><rect x="14" y="3" width="8" height="17" rx="2"/><path d="M5 10h2m-2 4h2m10-7h2m-2 4h2"/></>:kind==='resource'?<><path d="M12 5c-3-2-7-2-10-1v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Zm0 0v15"/></>:<><path d="M8 12h8m-4-4v8"/><rect x="3" y="3" width="18" height="18" rx="4"/></>}</svg>;}
function Avatar({name,demo}:{name:string;demo:boolean}){return <span className={styles.avatar} aria-hidden="true">{demo?<span style={{backgroundImage:`url('${asset(`circles/${companionForMember(name).id}.webp`)}')`}}/>:clean(name).split(/\s+/).slice(0,2).map(x=>x[0]).join('')}</span>;}
export function ContextChips({content}:{content:Content}){
 const hasJob=!hasAttachedJob(content)&&!!(content.company||content.role||content.jobId||content.jobUrl);
 return <>{hasJob&&<JobAttachment content={content}/>}{content.contexts&&<SharedAttachments contexts={content.contexts} primary={content}/>}<div className={styles.chips} aria-label="Other attached context">{!hasJob&&content.stage&&<span className={styles.stage}><Icon kind="round"/>{content.stage}</span>}{content.offers&&<span><Icon kind="offers"/>{content.offers.map(o=>o.company).join(' / ')}</span>}</div></>;
}

const channels=[{id:'clubhouse',label:'Clubhouse',icon:'clubhouse'},{id:'conversation',label:'Conversation',icon:'chat'},{id:'settings',label:'Circle settings',icon:'settings'}];
export default function CircleDashboard({initialChannel='clubhouse',detail,posts,demo,openPost,focused,controls,customize,settings,pagination,search,searching,busy,save}:Props){
 const [person,setPerson]=useState(''),[channel,setChannel]=useState(initialChannel==='settings'?'settings':'conversation'),[sharing,setSharing]=useState(false),[filter,setFilter]=useState('all'),[compose,setCompose]=useState('message');
 const composer=useRef<HTMLDivElement>(null);
 const published=posts.filter(post=>!post.parentId&&post.state==='published'&&post.revision===post.publishedRevision);
 const sharedProgress=detail.members.flatMap(member=>member.progress?[member.progress]:[]);
 const now=new Date(),weekStart=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()-((now.getUTCDay()+6)%7))),weekEnd=new Date(weekStart.getTime()+7*86400000);
 const weeklyResources=published.filter(post=>post.content.type==='resource'&&new Date(post.createdAt)>=weekStart&&new Date(post.createdAt)<weekEnd).length;
 const selected=detail.members.find(member=>member.id===person);
 const visible=published.filter(post=>(!selected||(post.authorId ? post.authorId===selected.id : post.author===selected.alias))&&(filter==='all'||(filter==='resource'?post.content.type==='resource':post.content.type!=='resource'&&post.content.type!=='discussion'))).sort((first,second)=>second.createdAt.localeCompare(first.createdAt)||second.id.localeCompare(first.id));
 const title=clean(detail.circle.name);
 function selectPerson(id:string){setPerson(id);if(id){setChannel('conversation');setFilter('all');}requestAnimationFrame(()=>document.getElementById('circle-conversation-title')?.scrollIntoView({block:'start'}));}
 function navigate(id:string){setChannel(id);setPerson('');setSharing(false);}
 function openStation(station:'conversation'|'intel'|'resource'){navigate('conversation');setFilter(station==='conversation'?'all':station);requestAnimationFrame(()=>{const target=document.getElementById('circle-conversation-title');target?.scrollIntoView({block:'start'});target?.focus({preventScroll:true});});}
 return <section className={identity.circle} aria-label={`${title} Circle`}>
  <div className={identity.toolbar}>{controls}</div>
  {!focused&&<div className={`${styles.workspace} ${layout.workspace}`}>
   <aside className={`${styles.rail} ${layout.navigation}`} aria-label="Circle navigation"><p className={styles.railTitle}>Your Circle</p><nav aria-label="Circle spaces">{channels.map(item=><button key={item.id} type="button" aria-pressed={channel===item.id} onClick={()=>navigate(item.id)}><Icon kind={item.icon}/>{item.label}</button>)}</nav></aside>
   <section className={`${styles.conversations} ${layout.body}`} aria-labelledby="circle-conversation-title">
    <header className={styles.chatHeader}><div><h2 id="circle-conversation-title" tabIndex={-1}>{channel==='clubhouse'?'Clubhouse':channel==='settings'?'Circle settings':'Conversation'}</h2>{selected&&channel==='conversation'&&<span className={styles.activeFilter}>Shared by {clean(selected.alias)}</span>}</div>{channel==='conversation'&&<details className={styles.search}><summary aria-label="Search contributions"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></svg></summary><div>{search}</div></details>}</header>
    {channel==='settings'?<><header className={identity.identity}><div className={identity.emblem}><CircleEmblem/></div><div className={identity.identityCopy}><div className={identity.titleRow}><h1>{title}</h1>{customize}</div></div></header>{settings}</>:channel==='clubhouse'?<>
     <CircleRoom embedded key={`room:${detail.circle.id}`} detail={detail} posts={published} demo={demo} activityControl={<div className={styles.activityControl}><button type="button" className={secondary} aria-expanded={sharing} aria-controls="clubhouse-activity-composer" aria-describedby="clubhouse-activity-hint" onClick={()=>setSharing(!sharing)}>{sharing?'Close update':'Write an update'}</button><p id="clubhouse-activity-hint">Your tracker stays private. Review each update before sharing.</p></div>} person={person} selectPerson={selectPerson} openPost={openPost} openStation={openStation}/>
     {sharing&&<div id="clubhouse-activity-composer" ref={composer} className={styles.composerWrap}><Editor demo={demo} inline activityUpdate busy={busy} save={save} cancel={()=>setSharing(false)}/></div>}
     <div className={layout.lower}><section aria-labelledby="circle-activity-title"><header className={layout.updatesHeader}><div><h3 id="circle-activity-title">Circle Activity</h3></div><span>{demo?'This week · Fictional example':'This UTC week'}</span></header><div className={layout.pulseStats}><div><strong>{sharedProgress.length?sharedProgress.reduce((total,progress)=>total+progress.interviews,0):'—'}</strong><span>Interview activities</span></div><div><strong>{sharedProgress.length?sharedProgress.reduce((total,progress)=>total+progress.applications,0):'—'}</strong><span>Applications</span></div><div><strong>{weeklyResources}</strong><span>Resources shared</span></div></div><details className={layout.feedIntro}><summary>How counts work</summary><p>{sharedProgress.length?`Counts shared by ${sharedProgress.length} ${sharedProgress.length===1?'member':'members'}; tracked records, not verified outcomes.`:'No members have shared weekly counts yet.'} Resources count loaded posts only.</p></details></section><ClubhouseProgress key={`progress:${detail.circle.id}`} posts={published} detail={detail} demo={demo} openPost={openPost}/></div>
    </>:<>
     <div className={layout.feedHeading}><div><p className={layout.eyebrow}>YOUR CIRCLE, TOGETHER</p><h3>What’s happening?</h3><p>Messages, experiences and useful finds, all in one place.</p></div><span>{demo?'Fictional examples':'Shared with your Circle'}</span></div>
     <section className={layout.composePanel} aria-label="Create a contribution"><div className={layout.composeTabs} aria-label="Contribution type">{[{id:'message',label:'Message'},{id:'intel',label:'Experience'},{id:'resource',label:'Resource'}].map(item=><button key={item.id} type="button" aria-pressed={compose===item.id} onClick={()=>setCompose(item.id)}>{item.label}</button>)}</div>
      {compose==='message'?<CircleChat composerOnly forumPosts={published.filter(post=>post.content.type!=='discussion')} posts={published} demo={demo} busy={busy} save={save} openPost={openPost}/>:<div className={styles.composerWrap}><Editor demo={demo} key={compose} inline initial={{type:compose==='resource'?'resource':'interview_report',title:'',body:'',sources:[],provenance:'user_confirmed',personalDisclosure:false}} contexts={published.map(post=>post.content)} busy={busy} save={save} cancel={()=>setCompose('message')}/></div>}
     </section>
     <div className={layout.filterBar} aria-label="Filter conversation">{[{id:'all',label:'All posts'},{id:'intel',label:'Experiences'},{id:'resource',label:'Resources'}].map(item=><button key={item.id} type="button" aria-pressed={filter===item.id} onClick={()=>setFilter(item.id)}>{item.label}</button>)}<span>Newest first</span></div>
     {selected&&<div className={styles.personFilter}><span>Shared by {clean(selected.alias)}</span><button type="button" onClick={()=>setPerson('')}>Show everyone</button></div>}
     <div className={layout.threadList} aria-label="Circle conversation">{visible.length?visible.map(post=>{const activity=circleActivity(post.content);const body=activity.message||((activity.highlights.length||activity.goal||activity.help)?'':post.content.body||post.content.insight);return <article key={post.id} className={layout.threadCard}><Avatar name={post.author} demo={demo}/><div className={layout.threadContent}><div className={layout.threadMeta}><strong>{clean(post.author)}</strong><AuthorshipLabel post={post}/><span aria-hidden="true">·</span><time dateTime={post.createdAt}>{formatPostDate(post.createdAt)}</time><span className={layout.threadType}>{types[post.content.type]}</span></div>{post.content.type!=='discussion'&&<button type="button" className={layout.threadTitle} onClick={()=>openPost(post)}>{post.content.title}</button>}{body&&<p className={layout.threadBody}><ForumMentionText text={body} posts={published} openPost={openPost}/></p>}{!!activity.highlights.length&&<ul className={layout.highlights}>{activity.highlights.map((highlight:string,index:number)=><li key={index}>{highlight}</li>)}</ul>}{activity.goal&&<p className={layout.note}><strong>Goal</strong> {activity.goal}</p>}{activity.help&&<p className={layout.note}><strong>Could use a hand</strong> {activity.help}</p>}<ContextChips content={post.content}/>{post.content.offers&&<div className={styles.offerPreview}>{post.content.offers.map((offer,index)=><div key={index}><div className={styles.offerCompany}><span className={styles.companyLogo}><CompanyLogo company={offer.company}/></span><strong>{offer.company}</strong></div><span>{offer.role||offer.location}</span>{offer.base&&<span>{offer.base} base</span>}</div>)}</div>}<button type="button" className={layout.threadReply} onClick={()=>openPost(post)}><Icon kind="chat"/>{post.content.type==='resource'?'Open resource & replies':post.content.type==='milestone'?'Celebrate & reply':'Open thread & reply'}</button></div></article>}):<div className={styles.empty}><Icon kind={filter==='resource'?'resource':'chat'}/><h3>{searching?'No matches yet.':'Nothing here yet.'}</h3><p>{searching?'Adjust your search or filters.':filter==='resource'?'Resources shared in conversation will appear here.':filter==='intel'?'Experiences shared in conversation will appear here.':'Start a conversation with your Circle.'}</p>{selected&&<button type="button" onClick={()=>setPerson('')}>Show everyone</button>}</div>}</div>
     {pagination}
    </>}
   </section>
  </div>}
 </section>;
}
