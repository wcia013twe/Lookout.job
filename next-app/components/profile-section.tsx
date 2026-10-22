"use client";
import {useEffect,useId,useState,type ReactNode} from "react";
import ProfileIcon, {type ProfileIconName} from "./profile-icon";
import styles from "./profile-section.module.css";

export default function ProfileSection({title,children,resetKey,disabled=false,onFinish}:{title:string;onFinish?:()=>boolean|void|Promise<boolean|void>;children:(editing:boolean)=>ReactNode;resetKey?:unknown;disabled?:boolean}){
 const [editing,setEditing]=useState(false),id=useId();
 useEffect(()=>setEditing(false),[resetKey]);
 return <section className={styles.section} aria-labelledby={id}>
  <header className={styles.header}><h3 id={id}>{title}</h3><button type="button" className={styles.edit} disabled={disabled} aria-label={`${editing?'Finish editing':'Edit'} ${title}`} aria-pressed={editing} title={editing?(onFinish?'Save changes':'Finish editing'):`Edit ${title}`} onClick={async()=>{if(editing&&await onFinish?.()===false)return;setEditing(!editing);}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{editing?<path d="m5 12 4 4L19 6"/>:<><path d="m16 3 5 5L8 21H3v-5L16 3Z"/><path d="m13 6 5 5"/></>}</svg></button></header>
  {children(editing)}
 </section>;
}
export function ProfileCard({title,children,icon,actions}:{title:string;children:ReactNode;icon?:ProfileIconName;actions?:ReactNode}){
 const id=useId();
 return <section className={styles.section} aria-labelledby={id}>
  <header className={styles.header}><h3 id={id} className="flex min-w-0 items-center gap-3">{icon&&<ProfileIcon name={icon} width={22} height={22} className="shrink-0"/>}{title}</h3>{actions}</header>
  {children}
 </section>;
}
export function ProfileValues({items}:{items:{label:string;value:unknown;wide?:boolean}[]}){
 return <dl className={styles.values}>{items.map(({label,value,wide})=><div key={label} className={wide?styles.wide:undefined}><dt>{label}</dt><dd>{typeof value==='boolean'?(value?'Yes':'No'):Array.isArray(value)?value.join(', '):String(value||'').trim()||<span className={styles.empty}>Not provided</span>}</dd></div>)}</dl>;
}
export {styles as profileSectionStyles};
