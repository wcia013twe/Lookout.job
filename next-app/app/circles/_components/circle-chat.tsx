'use client';

import {useEffect,useRef,useState,type FormEvent} from 'react';
import type {Content,Post} from '../_lib/types';
import {parseCircleActivity} from '../../../../lib/circle-activity.mjs';
import styles from './conversation.module.css';

type Props={posts:Post[];demo:boolean;busy:boolean;save:(content:Content)=>Promise<void>;openPost:(post:Post)=>void};
export default function CircleChat({posts,demo,busy,save,openPost}:Props){
 const list=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(list.current)list.current.scrollTop=list.current.scrollHeight;},[]);
 const [message,setMessage]=useState(''),[error,setError]=useState('');
 async function submit(event:FormEvent){
  event.preventDefault();const body=message.trim();if(!body)return;
  try{setError('');await save({type:'discussion',title:body.slice(0,100),body,sources:[],provenance:'user_confirmed',personalDisclosure:true});}
  catch(e){setError(e instanceof Error?e.message:'Your message could not save. Try again.');}
 }
 return <aside className={styles.circleChat} aria-labelledby="circle-chat-title">
  <header className={styles.chatRailHeader}><h2 id="circle-chat-title">Circle chat</h2><p>A little space for whatever’s on your mind.</p></header>
  <div ref={list} className={styles.chatMessages} aria-label="Shared Circle messages">
   {posts.length?[...posts].reverse().map(post=>{
    const activity=parseCircleActivity(post.content.body);
    const body=activity.message||((activity.highlights.length||activity.goal||activity.help)?post.content.title:post.content.body||post.content.insight);
    return <article key={post.id} className={styles.chatMessage}><div><strong>{post.author.replace(' (demo)','')}</strong><time dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'America/New_York'})}</time></div><button type="button" onClick={()=>openPost(post)} aria-label={`Open message from ${post.author.replace(' (demo)','')}: ${post.content.title}`}><p>{body||post.content.title}</p><span>Reply in thread <span aria-hidden="true">↗</span></span></button></article>;
   }):<p className={styles.chatQuiet}>Your Circle’s chat starts here. Say hello, share a thought, or ask your people something.</p>}
  </div>
  <form onSubmit={submit} className={styles.chatCompose} aria-label="Message your Circle"><label htmlFor="circle-chat-message">Message your Circle</label><textarea id="circle-chat-message" value={message} onChange={event=>setMessage(event.target.value)} maxLength={12000} required placeholder="What’s on your mind?" disabled={busy}/><p>{demo?'Fictional chat · ':''}Review before sharing with your Circle.</p>{error&&<p role="alert">{error}</p>}<button type="submit" disabled={busy||!message.trim()}>{busy?'Saving…':'Review message'}<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6"/></svg></button></form>
 </aside>;
}
