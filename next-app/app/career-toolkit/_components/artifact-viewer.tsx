'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {artifactDiscussion,artifactHtml,httpsSource,artifactLabels,artifactPurpose,artifactPath} from '../../../../lib/artifacts.mjs';
import {secondary,control} from '../../../components/ui';
import {ToolkitIcon} from './toolkit-icon';
import styles from '../toolkit.module.css';
export type ArtifactContent={title:string;purpose:string;kind:string;format:'markdown'|'html';body:string;weekOf?:string;resourceUrl?:string;scheduledAt?:string;timeZone?:string;durationMinutes?:number;sessionStatus?:string;debriefId?:string;company?:string;preparedFor?:string;prepOn?:string;materials?:{id:string;version:number}[];sources:{title:string;url:string;observedAt:string}[];links:{applicationId?:string;goalId?:string;taskId:string}[]};
export type Artifact={id:string;version:number;archived:boolean;content:ArtifactContent;updated_at:string;path:string;versionPath:string;history?:{version:number;title:string;created_at:string}[]};
export default function ArtifactViewer({artifact,demo,onVersion,onArchive,onPrepDate,locked=false,busy=false,historical=false}:{artifact:Artifact;demo:boolean;onVersion:(v:string)=>void;onArchive:()=>void;onPrepDate?:(date:string)=>Promise<void>;locked?:boolean;busy?:boolean;historical?:boolean}){
 const [discussion,setDiscussion]=useState(false),[message,setMessage]=useState('');
 const [prepOn,setPrepOn]=useState(artifact.content.prepOn||'');
 useEffect(()=>setPrepOn(artifact.content.prepOn||''),[artifact.id,artifact.version,artifact.content.prepOn]);
 const content=artifact.content,prompt=artifactDiscussion(artifact,demo);
 const embedded=content.format==='html';
 return <article aria-label="Saved artifact" className={styles.reader}>
  <header className={styles.readerHeading}><Link className={styles.readerBack} href="/career-toolkit/#workspace">Back to workspace</Link><div><h1>{content.title}</h1>{!embedded&&<p>{artifactPurpose(content)}</p>}</div><button className={`${secondary} gap-2`} onClick={()=>setDiscussion(v=>!v)} aria-expanded={discussion}><ToolkitIcon name="interviews" size={18}/>{content.kind==='mock_interview'&&!artifact.archived&&!historical&&['scheduled','in_progress'].includes(content.sessionStatus||'')?'Start with my agent':'Discuss'}</button></header>
  {onPrepDate&&!['mock_interview','cover_letter','application_template'].includes(content.kind)&&<div className="flex flex-wrap items-center gap-3 py-3 text-sm">
   <label className="flex items-center gap-2 whitespace-nowrap">Prep on<input type="date" aria-label="Prep on" className={`${control} w-auto`} value={prepOn} onChange={e=>setPrepOn(e.target.value)} disabled={busy||locked||historical||artifact.archived}/></label>
   {prepOn!==(content.prepOn||'')&&<button className={secondary} disabled={busy||locked||historical||artifact.archived} onClick={()=>onPrepDate(prepOn)}>{busy?'Saving…':'Save date'}</button>}
   {content.prepOn&&!historical&&<button className={secondary} disabled={busy||locked||artifact.archived} onClick={()=>onPrepDate('')}>Clear date</button>}
   {!content.prepOn&&<span className="text-board-muted">Optional · adds this material to your weekly calendar</span>}
  </div>}
  <details className={styles.materialDetails}><summary>Material details</summary><div className={styles.detailsContent}><div className={styles.readerToolbar}><span className={`${styles.readerType} ${styles.documentType}`}><ToolkitIcon name="documents" size={15}/>{artifactLabels[content.kind as keyof typeof artifactLabels]||content.kind}</span>{content.company&&<span>{content.company}</span>}{content.materials?.length?<span>{content.materials.length} materials · saved revisions</span>:null}{content.preparedFor&&<span>Prepared for {new Date(`${content.preparedFor}T12:00:00Z`).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"})}</span>}{artifact.archived&&<span>Archived · still readable</span>}{historical&&<span>Saved revision</span>}</div>
<div className="flex flex-wrap items-center gap-3"><span className="text-sm text-board-muted">Version {artifact.version}</span>{content.weekOf&&<span className="text-sm text-board-muted">Week of {content.weekOf}</span>}<label className="flex items-center gap-2 text-sm text-board-muted">Revision<select aria-label="Artifact revision" className={`${control} w-auto`} value={historical?String(artifact.version):'latest'} onChange={e=>onVersion(e.target.value)}><option value="latest">Latest</option>{artifact.history?.map(h=><option key={h.version} value={h.version}>Version {h.version}</option>)}</select></label>{!historical&&<button className={secondary} disabled={busy} onClick={onArchive}>{busy?'Saving…':artifact.archived?'Restore to workspace':'Archive'}</button>}</div>
  </div></details>
  {content.sources.length>0&&<section className={styles.readerSources} aria-label="Artifact sources"><h2 className="text-sm font-semibold">Resources</h2><ul>{content.sources.map((source,index)=><li key={`${source.url}:${index}`} className="text-sm leading-relaxed"><a className="break-words text-board-accent underline underline-offset-4" href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a><span className="sr-only"> · Checked {source.observedAt}</span></li>)}</ul></section>}

  {discussion&&<section className={styles.discussionPanel} aria-label="Discuss artifact"><p>Copy this reference to your agent with your question.</p><label className="mt-3 block text-sm">Artifact reference<textarea className={`${control} mt-2 min-h-32`} readOnly value={prompt} onFocus={e=>e.target.select()}/></label><button className={`${secondary} mt-3`} onClick={async()=>{try{await navigator.clipboard.writeText(prompt);setMessage('Artifact reference copied. Paste it into your agent with your question.');}catch{setMessage('Select the reference above and copy it using your browser.');}}}>Copy artifact reference</button><p role="status" className="mt-3 text-sm text-board-muted">{message}</p></section>}
  {content.kind==='mock_interview'&&<p className="my-5 text-sm leading-relaxed">{new Date(content.scheduledAt!).toLocaleString(undefined,{timeZone:content.timeZone})} ({content.timeZone}) · {content.durationMinutes} minutes · {content.sessionStatus}. Call your agent in its app when you are ready. Starting here only gives you the session reference.</p>}
  {content.debriefId&&<Link className="text-board-accent underline" href={artifactPath(content.debriefId)}>Read mock interview feedback</Link>}
  <ArtifactBody artifact={artifact} readOnly={demo}/>

 </article>;
}

export function ArtifactBody({artifact,preview=0,readOnly=false}:{artifact:Artifact;preview?:number;readOnly?:boolean}){
 const content=artifact.content,interactive=content.format==='html';
 const frame=useRef<HTMLIFrameElement>(null);
 useEffect(()=>{
  if(!interactive||!frame.current)return;
  const element=frame.current;
  const fit=()=>{element.style.height=`${Math.max(240,window.innerHeight-element.getBoundingClientRect().top-64)}px`;};
  const observer=new ResizeObserver(fit);observer.observe(element.parentElement!);
  const reader=element.closest('article');if(reader)observer.observe(reader);
  window.addEventListener('resize',fit);fit();
  return()=>{observer.disconnect();window.removeEventListener('resize',fit);};
 },[interactive,artifact.id]);
  return <div className={interactive?styles.interactiveStage:styles.documentStage}>
   {content.resourceUrl&&httpsSource(content.resourceUrl)&&<a className="text-board-accent underline" href={content.resourceUrl} target="_blank" rel="noopener noreferrer">Open resource</a>}
   {interactive?<><iframe ref={frame} key={`${artifact.id}:${artifact.version}:${preview}`} title={content.title} sandbox={readOnly?'':'allow-scripts'} referrerPolicy="no-referrer" allow="camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'" className={styles.activityFrame} srcDoc={artifactHtml(content.body)}/></>:<div className="artifact-document max-w-prose text-base leading-8"><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{a:({href,children})=>httpsSource(href)?<a href={href} target="_blank" rel="noopener noreferrer">{children}</a>:<span>{children}</span>,img:({alt})=><span>{alt||'Image'}</span>}}>{content.body}</ReactMarkdown></div>}
  </div>;
}
