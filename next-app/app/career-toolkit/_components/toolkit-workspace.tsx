'use client';
import Link from 'next/link';
import {apiErrorText} from '../../../../lib/api-failure.mjs';
import ApiError from '../../../components/api-error';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import {createBackend} from '../../../../backend/client.mjs';
import {artifactLabels,artifactPath,uuid,weeklyPrepRequest,dateInZone,weekStart,shiftWeek} from '../../../../lib/artifacts.mjs';
import {useWorkspace} from '../../../lib/workspace';
import {control,secondary,Notice} from '../../../components/ui';
import ToolkitLibrary from './toolkit-library';
import ArtifactTile,{SavedMaterialRow,type ArtifactSummary} from './artifact-tile';
import {ToolkitIcon} from './toolkit-icon';
import styles from '../toolkit.module.css';
import ArtifactViewer,{type Artifact} from './artifact-viewer';
import ArtifactCollection from './artifact-collection';
type Summary=ArtifactSummary;
type Page={items:Summary[];nextOffset:number|null};
export default function ToolkitWorkspace(){
 const w=useWorkspace(),params=useSearchParams();
 const [tab,setTab]=useState('workspace');
 useEffect(()=>{const read=()=>setTab(location.hash&&location.hash!=='#workspace'?'tools':'workspace');read();window.addEventListener('hashchange',read);return()=>window.removeEventListener('hashchange',read);},[]);
 const owner=w.demo?`demo-${w.demoEpoch}`:w.user?.id;
 return <>
  {!params.get('artifact')&&<header className={styles.workspaceHeading}><h1>Career Toolkit</h1><p>Your preparation, ready when you are.</p></header>}
  <nav className={styles.workspaceTabs} aria-label="Career Toolkit sections">{[['workspace','Workspace'],['tools','Tools & skills']].map(([id,label])=><Link key={id} href={`/career-toolkit/#${id}`} onClick={()=>setTab(id)} aria-current={tab===id?'page':undefined}><ToolkitIcon name={id==='workspace'?'documents':'all'} size={17}/>{label}</Link>)}</nav>
  {!params.get('artifact')&&tab==='tools'?<ToolkitLibrary/>:<Workspace key={owner||'guest'} w={w} owner={owner} artifactId={params.get('artifact')} revision={params.get('version')}/>}
 </>;
}
function Workspace({w,owner,artifactId,revision}:{w:ReturnType<typeof useWorkspace>;owner?:string;artifactId:string|null;revision:string|null}){
 const router=useRouter();
 const [items,setItems]=useState<Summary[]>([]),[artifact,setArtifact]=useState<Artifact|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[reload,setReload]=useState(0),[busy,setBusy]=useState(false),[feedback,setFeedback]=useState('');
 const [query,setQuery]=useState(''),[search,setSearch]=useState(''),[kind,setKind]=useState(''),[archived,setArchived]=useState(false),[offset,setOffset]=useState(0),[next,setNext]=useState<number|null>(null),[showRequest,setShowRequest]=useState(false);
 const timeZone=w.state.workflow.searchPreferences?.quietMode?.timezone||Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
 const [today,setToday]=useState(()=>dateInZone(timeZone));
 const [selectedWeek,setSelectedWeek]=useState<string|null>(null),[allWeeks,setAllWeeks]=useState(false);
 const week=selectedWeek||weekStart(today);
 const changeWeek=(value:string)=>{setSelectedWeek(value);setOffset(0);};
 useEffect(()=>{const update=()=>setToday(dateInZone(timeZone));const timer=setInterval(update,60000);window.addEventListener('focus',update);return()=>{clearInterval(timer);window.removeEventListener('focus',update);};},[timeZone]);
 const generation=useRef(0),requestText=useRef<HTMLTextAreaElement>(null);
 const services=useMemo(()=>owner?w.services||createBackend(w.client,owner):null,[owner,w.services,w.client]);
 const stillOwner=()=>w.demo||window.JB?.auth?.userId===owner;
 useEffect(()=>{const t=setTimeout(()=>{setSearch(query);setOffset(0);},250);return()=>clearTimeout(t);},[query]);
 useEffect(()=>{
  const epoch=++generation.current;setLoading(true);setError('');setArtifact(null);setFeedback('');
  if(!services){setItems([]);setLoading(false);return;}
  if(artifactId&&(!uuid(artifactId)||(revision!==null&&!/^[1-9][0-9]*$/.test(revision)))){setError('This artifact link is invalid. Return to the workspace to find your material.');setLoading(false);return;}
  const request=artifactId?services.artifactAction('artifacts.read',{id:artifactId,...(revision?{version:Number(revision)}:{})}):services.artifactAction('artifacts.list',{...(search?{query:search}:{}),...(kind?{kind}:{}),archived,offset,shelf:'all',asOf:today,...(!allWeeks?{weekOf:week}:{})});
  request.then((value:Artifact|Page)=>{if(epoch!==generation.current||!stillOwner())return;if(artifactId)setArtifact(value as Artifact);else{const page=value as Page;setItems(old=>offset?[...old.filter(r=>!page.items.some(n=>n.id===r.id)),...page.items]:page.items);setNext(page.nextOffset);}}).catch((failure:unknown)=>{if(epoch===generation.current&&stillOwner())setError(apiErrorText(artifactId?'artifacts.read':'artifacts.list',failure));}).finally(()=>{if(epoch===generation.current)setLoading(false);});
  return()=>{generation.current++;};
 },[services,artifactId,revision,search,kind,archived,offset,today,reload,week,allWeeks]);
 async function archive(){
  if(!artifact||!services||busy||w.locked)return;const epoch=generation.current;setBusy(true);setFeedback('');
  try{await services.artifactAction('artifacts.archive',{id:artifact.id,expectedVersion:artifact.version,archived:!artifact.archived});if(epoch===generation.current&&stillOwner())setReload(n=>n+1);}
  catch(failure){if(epoch===generation.current&&stillOwner())setError(apiErrorText('artifacts.archive',failure));}
  finally{if(stillOwner())setBusy(false);}
 }
 const readMaterial=useCallback((id:string,version:number)=>services!.artifactAction('artifacts.read',{id,version}),[services]);
 const prompt=weeklyPrepRequest(!!w.demo);
 return <div className="min-w-0">
  <ApiError message={error} onRetry={()=>setReload(n=>n+1)}/>
  {w.demo&&<p className={styles.demoLabel}>Demo materials · changes reset with demo mode</p>}
  {!owner&&<Notice><Link className="text-board-accent underline" href="/profile/">Sign in through Profile</Link> to see the materials your agent has prepared.</Notice>}
  {artifactId?<><Link className={styles.backLink} href="/career-toolkit/#workspace">Back to workspace</Link>{artifact&&!loading&&<ArtifactViewer key={`${artifact.id}:${artifact.version}`} artifact={artifact} demo={!!w.demo} historical={!!revision} onVersion={v=>router.push(artifactPath(artifact.id,v==='latest'?undefined:Number(v)))} onArchive={archive} busy={busy}/>} {artifact&&!loading&&!!artifact.content.materials?.length&&<ArtifactCollection key={`collection:${artifact.id}:${artifact.version}`} materials={artifact.content.materials} read={readMaterial}/>}</>:<>
   <div className={styles.shelfHeading}><div><h2>{allWeeks?'All materials':selectedWeek?`Week of ${week}`:'Preparation this week'}</h2><p className={styles.shelfDescription}>{allWeeks?'Reusable resources and saved work.':'Resources, practice and interviews for your week.'}</p></div><button className={styles.agentAction} onClick={()=>setShowRequest(v=>!v)} aria-expanded={showRequest}><ToolkitIcon name="automation" size={18}/>Plan with my agent</button></div>
   {showRequest&&<section className="mt-6 border-y border-board-line py-5" aria-label="Prepare my week"><h3 className="font-semibold">Prepare your week</h3><p className="mt-2 text-sm leading-relaxed text-board-muted">Ask your connected agent to prepare your week. It can select resources, reuse your stories and prepare what you need.</p><label className="mt-4 block text-sm">Agent request<textarea ref={requestText} readOnly className={`${control} mt-2 min-h-44 leading-relaxed`} value={prompt} onFocus={e=>e.target.select()}/></label><button className={`${secondary} mt-3`} onClick={async()=>{try{await navigator.clipboard.writeText(prompt);setFeedback('Request copied. Paste it into your agent to prepare your week.');}catch{requestText.current?.select();setFeedback('The request is selected. Copy it using your browser.');}}}>Copy planning request</button><p className="mt-3 text-xs text-board-muted">Copying does not run your agent or activate recurring preparation.</p></section>}
   <div className="mt-6 flex flex-wrap items-center gap-3" aria-label="Preparation week">
    <button className={secondary} aria-pressed={!allWeeks} onClick={()=>{setAllWeeks(false);setSelectedWeek(null);setOffset(0);}}>This week</button>
    <button className={secondary} aria-pressed={allWeeks} onClick={()=>{setAllWeeks(true);setOffset(0);}}>All materials</button>
    {!allWeeks&&<><button className={secondary} aria-label="Previous week" onClick={()=>changeWeek(shiftWeek(week,-1))}>Previous</button><label className="flex items-center gap-2 text-sm"><span className="whitespace-nowrap">Week of</span><input className={control} type="date" value={week} onChange={e=>{if(e.target.value)changeWeek(weekStart(e.target.value));}}/></label><button className={secondary} aria-label="Next week" onClick={()=>changeWeek(shiftWeek(week,1))}>Next</button></>}
   </div>
   <section className={styles.savedShelf} aria-label="Weekly materials">
   <div className={styles.materialFilters}><label className={styles.materialSearch}><ToolkitIcon name="search" size={18}/><span className="sr-only">Search materials</span><input type="search" placeholder="Search materials" value={query} onChange={e=>setQuery(e.target.value)}/></label><label><span className="sr-only">Artifact category</span><select className={control} value={kind} onChange={e=>{setKind(e.target.value);setOffset(0);}}><option value="">All materials</option>{Object.entries(artifactLabels).filter(([id])=>!['cover_letter','application_template'].includes(id)).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><label><span className="sr-only">Artifact collection</span><select className={control} value={archived?'archived':'active'} onChange={e=>{setArchived(e.target.value==='archived');setOffset(0);}}><option value="active">Workspace</option><option value="archived">Archived</option></select></label></div>
   {!loading&&!error&&<><ul className={allWeeks?styles.savedMaterialList:styles.materialGrid}>{items.map(row=>allWeeks?<SavedMaterialRow key={row.id} artifact={row}/>:<ArtifactTile key={row.id} artifact={row} featured/>)}</ul>{!items.length&&<div className="py-12"><h3 className="text-lg font-semibold">{search||kind||archived?'No materials match':allWeeks?'No saved materials':'No preparation saved for this week'}</h3><p className="mt-3 max-w-prose text-sm leading-relaxed text-board-muted">{search||kind||archived?'Try another topic or collection.':'Ask your agent to prepare this week, or browse All materials for reusable work.'}</p></div>}{next!==null&&<button className={`${secondary} mt-4`} onClick={()=>setOffset(next)}>Load more materials</button>}</>}
   </section>
  </>}
  {loading&&<Notice>Loading your materials…</Notice>}
  <p role="status" className="mt-3 text-sm leading-relaxed text-board-muted">{feedback}</p>
  {!artifactId&&<p className={styles.workspaceFoot}><ToolkitIcon name="calendar" size={16}/><Link href="/needs-you/">Open your weekly plan</Link></p>}
 </div>;
}
