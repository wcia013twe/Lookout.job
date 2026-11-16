'use client';

import {formatPostDate} from "../_lib/post-date";
import {useEffect,useRef,useState,type FormEvent} from 'react';
import type {Content,Post} from '../_lib/types';
import {types} from '../_lib/types';
import {parseForumMentions} from '../../../../lib/circle-forum-mentions.mjs';
import {circleActivity} from '../../../../lib/circle-activity.mjs';
import {validateCircleContextContent} from '../../../../lib/circle-context.mjs';
import ChatComposer from './chat-composer';
import ForumMentionText from './forum-mention-text';
import SharedAttachments from './shared-attachments';
import AuthorshipLabel from './authorship-label';
import styles from './conversation.module.css';

type Props={forumPosts:Post[];posts:Post[];demo:boolean;busy:boolean;save:(content:Content)=>Promise<void>;openPost:(post:Post)=>void;composerOnly?:boolean};
export default function CircleChat({forumPosts,posts,demo,busy,save,openPost,composerOnly=false}:Props){
 const list=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(list.current)list.current.scrollTop=list.current.scrollHeight;},[]);
 const [message,setMessage]=useState(''),[error,setError]=useState('');
 async function submit(event:FormEvent){
  event.preventDefault();const body=message.trim();if(!body)return;
  try{setError('');const content:Content={type:'discussion',title:parseForumMentions(body).map((part:{text:string})=>part.text).join('').slice(0,100),body,sources:[],provenance:'user_confirmed',personalDisclosure:true};validateCircleContextContent(content);await save(content);}
  catch(e){setError(e instanceof Error?e.message:'Your message could not save. Try again.');}
 }
 return <aside className={styles.circleChat} aria-label={composerOnly?'Write a message':undefined} aria-labelledby={composerOnly?undefined:'circle-chat-title'}>
  {!composerOnly&&<header className={styles.chatRailHeader}><h2 id="circle-chat-title" tabIndex={-1}>Conversation</h2><p>Loaded messages and shared updates, oldest first.</p></header>}
  {!composerOnly&&<div ref={list} className={styles.chatMessages} aria-label="Shared Circle messages">
   {posts.length?[...posts].sort((first,second)=>first.createdAt.localeCompare(second.createdAt)||first.id.localeCompare(second.id)).map(post=>{
    const activity=circleActivity(post.content);
    const body=activity.message||((activity.highlights.length||activity.goal||activity.help)?post.content.title:post.content.body||post.content.insight);
    return <article key={post.id} className={styles.chatMessage} data-own={post.owned}><div><strong>{post.author.replace(' (demo)','')}</strong><AuthorshipLabel post={post}/><time dateTime={post.createdAt}>{formatPostDate(post.createdAt)}</time></div><div className={styles.chatBubble}>{post.content.type!=='discussion'&&<><span>{types[post.content.type]}</span><p><strong>{post.content.title}</strong></p></>}<p><ForumMentionText text={body||post.content.title} posts={forumPosts} openPost={openPost}/></p>{!!activity.highlights.length&&<ul>{activity.highlights.map((highlight:string,index:number)=><li key={index}>{highlight}</li>)}</ul>}{activity.goal&&<p>Goal: {activity.goal}</p>}{activity.help&&<p>Could use a hand: {activity.help}</p>}<button type="button" className={styles.chatReply} onClick={()=>openPost(post)} aria-label={`Open message from ${post.author.replace(' (demo)','')}: ${post.content.title}`}>{post.content.type==='resource'?'Open resource':'Reply in thread'} <span aria-hidden="true">↗</span></button></div>{!!post.content.contexts?.length&&<details className={styles.chatAttachments}><summary>{post.content.contexts.length} attached context items</summary><SharedAttachments contexts={post.content.contexts} primary={post.content}/></details>}</article>;
   }):<p className={styles.chatQuiet}>Nothing shared yet. Say hello, share a thought, or ask your people something.</p>}
  </div>}
  <form onSubmit={submit} className={styles.chatCompose} aria-label="Circle chat composer"><ChatComposer value={message} change={setMessage} posts={forumPosts} busy={busy}/><p>{demo?'Fictional chat · ':''}Review before sharing with your Circle.</p>{error&&<p role="alert">{error}</p>}</form>
 </aside>;
}
