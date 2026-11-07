import Link from 'next/link';
import {artifactLabels,artifactPath,artifactPurpose} from '../../../../lib/artifacts.mjs';
import {ToolkitIcon} from './toolkit-icon';
import type {Artifact} from './artifact-viewer';
import styles from '../toolkit.module.css';
export type ArtifactSummary=Omit<Artifact,'content'>&{content:Omit<Artifact['content'],'body'>};
export default function ArtifactTile({artifact,featured=false}:{artifact:ArtifactSummary;featured?:boolean}){
 const c=artifact.content;
 const interactive=c.format==='html';
 const tone=interactive?'interactive':c.kind==='weekly_prep'?'prep':c.kind==='company_research'||c.kind==='interview_brief'?'research':'document';
 const icon=c.materials?.length?'folder':interactive?'play':tone==='prep'?'calendar':tone==='research'?'globe':'documents';
 const date=c.weekOf?new Date(`${c.weekOf}T12:00:00Z`).toLocaleDateString(undefined,{month:'short',day:'numeric',timeZone:'UTC'}):null;
 return <li className={featured?styles.featuredMaterial:undefined}>
  <Link href={c.kind==='resource'&&c.resourceUrl?c.resourceUrl:artifact.path||artifactPath(artifact.id)} target={c.kind==='resource'?'_blank':undefined} rel={c.kind==='resource'?'noopener noreferrer':undefined} className={`${styles.materialTile} ${styles[tone]} ${featured?styles.featuredTile:''}`}>
   <div className={styles.materialCover}>
    <span className={styles.materialSymbol}><ToolkitIcon name={icon} size={featured?40:30}/></span>
    <h3>{c.title}</h3>
    {featured&&<p>{artifactPurpose(c)}</p>}
    <div className={styles.coverFooter}><span>{artifactLabels[c.kind as keyof typeof artifactLabels]||c.kind}</span><span className={styles.openSymbol}><ToolkitIcon name="arrow" size={20}/></span></div>
   </div>
   <div className={styles.materialCaption}><span>{interactive?'Interactive':c.kind==='resource'?'Online resource':c.company||'Document'}</span>{c.materials?.length?<span>{c.materials.length} materials</span>:null}{c.scheduledAt&&<span>{new Date(c.scheduledAt).toLocaleString(undefined,{timeZone:c.timeZone})} ({c.timeZone}) · {c.durationMinutes} min · {c.sessionStatus?.replace('_',' ')}</span>}{c.preparedFor?<span>For {new Date(`${c.preparedFor}T12:00:00Z`).toLocaleDateString(undefined,{month:'short',day:'numeric',timeZone:'UTC'})}</span>:date&&<span>Week of {date}</span>}{!!c.sources.length&&<span>{c.sources.length} {c.sources.length===1?'source':'sources'}</span>}</div>
  </Link>
 </li>;
}

export function SavedMaterialRow({artifact}:{artifact:ArtifactSummary}){
 const c=artifact.content;
 return <li><Link href={c.kind==='resource'&&c.resourceUrl?c.resourceUrl:artifact.path||artifactPath(artifact.id)} target={c.kind==='resource'?'_blank':undefined} rel={c.kind==='resource'?'noopener noreferrer':undefined} className={styles.savedMaterialRow}>
  <span className={styles.savedMaterialIcon}><ToolkitIcon name={c.materials?.length?'folder':c.format==='html'?'play':'documents'} size={20}/></span>
  <div><h3>{c.title}</h3><p>{artifactPurpose(c)}</p><span>{artifactLabels[c.kind as keyof typeof artifactLabels]||c.kind}{c.company?` · ${c.company}`:''}{c.kind==='resource'?' · Opens resource':''}{c.scheduledAt?` · ${new Date(c.scheduledAt).toLocaleString(undefined,{timeZone:c.timeZone})} · ${c.durationMinutes} min · ${c.sessionStatus}`:''}{c.materials?.length?` · ${c.materials.length} materials`:''}</span></div>
  <ToolkitIcon name="arrow" size={18}/>
 </Link></li>;
}
