'use client';
import Link from 'next/link';
import {apiErrorText} from '../../../../lib/api-failure.mjs';
import ApiError from '../../../components/api-error';
import {Fragment,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import {createBackend} from '../../../../backend/client.mjs';
import {artifactLabels,artifactPath,uuid,dateInZone,weekStart,shiftWeek} from '../../../../lib/artifacts.mjs';
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
  {!params.get('artifact')&&<div className={styles.workspaceTopbar}>
  {!params.get('artifact')&&<header className={styles.workspaceHeading}><h1>{tab==='tools'?'Tools & skills':'Career Toolkit'}</h1></header>}
  <nav className={styles.workspaceTabs} aria-label="Career Toolkit sections">{[['workspace','Workspace'],['tools','Tools & skills']].filter(([id])=>id!==tab).map(([id,label])=><Link key={id} href={`/career-toolkit/#${id}`} onClick={()=>setTab(id)} aria-current={tab===id?'page':undefined}><ToolkitIcon name={id==='workspace'?'documents':'all'} size={17}/>{label}</Link>)}</nav></div>}
  {!params.get('artifact')&&tab==='tools'?<ToolkitLibrary/>:<Workspace key={owner||'guest'} w={w} owner={owner} artifactId={params.get('artifact')} revision={params.get('version')}/>}
 </>;
}
function Workspace({w,owner,artifactId,revision}:{w:ReturnType<typeof useWorkspace>;owner?:string;artifactId:string|null;revision:string|null}){
 const router=useRouter();
 const [items,setItems]=useState<Summary[]>([]),[artifact,setArtifact]=useState<Artifact|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[reload,setReload]=useState(0),[busy,setBusy]=useState(false),[feedback,setFeedback]=useState('');
 const [showFilters,setShowFilters]=useState(false);
 const [query,setQuery]=useState(''),[search,setSearch]=useState(''),[kind,setKind]=useState(''),[archived,setArchived]=useState(false),[offset,setOffset]=useState(0),[next,setNext]=useState<number|null>(null);
 const timeZone=w.state.workflow.searchPreferences?.quietMode?.timezone||Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
 const [today,setToday]=useState(()=>dateInZone(timeZone));
 const [selectedWeek,setSelectedWeek]=useState<string|null>(null),[allWeeks,setAllWeeks]=useState(false);
 const week=selectedWeek||weekStart(today);
 const changeWeek=(value:string)=>{setSelectedWeek(value);setOffset(0);};
 useEffect(()=>{const update=()=>setToday(dateInZone(timeZone));const timer=setInterval(update,60000);window.addEventListener('focus',update);return()=>{clearInterval(timer);window.removeEventListener('focus',update);};},[timeZone]);
 const generation=useRef(0);
 const services=useMemo(()=>owner?w.services||createBackend(w.client,owner):null,[owner,w.services,w.client]);
 const stillOwner=()=>w.demo||window.JB?.auth?.userId===owner;
 useEffect(()=>{const t=setTimeout(()=>{setSearch(query);setOffset(0);},250);return()=>clearTimeout(t);},[query]);
 useEffect(()=>{
  const epoch=++generation.current;setLoading(true);setError('');setArtifact(null);setFeedback('');
  if(!services){setItems([]);setLoading(false);return;}
  if(artifactId&&(!uuid(artifactId)||(revision!==null&&!/^[1-9][0-9]*$/.test(revision)))){setError('This artifact link is invalid. Return to the workspace to find your material.');setLoading(false);return;}
  const request=artifactId?services.artifactAction('artifacts.read',{id:artifactId,...(revision?{version:Number(revision)}:{})}):(async()=>{
   const filters={...(search?{query:search}:{}),...(kind?{kind}:{}),archived,shelf:'all',asOf:today,...(!allWeeks?{weekOf:week}:{})};
   const first:Page=await services.artifactAction('artifacts.list',{...filters,offset});
   if(allWeeks)return first;
   const rows=[...first.items];let cursor=first.nextOffset;
   while(cursor!==null&&cursor!==undefined){if(epoch!==generation.current||!stillOwner())return {items:[],nextOffset:null};const page:Page=await services.artifactAction('artifacts.list',{...filters,offset:cursor});rows.push(...page.items);if(page.nextOffset!==null&&page.nextOffset<=cursor)throw Error('Materials could not be loaded. Retry this week.');cursor=page.nextOffset;}
   rows.sort((a,b)=>{const x=a.content.scheduledAt||a.content.preparedFor,y=b.content.scheduledAt||b.content.preparedFor;return x&&y?Date.parse(x)-Date.parse(y)||b.updated_at.localeCompare(a.updated_at):x?-1:y?1:b.updated_at.localeCompare(a.updated_at);});
   return {items:rows,nextOffset:null};
  })();
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
 return <div className="min-w-0">
  <ApiError message={error} onRetry={()=>setReload(n=>n+1)}/>
  {!owner&&<Notice><Link className="text-board-accent underline" href="/profile/">Sign in through Profile</Link> to see the materials your agent has prepared.</Notice>}
  {artifactId?<>{!artifact&&<Link className={styles.backLink} href="/career-toolkit/#workspace">Back to workspace</Link>}{artifact&&!loading&&<ArtifactViewer key={`${artifact.id}:${artifact.version}`} artifact={artifact} demo={!!w.demo} historical={!!revision} onVersion={v=>router.push(artifactPath(artifact.id,v==='latest'?undefined:Number(v)))} onArchive={archive} busy={busy}/>} {artifact&&!loading&&!!artifact.content.materials?.length&&<ArtifactCollection key={`collection:${artifact.id}:${artifact.version}`} materials={artifact.content.materials} read={readMaterial}/>}</>:<>
   <div className={styles.weekToolbar} aria-label="Preparation week">
    <div className={styles.weekNavigation}>
     <button className={styles.quietAction} aria-label="Previous week" disabled={allWeeks} onClick={()=>changeWeek(shiftWeek(week,-1))}><span className={styles.previousChevron}><ToolkitIcon name="chevron" size={16}/></span></button>
     <label className={styles.weekPicker}><span>{allWeeks?'All materials':selectedWeek?'Week of':'This week'}</span>{!allWeeks&&<input aria-label="Week of" type="date" value={week} onChange={e=>{if(e.target.value)changeWeek(weekStart(e.target.value));}}/>}</label>
     <button className={styles.quietAction} aria-label="Next week" disabled={allWeeks} onClick={()=>changeWeek(shiftWeek(week,1))}><ToolkitIcon name="chevron" size={16}/></button>
     {selectedWeek&&!allWeeks&&<button className={styles.quietAction} onClick={()=>{setSelectedWeek(null);setOffset(0);}}>Today</button>}
    </div>
    <div className={styles.toolbarActions}>
     {w.demo&&<span className={styles.demoTag}>Demo</span>}
     <button className={styles.quietAction} onClick={()=>{setAllWeeks(v=>!v);setOffset(0);}}>{allWeeks?'This week':'All materials'}</button>
     <button className={styles.quietAction} aria-expanded={showFilters} onClick={()=>setShowFilters(v=>!v)}><ToolkitIcon name="search" size={16}/>Filter{(search||kind||archived)?' · on':''}</button>
    </div>
   </div>
   <section className={styles.weekContent} aria-label="Weekly materials">
   {showFilters&&   <div className={styles.materialFilters}><label className={styles.materialSearch}><ToolkitIcon name="search" size={18}/><span className="sr-only">Search materials</span><input type="search" placeholder="Search materials" value={query} onChange={e=>setQuery(e.target.value)}/></label><label><span className="sr-only">Artifact category</span><select className={control} value={kind} onChange={e=>{setKind(e.target.value);setOffset(0);}}><option value="">All types</option>{Object.entries(artifactLabels).filter(([id])=>!['cover_letter','application_template'].includes(id)).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><label><span className="sr-only">Artifact collection</span><select className={control} value={archived?'archived':'active'} onChange={e=>{setArchived(e.target.value==='archived');setOffset(0);}}><option value="active">Workspace</option><option value="archived">Archived</option></select></label></div>}
   {!loading&&!error&&<><ul className={allWeeks?styles.savedMaterialList:styles.materialGrid}>{items.map((row,index)=>{
    const linkedId=row.content.links?.find(link=>link.applicationId)?.applicationId;
    const linked=linkedId?Object.values(w.state.workflow.applications as Record<string,any>).find(app=>app.id===linkedId||app.backendId===linkedId):undefined;
    const application=linked?{id:linked.backendId||linked.id,title:linked.title,company:linked.company}:undefined;
    const date=(row.content.scheduledAt?dateInZone(timeZone,new Date(row.content.scheduledAt)):row.content.preparedFor)||'';
    const previous=items[index-1]?.content;
    const previousDate=previous?(previous.scheduledAt?dateInZone(timeZone,new Date(previous.scheduledAt)):previous.preparedFor)||'':null;
    const compact=allWeeks||!['mock_interview','interview_brief','weekly_prep','company_research'].includes(row.content.kind);
    return <Fragment key={row.id}>{!allWeeks&&(index===0||date!==previousDate)&&<li className={styles.timelineHeading}><h2>{date?new Date(date+'T12:00:00Z').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',timeZone:'UTC'}):'Resources & notes'}</h2></li>}{compact?<SavedMaterialRow artifact={row} application={application} demo={!!w.demo}/>:<ArtifactTile artifact={row} application={application} demo={!!w.demo} featured dated={!!date}/>}</Fragment>;
   })}</ul>{!items.length&&<div className="py-12"><h3 className="text-lg font-semibold">{search||kind||archived?'No materials match':allWeeks?'No saved materials':'No preparation saved for this week'}</h3><p className="mt-3 max-w-prose text-sm leading-relaxed text-board-muted">{search||kind||archived?'Try another topic or collection.':'Ask your agent to prepare this week, or browse All materials for reusable work.'}</p></div>}{next!==null&&<button className={`${secondary} mt-4`} onClick={()=>setOffset(next)}>Load more materials</button>}</>}
   </section>
  </>}
  {loading&&<Notice>Loading your materials…</Notice>}
  <p role="status" className="mt-3 text-sm leading-relaxed text-board-muted">{feedback}</p>
  {!artifactId&&<p className={styles.workspaceFoot}><ToolkitIcon name="calendar" size={16}/><Link href="/needs-you/">Open your weekly plan</Link></p>}
 </div>;
}
