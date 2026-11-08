import Link from 'next/link';
import type {BoardItem} from '../lib/use-action-board';
import styles from './action-decision-card.module.css';

export default function CommunicationAttachment({item}:{item:BoardItem}){
 const recipient=item.recipient||item.reference?.label||'Saved contact';
 return <section className={styles.communicationAttachment} aria-label="Attached communication context">
  <Link href={`${item.href}&returnTo=%2Fneeds-you%2F`} aria-label={`Open communication details for ${recipient}`} onClick={()=>{try{sessionStorage.setItem('lookout:board-scroll',String(window.scrollY));}catch{}}}>
   <svg className={styles.messageIcon} aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/></svg>
   <div className={styles.communicationIdentity}><strong>{recipient}</strong>{item.company&&<span>{item.company}</span>}{item.destination&&<span>{item.destination}</span>}{item.subject&&<p><span>Subject</span> {item.subject}</p>}</div>
   <svg className={styles.messageArrow} aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m9 5 7 7-7 7"/></svg>
  </Link>
 </section>;
}
