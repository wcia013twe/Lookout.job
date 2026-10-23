import type {Post} from '../_lib/types';
import {types} from '../_lib/types';
import {parseCircleActivity} from '../../../../lib/circle-activity.mjs';
import AuthorshipLabel from './authorship-label';
import {companionForMember} from './companions';
import styles from './clubhouse-layout.module.css';

export function isActivityUpdate(post:Post){const a=parseCircleActivity(post.content.body);return !!(a.highlights.length||a.goal||a.help);}
export default function ClubhouseFeed({posts,demo,openPost}:{posts:Post[];demo:boolean;openPost:(post:Post)=>void}){
 const updates=posts.filter(p=>!p.parentId&&p.state==='published'&&p.revision===p.publishedRevision&&(p.content.type!=='discussion'||isActivityUpdate(p))).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id));
 return <section aria-label="Shared Circle updates" className={styles.feed}>
  <p className={styles.feedIntro}>{demo?'Fictional shared updates':'What your people chose to share.'}</p>
  {updates.length?<ul className={styles.feedList}>{updates.map(post=>{
   const activity=parseCircleActivity(post.content.body),name=post.author.replace(' (demo)','');
   return <li key={post.id} className={styles.feedItem}>
    <span className={styles.avatar} aria-hidden="true">{demo?<span style={{backgroundImage:`url('/circles/${companionForMember(name).id}.webp')`}}/>:name.trim().split(/\s+/).slice(0,2).map(p=>p[0]).join('')}</span>
    <div className={styles.feedContent}>
     <div className={styles.meta}><strong>{name}</strong><AuthorshipLabel post={post}/><time dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'America/New_York'})}</time></div>
     <button type="button" className={styles.postTitle} onClick={()=>openPost(post)}>{post.content.title}</button>
     {activity.highlights.length?<ul className={styles.highlights}>{activity.highlights.map((text:string,index:number)=><li key={index}>{text}</li>)}</ul>:<p className={styles.excerpt}>{post.content.insight||activity.message}</p>}
     {activity.goal&&<p className={styles.note}><strong>Goal</strong> {activity.goal}</p>}
     {activity.help&&<p className={styles.note}><strong>Could use a hand</strong> {activity.help}</p>}
     <footer className={styles.postFooter}><span>{post.content.company||types[post.content.type]}{post.content.stage?` · ${post.content.stage}`:''}</span><button type="button" onClick={()=>openPost(post)}>{post.content.type==='milestone'?'Celebrate & reply':'Open thread & reply'}<span aria-hidden="true"> →</span></button></footer>
    </div>
   </li>;
  })}</ul>:<p className={styles.empty}>No updates shared yet. Write an update to share progress, an experience, or something useful with your people.</p>}
 </section>;
}
