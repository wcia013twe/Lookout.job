'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {artifactPath,artifactPurpose} from '../../../../lib/artifacts.mjs';
import {secondary} from '../../../components/ui';
import {ArtifactBody,type Artifact} from './artifact-viewer';
import styles from '../toolkit.module.css';
type Material={id:string;version:number};
export default function ArtifactCollection({materials,read}:{materials:Material[];read:(id:string,version:number)=>Promise<Artifact>}){
 const [rows,setRows]=useState<(Artifact|null)[]>([]),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0);
 useEffect(()=>{let active=true;setRows([]);setLoading(true);
  Promise.allSettled(materials.map(m=>read(m.id,m.version))).then(results=>{if(active){setRows(results.map(r=>r.status==='fulfilled'?r.value:null));setLoading(false);}});
  return()=>{active=false;};
 },[materials,read,retry]);
 return <section className={styles.collectionReader} aria-label="Collection materials">
  <nav className={styles.collectionContents} aria-label="In this collection"><h2>In this collection</h2><ol>{materials.map((m,i)=><li key={m.id}><a href={`#material-${m.id}`}>{rows[i]?.content.title||(loading?`Loading material ${i+1}…`:`Material ${i+1} unavailable`)}</a></li>)}</ol><p>Read in order, or jump to what you need.</p></nav>
  <div className={styles.collectionSections} aria-busy={loading}>{loading?<p role="status">Loading saved materials…</p>:materials.map((m,i)=>{
   const row=rows[i];return <section key={m.id} id={`material-${m.id}`} className={styles.collectionSection} aria-label={row?.content.title||`Material ${i+1} unavailable`}>
    {row?<><header><div><h2>{row.content.title}</h2><p>{artifactPurpose(row.content)}</p></div><Link href={artifactPath(m.id,m.version)} className={styles.quietAction}>Open material</Link></header><ArtifactBody artifact={row}/>{row.content.sources.length>0&&<details className={styles.materialDetails}><summary>Sources · {row.content.sources.length}</summary><ul className={styles.collectionSources}>{row.content.sources.map((s,n)=><li key={n}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a><span>Checked {s.observedAt}</span></li>)}</ul></details>}</>:<><h2>Material {i+1} could not load</h2><p>The saved revision may be unavailable. The rest of your collection is still readable.</p><button className={secondary} onClick={()=>setRetry(n=>n+1)}>Retry collection materials</button></>}
   </section>;
  })}</div>
 </section>;
}
