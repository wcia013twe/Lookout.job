"use client";
import type {ReactNode} from "react";
import {motion} from "framer-motion";
export function Dots(){return <span className="rainbow-dots" aria-hidden="true">{[0,1,2,3].map(i=><i key={i}/>)}</span>}
export function Icon({kind="arrow"}:{kind?:string}){return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind==="file"?<><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h4M9 12h6M9 16h6"/></>:kind==="check"?<path d="m5 12 4 4L19 6"/>:<path d="M4 12h16m-6-6 6 6-6 6"/>}</svg>}
export function Button({children,onClick,secondary=false,disabled=false,type="button"}:{children:ReactNode;onClick?:()=>void;secondary?:boolean;disabled?:boolean;type?:"button"|"submit"}){return <motion.button whileTap={{scale:.98}} type={type} className={secondary?"secondary":"primary"} disabled={disabled} onClick={onClick}>{children}{!secondary&&<Icon/>}</motion.button>}
export function Quiet({children,onClick}:{children:ReactNode;onClick:()=>void}){return <button type="button" className="quiet" onClick={onClick}>{children}</button>}
export function Title({children,sub}:{children:ReactNode;sub?:string}){return <><h1>{children}</h1>{sub&&<p className="lead">{sub}</p>}</>}
export function Field({label,children}:{label:string;children:ReactNode}){return <label className="field">{label}{children}</label>}
export function SuggestedField({label,value,options,onChange,placeholder}:{label:string;value:string;options:string[];onChange:(value:string)=>void;placeholder:string}){
 return <div className="suggested-field"><Field label={label}><input required maxLength={160} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/></Field><div className="suggestion-pills" role="group" aria-label={label+" suggestions"}>{options.map(option=><button type="button" key={option} aria-pressed={value===option} onClick={()=>onChange(option)}>{option}</button>)}</div></div>;
}
export function Pills({label,value,options,onChange}:{label:string;value:string;options:string[];onChange:(value:string)=>void}){
 return <fieldset className="job-types preference-pills"><legend>{label}</legend>{options.map(option=><label key={option} className={value===option?"chosen":""}><input type="radio" name={label} checked={value===option} onChange={()=>onChange(option)}/>{option}</label>)}</fieldset>;
}
