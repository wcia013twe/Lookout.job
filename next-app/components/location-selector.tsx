"use client";
import {useEffect,useId,useState} from 'react';
import {useWorkspace} from '../lib/workspace';
import {searchLocations} from '../lib/location-autocomplete.mjs';
import {Field} from './onboarding-ui';
export default function LocationSelector({value,onChange}:{value:string;onChange:(value:string)=>void}){
 const w=useWorkspace(),id=useId();
 const [open,setOpen]=useState(false),[results,setResults]=useState<string[]>([]),[active,setActive]=useState(-1),[loading,setLoading]=useState(false),[message,setMessage]=useState('');
 const [query,setQuery]=useState('');
 const selected=value.split(';').map(item=>item.trim()).filter(Boolean);
 const key=process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY;
 useEffect(()=>{
  setResults([]);setActive(-1);setMessage('');setLoading(false);
  if(!open||query.trim().length<2)return;
  if(!key&&!w.demo)return;
  const controller=new AbortController();
  const timer=setTimeout(async()=>{
   setLoading(true);
   try{
    const rows=w.demo?['United States','New York, New York, United States','Seattle, Washington, United States'].filter(label=>label.toLowerCase().includes(query.toLowerCase())):await searchLocations(query,{key,signal:controller.signal});
    if(!controller.signal.aborted){setResults(rows);if(!rows.length)setMessage('No matches. You can enter your own location.');}
   }catch{if(!controller.signal.aborted)setMessage('Location search is unavailable. You can still enter a location.');}
   finally{if(!controller.signal.aborted)setLoading(false);}
  },300);
  return ()=>{clearTimeout(timer);controller.abort();};
 },[query,open,key,w.demo]);
 function choose(label:string){
  const next=label==='Open to anywhere'?[label]:[...selected.filter(item=>item!=='Open to anywhere'),label];
  onChange([...new Set(next)].join('; '));setQuery('');setOpen(false);setResults([]);
 }
 function remove(label:string){onChange(selected.filter(item=>item!==label).join('; '));}
 const expanded=open&&results.length>0;
 return <div className="suggested-field" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))setOpen(false);}}>
  {selected.length>0&&<ul aria-label="Selected locations" className="mb-3 flex flex-wrap gap-2">{selected.map(label=><li key={label} className="flex items-center gap-2 rounded-lg bg-board-tag px-3 py-1 text-sm"><span>{label}</span><button type="button" aria-label={`Remove ${label}`} onClick={()=>remove(label)} className="flex min-h-11 min-w-11 items-center justify-center"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 6 12 12M6 18 18 6"/></svg></button></li>)}</ul>}
  <Field label="Where would you like to work?"><input role="combobox" aria-autocomplete="list" aria-expanded={expanded} aria-controls={id} aria-activedescendant={expanded&&active>=0?`${id}-${active}`:undefined} aria-describedby={`${id}-status`} maxLength={160} value={query} placeholder="Search a country or city" onFocus={()=>setOpen(true)} onChange={e=>{setQuery(e.target.value);setOpen(true);}} onKeyDown={e=>{
   if(e.key==='Escape'){setOpen(false);return;}
   if(e.key==='Enter'&&query.trim()&&(!expanded||active<0)){e.preventDefault();choose(query.trim());return;}
   if(!expanded)return;
   if(e.key==='ArrowDown'){e.preventDefault();setActive(index=>(index+1)%results.length);}
   if(e.key==='ArrowUp'){e.preventDefault();setActive(index=>(index-1+results.length)%results.length);}
   if(e.key==='Enter'&&active>=0){e.preventDefault();choose(results[active]);}
  }}/></Field>
  {expanded&&<ul id={id} role="listbox" aria-label="Countries and cities" className="mt-2 divide-y divide-board-line rounded-xl border border-board-line bg-board-panel p-1">{results.map((label,index)=><li key={label} id={`${id}-${index}`} role="option" aria-selected={active===index} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(label)} className={`cursor-pointer rounded-lg px-3 py-3 text-sm ${active===index?'bg-board-tag':'hover:bg-board-tag'}`}>{label}</li>)}</ul>}
  <p id={`${id}-status`} role="status" className="hint">{loading?'Searching locations…':message||'Choose multiple locations, or press Enter to add your own.'}</p>
  <div className="suggestion-pills" role="group" aria-label="Location flexibility">{['Remote','Open to anywhere'].map(label=><button type="button" key={label} aria-pressed={selected.includes(label)} onClick={()=>selected.includes(label)?remove(label):choose(label)}>{label}</button>)}</div>
  <p className="hint">{w.demo?'Fictional location suggestions. No location search leaves this demo.':<a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">Powered by Geoapify</a>}</p>
 </div>;
}
