"use client";
import {useEffect,useId,useState,type ReactNode} from "react";
import styles from "./profile-section.module.css";

export default function ProfileSection({title,children,resetKey,disabled=false}:{title:string;children:(editing:boolean)=>ReactNode;resetKey?:unknown;disabled?:boolean}){
 const [editing,setEditing]=useState(false),id=useId();
 useEffect(()=>setEditing(false),[resetKey]);
 return <section className={styles.section} aria-labelledby={id}>
  <header className={styles.header}><h3 id={id}>{title}</h3><button type="button" className={styles.edit} disabled={disabled} aria-label={`${editing?'Finish editing':'Edit'} ${title}`} aria-pressed={editing} title={editing?'Finish editing · save changes below':`Edit ${title}`} onClick={()=>setEditing(!editing)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{editing?<path d="m5 12 4 4L19 6"/>:<><path d="m16 3 5 5L8 21H3v-5L16 3Z"/><path d="m13 6 5 5"/></>}</svg></button></header>
  {children(editing)}
 </section>;
}
export function ProfileValues({items}:{items:{label:string;value:unknown;wide?:boolean}[]}){
 return <dl className={styles.values}>{items.map(({label,value,wide})=><div key={label} className={wide?styles.wide:undefined}><dt>{label}</dt><dd>{typeof value==='boolean'?(value?'Yes':'No'):Array.isArray(value)?value.join(', '):String(value||'').trim()||<span className={styles.empty}>Not provided</span>}</dd></div>)}</dl>;
}
export {styles as profileSectionStyles};
