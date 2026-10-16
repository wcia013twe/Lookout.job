import type {Content,SharedContext} from '../_lib/types';
import JobAttachment from './job-attachment';
import {CompanyLogo} from '../../../components/role-card';
import styles from './prompt-composer.module.css';
const matchesJob=(item:SharedContext,content:Content)=>item.kind==='application'&&(['company','role','jobId','jobUrl','stage'] as const).every(key=>(item[key]||'')===(content[key]||''));
export const hasAttachedJob=(content:Content)=>content.contexts?.some(item=>matchesJob(item,content));
export default function SharedAttachments({contexts,primary}:{contexts:SharedContext[];primary?:Content}){
 return <div className={styles.sharedAttachments}>{contexts.map((item,index)=>item.kind==='application'?<JobAttachment key={index} content={{title:item.label,body:'',type:'discussion',sources:[],provenance:'user_confirmed',personalDisclosure:true,...item,...(primary&&matchesJob(item,primary)?{experienceDate:primary.experienceDate}:{})}}/>:<section key={index} className={styles.sharedItem} aria-label={`Attached ${item.kind}`}>
 {item.company&&<CompanyLogo company={item.company}/>}<div><span>{item.kind==='referral'?'Referral':item.kind==='resource'?'Resource':'Note'}</span><h4>{item.contact||item.label}</h4>{item.company&&<p>{item.company}{item.role?` · ${item.role}`:''}</p>}{item.note&&<p className={styles.sharedNote}>{item.note}</p>}{item.url&&<a href={item.url.startsWith('https://')?item.url:undefined} target="_blank" rel="noopener noreferrer">{item.kind==='referral'?'View profile':'Open source'}</a>}</div></section>)}</div>;
}
