import {ApplicationIdentity,SharedApplicationStages} from '../../../components/tracker-progress';
import type {Content} from '../_lib/types';
import '../../../components/tracker.css';
import styles from './job-attachment.module.css';

export default function JobAttachment({content}:{content:Content}){
 return <section className={`tracker-surface ${styles.attachment}`} aria-label="Attached job context">
  <div className={styles.row} data-progress={!!(content.stage||content.experienceDate)}>
   <div className={`tracker-role ${styles.identity}`}><ApplicationIdentity company={content.company||'Company not shared'} title={content.role||'Role not shared'} jobId={content.jobId}/></div>
   {(content.stage||content.experienceDate)&&<div className={styles.progress}>{content.stage&&<SharedApplicationStages stage={content.stage}/>}<p className={styles.stageInfo}>{content.stage}{content.stage&&content.experienceDate&&' · '}{content.experienceDate&&<time dateTime={content.experienceDate}>{new Date(`${content.experienceDate}T12:00:00Z`).toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'})}</time>}</p></div>}
   {content.jobUrl&&<a className={styles.postingLink} href={content.jobUrl.startsWith('https://')?content.jobUrl:undefined} target="_blank" rel="noopener noreferrer" aria-label={`View ${content.company||'shared'} job posting`} title="View posting"><svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M6 18 18 6M6 6h12v12"/></svg></a>}
  </div>
 </section>;
}
