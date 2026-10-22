import Link from 'next/link';
import {artifactLabels,artifactPath} from '../../../../lib/artifacts.mjs';
import {ToolkitIcon} from './toolkit-icon';
import type {Artifact} from './artifact-viewer';
import styles from '../toolkit.module.css';
export type ArtifactSummary=Omit<Artifact,'content'>&{content:Omit<Artifact['content'],'body'>};
export default function ArtifactTile({artifact,featured=false}:{artifact:ArtifactSummary;featured?:boolean}){
 const c=artifact.content;
 const interactive=c.format==='html';
 const tone=interactive?'interactive':c.kind==='weekly_prep'?'prep':c.kind==='company_research'||c.kind==='interview_brief'?'research':'document';
 const icon=interactive?'play':tone==='prep'?'calendar':tone==='research'?'globe':'documents';
 const date=c.weekOf?new Date(`${c.weekOf}T12:00:00Z`).toLocaleDateString(undefined,{month:'short',day:'numeric',timeZone:'UTC'}):null;
 return <li className={featured?styles.featuredMaterial:undefined}>
  <Link href={artifact.path||artifactPath(artifact.id)} className={`${styles.materialTile} ${styles[tone]} ${featured?styles.featuredTile:''}`}>
   <div className={styles.materialCover}>
    <span className={styles.materialSymbol}><ToolkitIcon name={icon} size={featured?40:30}/></span>
    <h3>{c.title}</h3>
    {featured&&<p>{c.purpose}</p>}
    <div className={styles.coverFooter}><span>{artifactLabels[c.kind as keyof typeof artifactLabels]||c.kind}</span><span className={styles.openSymbol}><ToolkitIcon name="arrow" size={20}/></span></div>
   </div>
   <div className={styles.materialCaption}><span>{interactive?'Interactive':c.company||'Document'}</span>{date&&<span>Week of {date}</span>}{!!c.sources.length&&<span>{c.sources.length} {c.sources.length===1?'source':'sources'}</span>}</div>
  </Link>
 </li>;
}
