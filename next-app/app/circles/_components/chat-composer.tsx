'use client';
import {useId,useRef,useState,type KeyboardEvent} from 'react';
import {forumMentionAt,forumMentionCandidates,formatForumMention} from '../../../../lib/circle-forum-mentions.mjs';
import type {Post} from '../_lib/types';
import styles from './prompt-composer.module.css';

type Mention={start:number;end:number;query:string};
export default function ChatComposer({value,change,posts,busy}:{value:string;change:(value:string)=>void;posts:Post[];busy:boolean}) {
 const id=useId(),textarea=useRef<HTMLTextAreaElement>(null);
 const [mention,setMention]=useState<Mention|null>(null),[active,setActive]=useState(0);
 const matches:Post[]=mention?forumMentionCandidates(posts,mention.query):[];
 function detect(text:string,cursor:number){setMention(forumMentionAt(text,cursor));setActive(0);}
 function select(post:Post){
  if(!mention)return;
  const insertion=`${formatForumMention(post)} `;
  const next=value.slice(0,mention.start)+insertion+value.slice(mention.end);
  if(next.length>12000)return;
  change(next);const cursor=mention.start+insertion.length;setMention(null);
  requestAnimationFrame(()=>{textarea.current?.focus();textarea.current?.setSelectionRange(cursor,cursor);});
 }
 function keys(event:KeyboardEvent<HTMLTextAreaElement>){
  if(!mention||event.nativeEvent.isComposing)return;
  if(event.key==='Escape'){event.preventDefault();setMention(null);}
  else if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();setActive(old=>matches.length?(old+(event.key==='ArrowDown'?1:-1)+matches.length)%matches.length:0);}
  else if(event.key==='Enter'&&!event.shiftKey&&matches.length){event.preventDefault();select(matches[Math.min(active,matches.length-1)]);}
 }
 return <div className={`${styles.prompt} ${styles.chatPrompt}`} onDragOver={event=>event.preventDefault()} onDrop={event=>event.preventDefault()}>
  {mention&&<section className={styles.picker} aria-label="Mention a forum post"><header><strong>Forum posts</strong><button type="button" aria-label="Close forum mentions" onClick={()=>{setMention(null);textarea.current?.focus();}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header><div className={styles.options} role="listbox" id={`${id}-posts`} aria-label="Forum posts">{matches.map((post,index)=><button type="button" role="option" aria-selected={index===Math.min(active,matches.length-1)} id={`${id}-post-${index}`} key={post.id} onMouseEnter={()=>setActive(index)} onClick={()=>select(post)}><span><strong>{post.content.title}</strong><small>{post.author.replace(' (demo)','')}{post.content.company?` · ${post.content.company}`:''}</small></span></button>)}{!matches.length&&<p className={styles.empty}>{mention.query?'No matching forum posts. Try another title or company.':'No shared forum posts yet.'}</p>}</div></section>}
  <label className={styles.srOnly} htmlFor={`${id}-message`}>Message your Circle</label>
  <textarea ref={textarea} id={`${id}-message`} name="body" value={value} maxLength={12000} placeholder="Message your Circle…" aria-autocomplete="list" aria-controls={mention?`${id}-posts`:undefined} aria-activedescendant={mention&&matches.length?`${id}-post-${Math.min(active,matches.length-1)}`:undefined} onChange={event=>{change(event.target.value);detect(event.target.value,event.target.selectionStart);}} onKeyDown={keys} onClick={event=>detect(event.currentTarget.value,event.currentTarget.selectionStart)}/>
  <div className={styles.toolbar}><span>Type @ to mention a forum post</span><button className={styles.submit} type="submit" disabled={busy||!value.trim()} aria-label={busy?'Saving draft':'Review message'} title="Review before sharing"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6"/></svg></button></div>
 </div>;
}
