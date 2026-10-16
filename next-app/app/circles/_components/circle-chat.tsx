'use client';

import {useEffect,useRef,useState,type FormEvent} from 'react';
import type {Content,Post,SharedContext} from '../_lib/types';
import {parseCircleActivity} from '../../../../lib/circle-activity.mjs';
import {validateCircleContextContent} from '../../../../lib/circle-context.mjs';
import {useLocalCircleFiles} from './local-file-attachments';
import PromptComposer from './prompt-composer';
import SharedAttachments from './shared-attachments';
import styles from './conversation.module.css';

type Props={contexts:Content[];posts:Post[];demo:boolean;busy:boolean;save:(content:Content)=>Promise<void>;openPost:(post:Post)=>void};
export default function CircleChat({contexts,posts,demo,busy,save,openPost}:Props){
 const list=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(list.current)list.current.scrollTop=list.current.scrollHeight;},[]);
 const [selectedContexts,setSelectedContexts]=useState<SharedContext[]>([]);
 const localFiles=useLocalCircleFiles(selectedContexts.length);
 const [message,setMessage]=useState(''),[error,setError]=useState('');
 async function submit(event:FormEvent){
  event.preventDefault();const body=message.trim();if(!body)return;
  try{if(localFiles.files.length)throw Error('Files are local previews for now. Remove them before saving a post.');setError('');const content:Content={type:'discussion',title:body.slice(0,100),body,sources:[],provenance:'user_confirmed',personalDisclosure:true};if(selectedContexts.length)content.contexts=selectedContexts;validateCircleContextContent(content);await save(content);}
  catch(e){setError(e instanceof Error?e.message:'Your message could not save. Try again.');}
 }
 return <aside className={styles.circleChat} aria-labelledby="circle-chat-title">
  <header className={styles.chatRailHeader}><h2 id="circle-chat-title">Circle chat</h2><p>A little space for whatever’s on your mind.</p></header>
  <div ref={list} className={styles.chatMessages} aria-label="Shared Circle messages">
   {posts.length?[...posts].reverse().map(post=>{
    const activity=parseCircleActivity(post.content.body);
    const body=activity.message||((activity.highlights.length||activity.goal||activity.help)?post.content.title:post.content.body||post.content.insight);
    return <article key={post.id} className={styles.chatMessage}><div><strong>{post.author.replace(' (demo)','')}</strong><time dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'America/New_York'})}</time></div><button type="button" onClick={()=>openPost(post)} aria-label={`Open message from ${post.author.replace(' (demo)','')}: ${post.content.title}`}><p>{body||post.content.title}</p><span>Reply in thread <span aria-hidden="true">↗</span></span></button>{!!post.content.contexts?.length&&<details className={styles.chatAttachments}><summary>{post.content.contexts.length} attached context items</summary><SharedAttachments contexts={post.content.contexts} primary={post.content}/></details>}</article>;
   }):<p className={styles.chatQuiet}>Your Circle’s chat starts here. Say hello, share a thought, or ask your people something.</p>}
  </div>
  <form onSubmit={submit} className={styles.chatCompose} aria-label="Circle chat composer"><PromptComposer value={message} change={setMessage} contexts={selectedContexts} attach={context=>setSelectedContexts(old=>old.some(item=>JSON.stringify(item)===JSON.stringify(context))?old:[...old,context])} remove={index=>setSelectedContexts(old=>old.filter((_,i)=>i!==index))} removeJob={()=>{}} shared={contexts} demo={demo} busy={busy} hasInsight={false} localFiles={localFiles}/><p>{demo?'Fictional chat · ':''}Review before sharing with your Circle.</p>{error&&<p role="alert">{error}</p>}</form>
 </aside>;
}
