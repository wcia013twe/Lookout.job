"use client";
import {useEffect,useState} from 'react';
import {useWorkspace} from '../lib/workspace';
import {Heading} from './ui';
import NetworkTargets from './network-targets';
import NetworkProcesses from './network-processes';
export default function Network(){
 const w=useWorkspace(),[view,setView]=useState('targets');
 const owner=w.demo?'demo':w.user?.id||'guest';
 useEffect(()=>{setView(new URL(location.href).searchParams.get('view')==='processes'?'processes':'targets');},[]);
 function change(next:string){setView(next);history.replaceState(null,'',`?view=${next}`);}
 return <>
  <Heading title="Network">Build connections at your target companies and move active opportunities forward.</Heading>
  <nav className="mb-7 flex gap-6 border-b border-board-line" aria-label="Network views">
   {[['targets','Targets'],['processes','Active processes']].map(([key,label])=><button type="button" key={key} aria-pressed={view===key} className={`min-h-12 border-b-2 px-1 pb-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-board-accent ${view===key?'border-board-accent text-board-text':'border-transparent text-board-muted hover:text-board-text'}`} onClick={()=>change(key)}>{label}</button>)}
  </nav>
  {view==='targets'?<NetworkTargets key={owner}/>:<NetworkProcesses key={owner} onOpenTarget={id=>{setView('targets');history.replaceState(null,'',`?view=targets&company=${encodeURIComponent(id)}`);}}/>}
 </>;
}
