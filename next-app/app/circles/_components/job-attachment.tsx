import {ApplicationIdentity,SharedApplicationStages} from '../../../components/tracker-progress';
import type {Content} from '../_lib/types';
import '../../../components/tracker.css';
import styles from './job-attachment.module.css';

export default function JobAttachment({content}:{content:Content}){
 return <section className={`tracker-surface ${styles.attachment}`} aria-label="Attached job context">
  <div className={styles.row}>
   <div className={`tracker-role ${styles.identity}`}><ApplicationIdentity company={content.company||'Company not shared'} title={content.role||'Role not shared'}/></div>
   {content.stage&&<div className={styles.progress}><SharedApplicationStages stage={content.stage}/></div>}
  </div>
  <div className={styles.meta}><span>{content.jobId?`Job ID ${content.jobId}`:'Shared job'}{content.stage?` · ${content.stage}`:''}{content.experienceDate&&<> · <time dateTime={content.experienceDate}>{new Date(`${content.experienceDate}T12:00:00Z`).toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'})}</time></>}</span>{content.jobUrl&&<a href={content.jobUrl.startsWith('https://')?content.jobUrl:undefined} target="_blank" rel="noopener noreferrer" aria-label={`View ${content.company||'shared'} job posting`}>View posting <svg aria-hidden="true" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M6 18 18 6M6 6h12v12"/></svg></a>}</div>
 </section>;
}
