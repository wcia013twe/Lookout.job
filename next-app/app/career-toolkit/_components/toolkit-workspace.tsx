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
import ArtifactViewer,{type Artifact,type ArtifactContent} from './artifact-viewer';
import MaterialEditor from './material-editor';
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
 const router=useRouter(),params=useSearchParams();
 const [planner,setPlanner]=useState<any>(null),[editing,setEditing]=useState(false),[newKind,setNewKind]=useState<string|null>(null);
 const [session,setSession]=useState<{applicationId:string;taskId:string;minutes:number;sessionId:string}|null>(null);
 const mutation=useRef(false);
 const [items,setItems]=useState<Summary[]>([]),[artifact,setArtifact]=useState<Artifact|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[reload,setReload]=useState(0),[busy,setBusy]=useState(false),[feedback,setFeedback]=useState('');
 const archived=false,offset=0;
 const timeZone=w.state.workflow.searchPreferences?.quietMode?.timezone||Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
 const [today,setToday]=useState(()=>dateInZone(timeZone));
 useEffect(()=>{const update=()=>setToday(dateInZone(timeZone));const timer=setInterval(update,60000);window.addEventListener('focus',update);return()=>{clearInterval(timer);window.removeEventListener('focus',update);};},[timeZone]);
 const generation=useRef(0);
 const services=useMemo(()=>owner?w.services||createBackend(w.client,owner):null,[owner,w.services,w.client]);
 const stillOwner=()=>w.demo||window.JB?.auth?.userId===owner;
 useEffect(()=>{
  let current=true;
  if(!services){setPlanner(null);return;}
  services.readPreparationPlanner().then((value:any)=>{if(current&&stillOwner())setPlanner(value);}).catch(()=>{if(current&&stillOwner())setError('Preparation tasks could not load. Retry before recording practice.');});
  return()=>{current=false;};
 },[services,reload]);
 useEffect(()=>{setEditing(false);setNewKind(null);setSession(null);},[artifactId,revision]);
 useEffect(()=>{
  const epoch=++generation.current;setLoading(true);setError('');setArtifact(null);setFeedback('');
  if(!services){setItems([]);setLoading(false);return;}
  if(artifactId&&(!uuid(artifactId)||(revision!==null&&!/^[1-9][0-9]*$/.test(revision)))){setError('This artifact link is invalid. Return to the workspace to find your material.');setLoading(false);return;}
  const request=artifactId?services.artifactAction('artifacts.read',{id:artifactId,...(revision?{version:Number(revision)}:{})}):(async()=>{
   const filters={archived,shelf:'all',asOf:today};
   const first:Page=await services.artifactAction('artifacts.list',{...filters,offset});
   const rows=[...first.items];let cursor=first.nextOffset;
   while(cursor!==null&&cursor!==undefined){if(epoch!==generation.current||!stillOwner())return {items:[],nextOffset:null};const page:Page=await services.artifactAction('artifacts.list',{...filters,offset:cursor});rows.push(...page.items);if(page.nextOffset!==null&&page.nextOffset<=cursor)throw Error('Materials could not be loaded. Retry this week.');cursor=page.nextOffset;}
   const detailed=rows.filter(row=>['story_bank','notes'].includes(row.content.kind));
   let detailIndex=0;
   await Promise.all(Array.from({length:Math.min(4,detailed.length)},async()=>{
    while(detailIndex<detailed.length){const row=detailed[detailIndex++];if(epoch!==generation.current||!stillOwner())return;const full:Artifact=await services.artifactAction('artifacts.read',{id:row.id,version:row.version});Object.assign(row,full);}
   }));
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
 function materialPath(id:string,version?:number){
  const query=new URLSearchParams(artifactPath(id,version).split('?')[1]||'');
  const back=params.get('return');
  if(back?.startsWith('/career-toolkit/?'))query.set('return',back);
  return `/career-toolkit/?${query}`;
 }
 async function saveMaterial(content:ArtifactContent){
  if(!services||w.locked||mutation.current||revision)return;
  const epoch=generation.current;mutation.current=true;setBusy(true);setError('');
  const id=artifact?.id||crypto.randomUUID();
  try{
   const selected=Object.values({...planner?.applications,...w.state.workflow.applications} as Record<string,any>).find(application=>[application.id,application.backendId].includes(params.get('application')));
   const linked=!artifact&&selected?{...content,links:[...content.links,{applicationId:selected.backendId||selected.id}]}:content;
   await services.artifactAction('artifacts.save',{...linked,id,expectedVersion:artifact?.version||0});
   const saved=await services.artifactAction('artifacts.read',{id});
   if(epoch!==generation.current||!stillOwner())return;
   setEditing(false);setNewKind(null);setFeedback('Saved. Earlier revisions remain available.');
   if(artifact)setArtifact(saved);
   else{const query=new URLSearchParams({artifact:id,return:`/career-toolkit/?${params}`});router.push(`/career-toolkit/?${query}`);}
  }catch(failure){if(epoch===generation.current&&stillOwner())setError(apiErrorText('artifacts.save',failure));throw failure;}
  finally{mutation.current=false;if(stillOwner())setBusy(false);}
 }
 async function chooseTask(applicationId:string,taskId:string){
  const row=planner?.plans.find((candidate:any)=>candidate.application_id===applicationId),task=row?.plan.tasks.find((candidate:any)=>candidate.id===taskId);
  if(!task||task.completed||w.locked)return;
  setSession({applicationId,taskId,minutes:task.minutes,sessionId:crypto.randomUUID()});
 }
 async function recordSession(){
  if(!session||!services||!planner||w.locked||mutation.current)return;
  const row=planner.plans.find((candidate:any)=>candidate.application_id===session.applicationId);
  if(!row)return;
  const epoch=generation.current;mutation.current=true;setBusy(true);setError('');
  try{
   const value=await services.completePreparationSession({sessionId:session.sessionId,minutes:session.minutes,targets:[{applicationId:session.applicationId,taskId:session.taskId,expectedVersion:row.version}]});
   if(epoch===generation.current&&stillOwner()){setPlanner(value);setSession(null);setFeedback('Practice recorded. Task progress is saved.');}
  }catch{if(epoch===generation.current&&stillOwner())setError('Practice could not save or the plan changed. Retry loading before recording again.');}
  finally{mutation.current=false;if(stillOwner())setBusy(false);}
 }
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
  {artifactId?<>{!artifact&&<Link className={styles.backLink} href="/career-toolkit/#workspace">Back to workspace</Link>}{artifact&&!loading&&(editing?<MaterialEditor artifact={artifact} busy={busy} onSave={saveMaterial} onCancel={()=>setEditing(false)}/>:<ArtifactViewer key={`${artifact.id}:${artifact.version}`} artifact={artifact} demo={!!w.demo} historical={!!revision} onEdit={()=>setEditing(true)} onVersion={v=>router.push(materialPath(artifact.id,v==='latest'?undefined:Number(v)))} onArchive={archive} onPrepDate={savePrepDate} onFeedback={saveMaterialFeedback} locked={w.locked} busy={busy}/>)} {artifact&&!loading&&!editing&&!!artifact.content.materials?.length&&<ArtifactCollection key={`collection:${artifact.id}:${artifact.version}`} materials={artifact.content.materials} read={readMaterial}/>}</>:<>
   {newKind?<MaterialEditor kind={newKind} busy={busy} onSave={saveMaterial} onCancel={()=>setNewKind(null)}/>:<>
   {session&&<form className="mb-6 space-y-3 rounded-xl border border-board-border p-4" onSubmit={event=>{event.preventDefault();void recordSession();}}><h2 className="font-semibold">Record completed practice</h2><p className="text-sm text-board-muted">Only record time you actually spent. Opening material does not complete a task.</p><label className="block">Minutes practiced <input className="ml-2 w-24 rounded border border-board-border bg-board-surface p-2" type="number" min="1" max="240" required value={session.minutes} onChange={event=>setSession({...session,minutes:Number(event.target.value)})}/></label><button className="mr-4 underline" disabled={busy||w.locked}>Save practice</button><button type="button" className="underline" disabled={busy} onClick={()=>setSession(null)}>Cancel</button></form>}
   <InterviewPrep items={items} applications={Object.values({...planner?.applications,...w.state.workflow.applications})} plans={(planner?.plans||[]).map((row:any)=>({...row.plan,applicationId:row.application_id,version:row.version}))} onCompleteTask={chooseTask} onCreate={owner&&!w.locked?setNewKind:undefined} busy={busy||w.locked} demo={!!w.demo}/>
   </>}
  </>}
  {loading&&<Notice>Loading your materials…</Notice>}

 </div>;
}
