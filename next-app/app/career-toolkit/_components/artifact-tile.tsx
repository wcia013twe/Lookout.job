import {mockCalendarPreview} from '../../../lib/mock-calendar-preview.mjs';
import Link from 'next/link';
import {artifactLabels,artifactPath,artifactPurpose} from '../../../../lib/artifacts.mjs';
import {CompanyLogo} from '../../../components/company-logo';
import {ToolkitIcon} from './toolkit-icon';
import type {Artifact} from './artifact-viewer';
import styles from '../toolkit.module.css';
export type ArtifactSummary=Omit<Artifact,'content'>&{content:Omit<Artifact['content'],'body'>};
export type MaterialApplication={id:string;title:string;company:string};
const iconFor=(kind:string)=>({mock_interview:'interviews',interview_brief:'calendar',weekly_prep:'calendar',company_research:'globe',story_bank:'book',interview_debrief:'check',resource:'book',practice:'play'}[kind]||'documents');
function Context({artifact,application,compact=false}:{artifact:ArtifactSummary;application?:MaterialApplication;compact?:boolean}){
 const c=artifact.content;
 return <div className={styles.materialContext}>
  <span>{compact&&(application?.company||c.company)?`${(application?.company||c.company)?.replace(/ \(demo\)$/,'')} · `:''}{artifactLabels[c.kind as keyof typeof artifactLabels]||c.kind}{c.durationMinutes?` · ${c.durationMinutes} min`:''}{c.sessionStatus?` · ${c.sessionStatus.replace('_',' ')}`:''}</span>
  {c.prepOn&&<span>Prep on {new Date(c.prepOn+'T12:00:00Z').toLocaleDateString(undefined,{month:'short',day:'numeric',timeZone:'UTC'})}</span>}
  {application&&<Link className={styles.applicationLink} href={`/applications/?application=${encodeURIComponent(application.id)}`} title={`${application.company} · ${application.title}`}><ToolkitIcon name="offers" size={13}/>{application.title}<ToolkitIcon name="chevron" size={12}/></Link>}
 </div>;
}
function Identity({company}:{company?:string}){
 return company?<span className={styles.companyIdentity}><CompanyLogo company={company}/><span>{company.replace(/ \(demo\)$/,'')}</span></span>:<span className={styles.companyIdentity}>Personal preparation</span>;
}
export default function ArtifactTile({artifact,featured=false,dated=false,demo=false,application}:{artifact:ArtifactSummary;featured?:boolean;dated?:boolean;demo?:boolean;application?:MaterialApplication}){
 const c=artifact.content,interactive=c.kind==='practice';
 const calendar=demo?mockCalendarPreview(c):null;
 const tone=interactive?'interactive':c.kind==='mock_interview'||c.kind==='weekly_prep'?'prep':c.kind==='company_research'||c.kind==='interview_brief'?'research':'document';
 const href=calendar||(c.kind==='resource'&&c.resourceUrl?c.resourceUrl:artifact.path||artifactPath(artifact.id));
 return <li className={`${featured?styles.featuredMaterial:''} ${dated?styles.datedMaterial:''}`}><article className={`${styles.materialTile} ${styles[tone]}`}>
  <Link href={href} target={calendar||c.kind==='resource'?'_blank':undefined} rel={calendar||c.kind==='resource'?'noopener noreferrer':undefined} className={styles.materialCover}>
   <span className={styles.backgroundIcon}><ToolkitIcon name={iconFor(c.kind)} size={130}/></span>
   <Identity company={application?.company||c.company}/>
   <h3>{c.title}</h3><p>{artifactPurpose(c)}</p>
   {c.scheduledAt&&<span className={styles.sessionTime}>{new Date(c.scheduledAt).toLocaleTimeString(undefined,{timeZone:c.timeZone,hour:'numeric',minute:'2-digit'})} · {c.timeZone}</span>}
   {calendar&&<span className={styles.calendarAction}><ToolkitIcon name="calendar" size={14}/>Add to Google Calendar</span>}
   <span className={styles.cardArrow}><ToolkitIcon name="arrow" size={18}/></span>
  </Link>
  <Context artifact={artifact} application={application}/>
 </article></li>;
}
export function SavedMaterialRow({artifact,application,demo=false}:{artifact:ArtifactSummary;application?:MaterialApplication;demo?:boolean}){
 const c=artifact.content,calendar=demo?mockCalendarPreview(artifact.content):null;
 return <li className={styles.rowItem}><article className={styles.compactMaterial}>
  <Link href={calendar||(c.kind==='resource'&&c.resourceUrl?c.resourceUrl:artifact.path||artifactPath(artifact.id))} target={calendar||c.kind==='resource'?'_blank':undefined} rel={calendar||c.kind==='resource'?'noopener noreferrer':undefined} className={styles.savedMaterialRow}>
   <span className={styles.savedMaterialIcon}>{(application?.company||c.company)?<CompanyLogo company={application?.company||c.company||''}/>:<ToolkitIcon name={iconFor(c.kind)} size={22}/>}</span>
   <div><h3>{c.title}</h3><p>{artifactPurpose(c)}</p></div><ToolkitIcon name="arrow" size={17}/>
  </Link>{c.kind==='resource'&&<Link className="text-xs text-board-accent underline" href={artifact.path||artifactPath(artifact.id)}>Details & prep date</Link>}<Context artifact={artifact} application={application} compact/>
 </article></li>;
}
