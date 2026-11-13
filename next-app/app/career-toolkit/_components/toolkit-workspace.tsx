'use client';
import BoardReturn from '../../../components/board-return';
import Link from 'next/link';
import {apiErrorText} from '../../../../lib/api-failure.mjs';
import ApiError from '../../../components/api-error';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import {createBackend} from '../../../../backend/client.mjs';
import {artifactPath,artifactPrepDate,uuid,dateInZone} from '../../../../lib/artifacts.mjs';
import {useWorkspace} from '../../../lib/workspace';
import {Notice} from '../../../components/ui';
import ToolkitLibrary from './toolkit-library';
import {type ArtifactSummary} from './artifact-tile';
import {ToolkitIcon} from './toolkit-icon';
import styles from '../toolkit.module.css';
import ArtifactViewer,{type Artifact} from './artifact-viewer';
import ArtifactCollection from './artifact-collection';
import InterviewPrep from './interview-prep';
type Summary=ArtifactSummary;
type Page={items:Summary[];nextOffset:number|null};
export default function ToolkitWorkspace(){
 const w=useWorkspace(),params=useSearchParams();
 const [tab,setTab]=useState('workspace');
 useEffect(()=>{const read=()=>setTab(location.hash&&location.hash!=='#workspace'?'tools':'workspace');read();window.addEventListener('hashchange',read);return()=>window.removeEventListener('hashchange',read);},[]);
 const owner=w.demo?`demo-${w.demoEpoch}`:w.user?.id;
 return <><BoardReturn/>
  {!params.get('artifact')&&<div className={styles.workspaceTopbar}>
  {!params.get('artifact')&&<header className={styles.workspaceHeading}><h1>{tab==='tools'?'Tools & skills':'Interview Prep'}</h1></header>}
  <nav className={styles.workspaceTabs} aria-label="Prep sections">{[['workspace','Workspace'],['tools','Tools & skills']].filter(([id])=>id!==tab).map(([id,label])=><Link key={id} href={`/career-toolkit/#${id}`} onClick={()=>setTab(id)} aria-current={tab===id?'page':undefined}><ToolkitIcon name={id==='workspace'?'documents':'all'} size={17}/>{label}</Link>)}</nav></div>}
  {!params.get('artifact')&&tab==='tools'?<ToolkitLibrary/>:<Workspace key={owner||'guest'} w={w} owner={owner} artifactId={params.get('artifact')} revision={params.get('version')}/>}
 </>;
}
function Workspace({w,owner,artifactId,revision}:{w:ReturnType<typeof useWorkspace>;owner?:string;artifactId:string|null;revision:string|null}){
 const router=useRouter();
 const [items,setItems]=useState<Summary[]>([]),[artifact,setArtifact]=useState<Artifact|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[reload,setReload]=useState(0),[busy,setBusy]=useState(false),[feedback,setFeedback]=useState('');
 const archived=false,offset=0;
 const timeZone=w.state.workflow.searchPreferences?.quietMode?.timezone||Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
 const [today,setToday]=useState(()=>dateInZone(timeZone));
 useEffect(()=>{const update=()=>setToday(dateInZone(timeZone));const timer=setInterval(update,60000);window.addEventListener('focus',update);return()=>{clearInterval(timer);window.removeEventListener('focus',update);};},[timeZone]);
 const generation=useRef(0);
 const services=useMemo(()=>owner?w.services||createBackend(w.client,owner):null,[owner,w.services,w.client]);
 const stillOwner=()=>w.demo||window.JB?.auth?.userId===owner;
 useEffect(()=>{
  const epoch=++generation.current;setLoading(true);setError('');setArtifact(null);setFeedback('');
  if(!services){setItems([]);setLoading(false);return;}
  if(artifactId&&(!uuid(artifactId)||(revision!==null&&!/^[1-9][0-9]*$/.test(revision)))){setError('This artifact link is invalid. Return to the workspace to find your material.');setLoading(false);return;}
  const request=artifactId?services.artifactAction('artifacts.read',{id:artifactId,...(revision?{version:Number(revision)}:{})}):(async()=>{
   const filters={archived,shelf:'all',asOf:today};
   const first:Page=await services.artifactAction('artifacts.list',{...filters,offset});
   const rows=[...first.items];let cursor=first.nextOffset;
   while(cursor!==null&&cursor!==undefined){if(epoch!==generation.current||!stillOwner())return {items:[],nextOffset:null};const page:Page=await services.artifactAction('artifacts.list',{...filters,offset:cursor});rows.push(...page.items);if(page.nextOffset!==null&&page.nextOffset<=cursor)throw Error('Materials could not be loaded. Retry this week.');cursor=page.nextOffset;}
   rows.sort((a,b)=>{const x=artifactPrepDate(a.content,timeZone),y=artifactPrepDate(b.content,timeZone);return x&&y?Date.parse(x)-Date.parse(y)||b.updated_at.localeCompare(a.updated_at):x?-1:y?1:b.updated_at.localeCompare(a.updated_at);});
   return {items:rows,nextOffset:null};
  })();
  request.then((value:Artifact|Page)=>{if(epoch!==generation.current||!stillOwner())return;if(artifactId)setArtifact(value as Artifact);else{const page=value as Page;setItems(old=>offset?[...old.filter(r=>!page.items.some(n=>n.id===r.id)),...page.items]:page.items);}}).catch((failure:unknown)=>{if(epoch===generation.current&&stillOwner())setError(apiErrorText(artifactId?'artifacts.read':'artifacts.list',failure));}).finally(()=>{if(epoch===generation.current)setLoading(false);});
  return()=>{generation.current++;};
 },[services,artifactId,revision,today,reload]);
 async function savePrepDate(prepOn:string){
  if(!artifact||!services||busy||w.locked||revision)return;
  const epoch=generation.current;setBusy(true);setFeedback('');
  try{
   const {prepOn:oldDate,...content}=artifact.content;
   await services.artifactAction('artifacts.save',{...content,...(prepOn?{prepOn}:{}),id:artifact.id,expectedVersion:artifact.version});
   const saved=await services.artifactAction('artifacts.read',{id:artifact.id});
   if(epoch===generation.current&&stillOwner()){setArtifact(saved);setFeedback(prepOn?'Prep date saved. Your calendar is updated.':'Prep date cleared. The material remains saved.');}
  }catch(failure){if(epoch===generation.current&&stillOwner())setError(apiErrorText('artifacts.save',failure));}
  finally{if(stillOwner())setBusy(false);}
 }
 async function archive(){
  if(!artifact||!services||busy||w.locked)return;const epoch=generation.current;setBusy(true);setFeedback('');
  try{await services.artifactAction('artifacts.archive',{id:artifact.id,expectedVersion:artifact.version,archived:!artifact.archived});if(epoch===generation.current&&stillOwner())setReload(n=>n+1);}
  catch(failure){if(epoch===generation.current&&stillOwner())setError(apiErrorText('artifacts.archive',failure));}
  finally{if(stillOwner())setBusy(false);}
 }
 const readMaterial=useCallback((id:string,version:number)=>services!.artifactAction('artifacts.read',{id,version}),[services]);
 async function saveMaterialFeedback(value:{expectedRevision:number;useful:boolean;note:string}){
  if(!artifact||!services||w.locked)throw Error('Sign in to save feedback.');
  const epoch=generation.current;
  const result=await services.artifactAction('artifacts.feedback.save',{id:artifact.id,version:artifact.version,...value});
  if(epoch!==generation.current||!stillOwner())throw Error('The selected material changed.');
  return result;
 }
 return <div className="min-w-0">
  {feedback&&<p role="status" className="mb-3 text-sm text-board-muted">{feedback}</p>}
  <ApiError message={error} onRetry={()=>setReload(n=>n+1)}/>
  {!owner&&<Notice><Link className="text-board-accent underline" href="/profile/">Sign in through Profile</Link> to see the materials your agent has prepared.</Notice>}
  {artifactId?<>{!artifact&&<Link className={styles.backLink} href="/career-toolkit/#workspace">Back to workspace</Link>}{artifact&&!loading&&<ArtifactViewer key={`${artifact.id}:${artifact.version}`} artifact={artifact} demo={!!w.demo} historical={!!revision} onVersion={v=>router.push(artifactPath(artifact.id,v==='latest'?undefined:Number(v)))} onArchive={archive} onPrepDate={savePrepDate} onFeedback={saveMaterialFeedback} locked={w.locked} busy={busy}/>} {artifact&&!loading&&!!artifact.content.materials?.length&&<ArtifactCollection key={`collection:${artifact.id}:${artifact.version}`} materials={artifact.content.materials} read={readMaterial}/>}</>:<>
   <InterviewPrep items={items} applications={Object.values(w.state.workflow.applications)} demo={!!w.demo}/>
  </>}
  {loading&&<Notice>Loading your materials…</Notice>}

 </div>;
}
