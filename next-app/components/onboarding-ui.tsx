"use client";
import {useState,type ReactNode} from "react";
import {motion} from "framer-motion";
export function Dots(){return <span className="rainbow-dots" aria-hidden="true">{[0,1,2,3].map(i=><i key={i}/>)}</span>}
export function Icon({kind="arrow"}:{kind?:string}){return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind==="file"?<><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h4M9 12h6M9 16h6"/></>:kind==="check"?<path d="m5 12 4 4L19 6"/>:<path d="M4 12h16m-6-6 6 6-6 6"/>}</svg>}
export function Button({children,onClick,secondary=false,disabled=false,type="button"}:{children:ReactNode;onClick?:()=>void;secondary?:boolean;disabled?:boolean;type?:"button"|"submit"}){return <motion.button whileTap={{scale:.98}} type={type} className={secondary?"secondary":"primary"} disabled={disabled} onClick={onClick}>{children}{!secondary&&<Icon/>}</motion.button>}
export function Quiet({children,onClick}:{children:ReactNode;onClick:()=>void}){return <button type="button" className="quiet" onClick={onClick}>{children}</button>}
export function Title({children,sub}:{children:ReactNode;sub?:string}){return <><h1>{children}</h1>{sub&&<p className="lead">{sub}</p>}</>}
export function Field({label,children}:{label:string;children:ReactNode}){return <label className="field">{label}{children}</label>}
export function SuggestedField({label,value,options,onChange,placeholder}:{label:string;value:string;options:string[];onChange:(value:string)=>void;placeholder:string}){
 const [query,setQuery]=useState('');
 const selected=value.split(';').map(item=>item.trim()).filter(Boolean);
 function remove(role:string){onChange(selected.filter(item=>item!==role).join('; '));}
 function add(role:string){const clean=role.trim();if(!clean)return;onChange([...new Set([...selected,clean])].join('; '));setQuery('');}
 return <div className="suggested-field">
  <Field label={label}><input maxLength={160} value={query} onChange={e=>setQuery(e.target.value)} placeholder={placeholder} onKeyDown={e=>{if(e.key==='Enter'&&query.trim()){e.preventDefault();add(query);}}}/></Field>
  {query.trim()&&<button type="button" className="quiet" onClick={()=>add(query)}>Add role</button>}
  {selected.length>0&&<ul aria-label="Selected roles" className="my-3 flex flex-wrap gap-2">{selected.map(role=><li key={role} className="flex items-center gap-2 rounded-lg bg-board-tag px-3 py-1 text-sm"><span>{role}</span><button type="button" aria-label={`Remove ${role}`} onClick={()=>remove(role)} className="flex min-h-11 min-w-11 items-center justify-center"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 6 12 12M6 18 18 6"/></svg></button></li>)}</ul>}
  <div className="suggestion-pills" role="group" aria-label={label+" suggestions"}>{options.map(option=><button type="button" key={option} aria-pressed={selected.includes(option)} onClick={()=>selected.includes(option)?remove(option):add(option)}>{option}</button>)}</div>
  <p className="hint">Choose multiple roles, or type your own and press Enter.</p>
 </div>;
}
export function Pills({label,value,options,onChange}:{label:string;value:string;options:string[];onChange:(value:string)=>void}){
 return <fieldset className="job-types preference-pills"><legend>{label}</legend>{options.map(option=><label key={option} className={value===option?"chosen":""}><input type="radio" name={label} checked={value===option} onChange={()=>onChange(option)}/>{option}</label>)}</fieldset>;
}
