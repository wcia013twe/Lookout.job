'use client';
import Link from 'next/link';
import {useEffect,useMemo,useRef,useState} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import {createBackend} from '../../../../backend/client.mjs';
import {artifactLabels,artifactPath,uuid,weeklyPrepRequest} from '../../../../lib/artifacts.mjs';
import {useWorkspace} from '../../../lib/workspace';
import {control,secondary,Notice} from '../../../components/ui';
import ToolkitLibrary from './toolkit-library';
import ArtifactViewer,{type Artifact} from './artifact-viewer';
type Summary=Omit<Artifact,'content'>&{content:Omit<Artifact['content'],'body'>};
export default function ToolkitWorkspace(){
 const w=useWorkspace(),params=useSearchParams();
 const [tab,setTab]=useState('workspace');
 useEffect(()=>{const read=()=>setTab(location.hash&&location.hash!=='#workspace'?'tools':'workspace');read();window.addEventListener('hashchange',read);return()=>window.removeEventListener('hashchange',read);},[]);
 const owner=w.demo?`demo-${w.demoEpoch}`:w.user?.id;
 return <>
  <nav className="mb-7 flex gap-6 border-b border-board-line" aria-label="Career Toolkit sections">{[['workspace','Workspace'],['tools','Tools & skills']].map(([id,label])=><Link key={id} href={`/career-toolkit/#${id}`} onClick={()=>setTab(id)} aria-current={!params.get('artifact')&&tab===id?'page':undefined} className={`min-h-11 border-b-2 py-3 text-sm font-semibold ${tab===id?'border-board-accent text-board-accent':'border-transparent text-board-muted hover:text-board-text'}`}>{label}</Link>)}</nav>
  {!params.get('artifact')&&tab==='tools'?<ToolkitLibrary/>:<Workspace key={owner||'guest'} w={w} owner={owner} artifactId={params.get('artifact')} revision={params.get('version')}/>}
 </>;
}
function Workspace({w,owner,artifactId,revision}:{w:ReturnType<typeof useWorkspace>;owner?:string;artifactId:string|null;revision:string|null}){
 const router=useRouter();
 const [items,setItems]=useState<Summary[]>([]),[artifact,setArtifact]=useState<Artifact|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[reload,setReload]=useState(0),[busy,setBusy]=useState(false),[feedback,setFeedback]=useState('');
 const [query,setQuery]=useState(''),[search,setSearch]=useState(''),[kind,setKind]=useState(''),[archived,setArchived]=useState(false),[offset,setOffset]=useState(0),[next,setNext]=useState<number|null>(null),[showRequest,setShowRequest]=useState(false);
 const generation=useRef(0),requestText=useRef<HTMLTextAreaElement>(null);
 const services=useMemo(()=>owner?w.services||createBackend(w.client,owner):null,[owner,w.services,w.client]);
 const stillOwner=()=>w.demo||window.JB?.auth?.userId===owner;
 useEffect(()=>{const t=setTimeout(()=>{setSearch(query);setOffset(0);},250);return()=>clearTimeout(t);},[query]);
 useEffect(()=>{
  const epoch=++generation.current;setLoading(true);setError('');setArtifact(null);setFeedback('');
  if(!services){setItems([]);setLoading(false);return;}
  if(artifactId&&(!uuid(artifactId)||(revision!==null&&!/^[1-9][0-9]*$/.test(revision)))){setError('This artifact link is invalid. Return to the workspace to find your material.');setLoading(false);return;}
  const request=artifactId?services.artifactAction('artifacts.read',{id:artifactId,...(revision?{version:Number(revision)}:{})}):services.artifactAction('artifacts.list',{...(search?{query:search}:{}),...(kind?{kind}:{}),archived,offset});
  request.then((value:Artifact|{items:Summary[];nextOffset:number|null})=>{if(epoch!==generation.current||!stillOwner())return;if(artifactId)setArtifact(value as Artifact);else{const page=value as {items:Summary[];nextOffset:number|null};setItems(old=>offset?[...old.filter(r=>!page.items.some(n=>n.id===r.id)),...page.items]:page.items);setNext(page.nextOffset);}}).catch(()=>{if(epoch===generation.current)setError(artifactId?'This artifact could not load. Check your connection and account, then retry.':'Your workspace could not load. Check your connection, then retry. The artifact backend may need updating.');}).finally(()=>{if(epoch===generation.current)setLoading(false);});
  return()=>{generation.current++;};
 },[services,artifactId,revision,search,kind,archived,offset,reload]);
 async function archive(){
  if(!artifact||!services||busy||w.locked)return;const epoch=generation.current;setBusy(true);setFeedback('');
  try{await services.artifactAction('artifacts.archive',{id:artifact.id,expectedVersion:artifact.version,archived:!artifact.archived});if(epoch===generation.current&&stillOwner())setReload(n=>n+1);}
  catch{if(epoch===generation.current)setFeedback('Artifact changed or could not save. Reload before trying again.');}
  finally{if(stillOwner())setBusy(false);}
 }
 const prompt=weeklyPrepRequest(!!w.demo);
 return <div className="min-w-0">
  {w.demo&&<Notice>Fictional demo · materials and interactions stay in disposable demo memory.</Notice>}
  {!owner&&<Notice><Link className="text-board-accent underline" href="/profile/">Sign in through Profile</Link> to see the materials your agent has prepared.</Notice>}
  {artifactId?<><Link className="mb-5 inline-flex min-h-11 items-center text-sm text-board-accent underline underline-offset-4" href="/career-toolkit/#workspace">Back to workspace</Link>{artifact&&!loading&&<ArtifactViewer key={`${artifact.id}:${artifact.version}`} artifact={artifact} demo={!!w.demo} historical={!!revision} onVersion={v=>router.push(artifactPath(artifact.id,v==='latest'?undefined:Number(v)))} onArchive={archive} busy={busy}/>}</>:<>
   <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">Prepared for you</h2><p className="mt-2 max-w-prose text-sm leading-relaxed text-board-muted">Briefs, explainers, and practice your agent creates as it prepares your week. Open a material here, or ask your agent to walk you through it.</p></div><button className={secondary} onClick={()=>setShowRequest(v=>!v)} aria-expanded={showRequest}>Plan with my agent</button></div>
   {showRequest&&<section className="mt-6 border-y border-board-line py-5" aria-label="Prepare my week"><h3 className="font-semibold">Your plan, with materials ready</h3><p className="mt-2 text-sm leading-relaxed text-board-muted">Ask your connected agent to prepare your week. It can choose useful formats and save the supporting materials as it plans.</p><label className="mt-4 block text-sm">Agent request<textarea ref={requestText} readOnly className={`${control} mt-2 min-h-44 leading-relaxed`} value={prompt} onFocus={e=>e.target.select()}/></label><button className={`${secondary} mt-3`} onClick={async()=>{try{await navigator.clipboard.writeText(prompt);setFeedback('Request copied. Paste it into your agent to prepare your week.');}catch{requestText.current?.select();setFeedback('The request is selected. Copy it using your browser.');}}}>Copy planning request</button><p className="mt-3 text-xs text-board-muted">Copying does not run your agent or activate recurring preparation.</p></section>}
   <div className="mt-7 flex flex-wrap gap-3"><label className="min-w-0 flex-1"><span className="sr-only">Search artifacts</span><input type="search" className={control} placeholder="Find a company, topic, or material…" value={query} onChange={e=>setQuery(e.target.value)}/></label><label><span className="sr-only">Artifact category</span><select className={control} value={kind} onChange={e=>{setKind(e.target.value);setOffset(0);}}><option value="">All materials</option>{Object.entries(artifactLabels).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><label><span className="sr-only">Artifact collection</span><select className={control} value={archived?'archived':'active'} onChange={e=>{setArchived(e.target.value==='archived');setOffset(0);}}><option value="active">Workspace</option><option value="archived">Archived</option></select></label></div>
   {!loading&&!error&&<><ul className="mt-5 divide-y divide-board-line">{items.map(row=><li key={row.id}><Link href={row.path||artifactPath(row.id)} className="group flex min-h-20 flex-wrap items-center justify-between gap-3 py-5"><div className="min-w-0 flex-1"><h3 className="break-words text-base font-semibold group-hover:text-board-accent">{row.content.title}</h3><p className="mt-1 max-w-prose text-sm leading-relaxed text-board-muted">{row.content.purpose}</p><p className="mt-2 text-xs text-board-muted">{artifactLabels[row.content.kind as keyof typeof artifactLabels]||row.content.kind} · {row.content.format==='html'?'Interactive':'Document'}{row.content.weekOf?` · Week of ${row.content.weekOf}`:''}</p></div><span className="text-sm text-board-accent">Open</span></Link></li>)}</ul>{!items.length&&<div className="py-12"><h3 className="text-lg font-semibold">{search||kind||archived?'No materials match':'A home for the work behind your prep'}</h3><p className="mt-3 max-w-prose text-sm leading-relaxed text-board-muted">{search||kind||archived?'Try another topic or collection.':'When your agent prepares your week, it can save the research, visual explanations, and practice you’ll need here. Ask “Prepare my week, with the materials ready.”'}</p></div>}{next!==null&&<button className={`${secondary} mt-4`} onClick={()=>setOffset(next)}>Load more materials</button>}</>}
  </>}
  {loading&&<Notice>Loading your materials…</Notice>}
  {error&&<div role="alert"><p className="mt-5 text-sm leading-relaxed">{error}</p><button className={`${secondary} mt-3`} onClick={()=>setReload(n=>n+1)}>Retry loading</button></div>}
  <p role="status" className="mt-3 text-sm leading-relaxed text-board-muted">{feedback}</p>
  {!artifactId&&<p className="mt-8 border-t border-board-line pt-5 text-sm leading-relaxed text-board-muted">Your calendar and recorded practice live on the <Link className="text-board-accent underline" href="/needs-you/">Action Board</Link>. Your materials stay here after the week ends.</p>}
 </div>;
}
