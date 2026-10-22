'use client';
import {useEffect,useState} from 'react';
import type {Circle,Post,Request} from '../_lib/types';
import {CompanyLogo} from '../../../components/role-card';
import {primary,secondary} from '../../../components/ui';
import styles from './circle-list.module.css';

type Props={circle:Circle;request:Request;busy:boolean;open:()=>void;manage:()=>void};
export default function CircleListItem({circle,request,busy,open,manage}:Props){
 const [companies,setCompanies]=useState<string[]>([]);
 const [state,setState]=useState<'loading'|'ready'|'error'>('loading');
 useEffect(()=>{
  let current=true;setCompanies([]);setState('loading');
  request<{items:Post[]}>('knowledge.search',{circleId:circle.id,sort:'newest'}).then(result=>{
   if(!current)return;
   const names=new Map<string,string>();
   for(const post of result.items){
    if(post.state!=='published'||post.revision!==post.publishedRevision)continue;
    for(const company of [post.content.company,...(post.content.contexts||[]).map(item=>item.company),...(post.content.offers||[]).map(item=>item.company)]){
     const name=company?.trim();if(name&&!names.has(name.toLocaleLowerCase()))names.set(name.toLocaleLowerCase(),name);
    }
   }
   setCompanies([...names.values()]);setState('ready');
  }).catch(()=>{if(current)setState('error');});
  return()=>{current=false;};
 },[circle.id,request]);
 const name=circle.name.replace(' (demo)','');
 return <li className={styles.circle}>
  <img className={styles.banner} src="/circles/cloud-cottage.webp" alt="" width="1536" height="1024"/>
  <div className={styles.details}>
   <div className={styles.heading}><div><h3>{name}</h3><p>Private Circle · {circle.owner?'Owner':'Member'}</p></div><div className={styles.actions}><button className={primary} disabled={busy} onClick={open}>Open Circle</button><button className={secondary} disabled={busy} aria-label={`Manage ${name}`} onClick={manage}>Manage</button></div></div>
   <div className={styles.companies}>
    {companies.length?<><ul aria-label={`Companies in recent shared posts in ${name}`} className={styles.logos}>{companies.slice(0,8).map(company=><li key={company} title={company}><CompanyLogo company={company}/><span className="sr-only">{company}</span></li>)}</ul>{companies.length>8&&<span className={styles.more}>+{companies.length-8}</span>}<p>From recent shared posts</p></>:<p role="status">{state==='loading'?'Loading shared companies…':state==='error'?'Shared companies could not be loaded. Open the Circle to try again.':'No companies shared yet.'}</p>}
   </div>
  </div>
 </li>;
}
