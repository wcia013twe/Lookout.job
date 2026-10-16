'use client';
import {parseForumMentions} from '../../../../lib/circle-forum-mentions.mjs';
import type {Post} from '../_lib/types';
import styles from './prompt-composer.module.css';
export default function ForumMentionText({text,posts=[],openPost}:{text:string;posts?:Post[];openPost?:(post:Post)=>void}) {
 return <>{parseForumMentions(text).map((part:{text:string;circleId?:string;postId?:string},index:number)=>part.postId?<a key={index} className={styles.forumMention} href={`?circle=${part.circleId}&thread=${part.postId}`} onClick={event=>{const post=posts.find(item=>item.id===part.postId&&item.circleId===part.circleId);if(post&&openPost&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey){event.preventDefault();openPost(post);}}}>{part.text}</a>:part.text)}</>;
}
