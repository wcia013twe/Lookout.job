'use client';
import {useMemo,useState} from 'react';
import Link from 'next/link';
import {usePathname,useRouter,useSearchParams} from 'next/navigation';
import {applicationRounds} from '../../../../lib/application-rounds.mjs';
import {artifactPath} from '../../../../lib/artifacts.mjs';
import {CompanyLogo} from '../../../components/company-logo';
import {ToolkitIcon} from './toolkit-icon';
import ArtifactTile,{SavedMaterialRow,type ArtifactSummary} from './artifact-tile';
import styles from '../interview-prep.module.css';

type Props={items:any[];applications:any[];demo:boolean};
type Tab='interviews'|'answers'|'practice';
type Pipeline='Overview'|'Research'|'Rounds'|'Notes';
const tabs:{id:Tab;label:string}[]=[{id:'interviews',label:'Interviews'},{id:'answers',label:'Answers'},{id:'practice',label:'Practice'}];
const pipelines:Pipeline[]=['Overview','Research','Rounds','Notes'];
const tabFor=(kind:string):Tab=>kind==='story_bank'?'answers':['practice','mock_interview','resource','explainer'].includes(kind)?'practice':'interviews';
const roundType=(value:string)=>value.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
function linkFor(item:any){return item.path||artifactPath(item.id,item.version);}
export default function InterviewPrep({items,applications,demo}:Props){
 const router=useRouter(),pathname=usePathname(),params=useSearchParams();
 const tab=(tabs.some(t=>t.id===params.get('tab'))?params.get('tab'):'interviews') as Tab;
 const pipeline=(pipelines.includes(params.get('view') as Pipeline)?params.get('view'):'Overview') as Pipeline;
 const selected=params.get('application');
 const [search,setSearch]=useState('');
 const selectedRound=params.get('round');
 const application=applications.find(app=>app.id===selected||app.backendId===selected);
 const roundRows=useMemo(()=>applications.flatMap(app=>{
  const explicit=items.find(item=>item.content?.links?.some((l:any)=>l.applicationId&&(l.applicationId===app.id||l.applicationId===app.backendId)));
  return applicationRounds(app).filter((r:any)=>!r.cancelled).map((round:any)=>({app,round,explicit:items.find(item=>item.content?.links?.some((l:any)=>l.taskId===round.id))}));
 }),[applications,items]);
 const appItems=items.filter(item=>item.content?.links?.some((l:any)=>l.applicationId&&(l.applicationId===selected||l.applicationId===application?.backendId)));
 const tabItems=items.filter(item=>tabFor(item.content?.kind||'')===tab);
 const query=(next:Record<string,string|null>)=>{const value=new URLSearchParams(params.toString());for(const [key,v] of Object.entries(next)){if(v)value.set(key,v);else value.delete(key);}router.push(`${pathname}?${value.toString()}`,{scroll:false});};
 const artifactHref=(item:any)=>`${linkFor(item)}&return=${encodeURIComponent(`${pathname}?${params.toString()}`)}`;
 const roundFocus=roundRows.find(({round,app})=>round.id===selectedRound&&(app.id===selected||app.backendId===selected));
 const matching=(text:string)=>!search||text.toLowerCase().includes(search.toLowerCase());
 return <section className={styles.root} aria-label="Interview preparation">
  <header className={styles.heading}><div><p className={styles.eyebrow}>CAREER TOOLKIT</p><h1>Interview prep</h1><p>Keep research, rounds, answers, and practice together.</p></div>{demo&&<span className={styles.demo}>Demo</span>}</header>
  <nav className={styles.tabs} aria-label="Interview prep tabs">{tabs.map(item=><button type="button" key={item.id} aria-current={tab===item.id?'page':undefined} onClick={()=>query({tab:item.id,application:null,round:null,view:null})}>{item.id==='answers'?'Answer Bank':item.label}<span>{item.id==='interviews'?applications.length:item.id==='answers'?items.filter(i=>i.content?.kind==='story_bank').length:items.filter(i=>['practice','mock_interview','resource','explainer'].includes(i.content?.kind)).length}</span></button>)}</nav>
  <label className={styles.search}><span className="sr-only">Search interview prep</span><input type="search" placeholder="Search companies, rounds, or materials" value={search} onChange={event=>setSearch(event.target.value)}/></label>
  {tab==='interviews'&&<>
   <nav className={styles.pipeline} aria-label="Interview pipeline">{pipelines.map(view=><button type="button" key={view} aria-pressed={pipeline===view} onClick={()=>query({view,round:null})}>{view}</button>)}</nav>
   {application&&<div className={styles.focus}><button type="button" className={styles.back} onClick={()=>query({application:null,round:null})}>← All interviews</button><div className={styles.company}><CompanyLogo company={application.company||''}/><div><h2>{application.title||'Application'}</h2><p>{application.company||'Company not provided'}</p></div></div>
    {roundFocus?<article className={styles.roundDetail}><button type="button" className={styles.back} onClick={()=>query({round:null})}>← Application rounds</button><h3>{roundFocus.round.label}</h3><p>{roundType(roundFocus.round.type)} · {roundFocus.round.phase}{roundFocus.round.date?` · ${roundFocus.round.date}`:''}</p>{roundFocus.round.notes?<p className={styles.notes}>{roundFocus.round.notes}</p>:<p className={styles.muted}>No notes saved for this round.</p>}</article>:<>
    {pipeline==='Rounds'&&<section className={styles.section}><h3>Recorded rounds</h3>{applicationRounds(application).filter((r:any)=>!r.cancelled).length?<ul className={styles.list}>{applicationRounds(application).filter((r:any)=>!r.cancelled).map((round:any)=><li key={round.id}><button type="button" className={styles.roundRow} onClick={()=>query({round:round.id})}><span><strong>{round.label}</strong><small>{roundType(round.type)} · {round.phase}{round.date?` · ${round.date}`:''}</small></span><ToolkitIcon name="chevron" size={17}/></button></li>)}</ul>:<p className={styles.empty}>No interview rounds are recorded yet.</p>}</section>}
    {pipeline==='Research'&&<ArtifactSection title="Research" items={appItems.filter(i=>['company_research','interview_brief','weekly_prep','resource','explainer'].includes(i.content?.kind)&&(!selectedRound||i.content?.links?.some((l:any)=>l.taskId===selectedRound))&&matching(i.content?.title||''))} demo={demo} empty="No research is linked to this application or selected round." onOpen={artifactHref}/>}
    {(pipeline==='Notes'||pipeline==='Overview')&&<ArtifactSection title="Notes & saved prep" items={appItems.filter(i=>!['company_research','interview_brief','weekly_prep'].includes(i.content?.kind))} demo={demo} empty="No artifacts explicitly linked to this application yet." onOpen={artifactHref}/>}
    {pipeline==='Overview'&&<section className={styles.section}><h3>Rounds</h3>{applicationRounds(application).filter((r:any)=>!r.cancelled).length?<ul className={styles.list}>{applicationRounds(application).filter((r:any)=>!r.cancelled).map((round:any)=><li key={round.id}><button type="button" className={styles.roundRow} onClick={()=>query({view:'Rounds',round:round.id})}><span><strong>{round.label}</strong><small>{roundType(round.type)} · {round.phase}{round.date?` · ${round.date}`:''}</small></span><ToolkitIcon name="chevron" size={17}/></button></li>)}</ul>:<p className={styles.empty}>No interview rounds are recorded yet.</p>}</section>}
    </>}
   </div>}
   {!application&&<>
    {pipeline==='Overview'&&<section className={styles.section}><div className={styles.sectionHeading}><h2>Applications</h2><span>{applications.length}</span></div>{applications.length?<ul className={styles.list}>{applications.filter((app:any)=>matching(`${app.company||''} ${app.title||''}`)).map((app:any,index:number)=><li key={app.id||app.backendId||index}><button type="button" className={styles.applicationRow} onClick={()=>query({application:app.id||app.backendId,round:null})}><CompanyLogo company={app.company||''}/><span><strong>{app.title||'Application'}</strong><small>{app.company||'Company not provided'} · {app.status||'In progress'}</small></span><ToolkitIcon name="chevron" size={18}/></button></li>)}</ul>:<p className={styles.empty}>Your tracked applications will appear here.</p>}</section>}
    {pipeline==='Research'&&<ArtifactSection title="Research" items={items.filter(i=>['company_research','interview_brief','weekly_prep'].includes(i.content?.kind))} demo={demo} empty="Saved company research and interview briefs appear here." onOpen={artifactHref}/>}
    {pipeline==='Rounds'&&<section className={styles.section}><h2>Recorded rounds</h2>{roundRows.length?<ul className={styles.list}>{[...roundRows].sort((a,b)=>(a.round.date||'9999').localeCompare(b.round.date||'9999')).filter(({app,round}:any)=>matching(`${app.company||''} ${round.label}`)).map(({app,round}:any)=><li key={`${app.id}:${round.id}`}><button type="button" className={styles.roundRow} onClick={()=>query({application:app.id||app.backendId,round:round.id})}><span><strong>{round.label}</strong><small>{app.company||app.title} · {roundType(round.type)} · {round.phase}{round.date?` · ${round.date}`:''}</small></span><ToolkitIcon name="chevron" size={17}/></button></li>)}</ul>:<p className={styles.empty}>No interview rounds are recorded in your applications yet.</p>}</section>}
    {pipeline==='Notes'&&<ArtifactSection title="Notes & prep materials" items={items.filter(i=>!['company_research','interview_brief','weekly_prep'].includes(i.content?.kind))} demo={demo} empty="No saved notes or prep materials yet." onOpen={artifactHref}/>}
   </>}
  </>}
  {tab!=='interviews'&&<ArtifactSection title={tab==='answers'?'Saved answers & stories':'Practice materials'} items={tabItems} demo={demo} empty={tab==='answers'?'Saved story banks and reusable answers will appear here.':'Practice activities and mock interview materials will appear here.'} onOpen={artifactHref}/>}
  {!application&&tab==='interviews'&&pipeline==='Overview'&&<ArtifactSection title="Personal prep" items={items.filter(i=>!i.content?.links?.some((l:any)=>l.applicationId))} demo={demo} empty="Unassigned research, notes, answers, and practice stay accessible here." onOpen={artifactHref}/>}
 </section>;
}
function ArtifactSection({title,items,demo,empty,onOpen}:{title:string;items:any[];demo:boolean;empty:string;onOpen:(item:any)=>string}){return <section className={styles.section}><div className={styles.sectionHeading}><h2>{title}</h2><span>{items.length}</span></div>{items.length?<ul className={styles.artifacts}>{items.map((item:any)=><li key={item.id}><SavedMaterialRow artifact={item as ArtifactSummary} demo={demo}/><Link className={styles.open} href={onOpen(item)}>Open</Link></li>)}</ul>:<p className={styles.empty}>{empty}</p>}</section>}
