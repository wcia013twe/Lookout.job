'use client';
import {useEffect,useRef,useState} from 'react';
import {control,secondary} from '../../../components/ui';

export type MaterialFeedbackValue={version:number;revision:number;useful:boolean;note:string;source:'user'|'agent_reported';updated_at:string};

export function MaterialFeedback({initial,onSave,locked=false}:{initial?:MaterialFeedbackValue|null;onSave:(value:{expectedRevision:number;useful:boolean;note:string})=>Promise<MaterialFeedbackValue>;locked?:boolean}){
 const [saved,setSaved]=useState(initial),[note,setNote]=useState(initial?.note||''),[editing,setEditing]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const active=useRef(true),saving=useRef(false);
 useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 async function save(useful:boolean){
  if(locked||saving.current)return;
  saving.current=true;setBusy(true);setError('');
  try{
   const result=await onSave({expectedRevision:saved?.revision||0,useful,note});
   if(active.current){setSaved(result);setEditing(!saved);}
  }catch(failure){if(active.current)setError(failure instanceof Error?failure.message:'Could not save feedback. Try again.');}
  finally{saving.current=false;if(active.current)setBusy(false);}
 }
 return <section aria-label="Material usefulness" className="mt-8 border-t border-board-border pt-4 text-sm">
  <div className="flex flex-wrap items-center gap-3">
   <span>{saved?'Your feedback':'Was this useful?'}</span>
   <button className={secondary} aria-pressed={saved?.useful===true} disabled={locked||busy} onClick={()=>save(true)}>Yes{saved?.useful===true?' ✓':''}</button>
   <button className={secondary} aria-pressed={saved?.useful===false} disabled={locked||busy} onClick={()=>save(false)}>Not really{saved?.useful===false?' ✓':''}</button>
   <span role="status" className="text-board-muted">{busy?'Saving…':saved?'Saved for this version':''}</span>
   {saved&&!editing&&<button className="text-board-accent underline underline-offset-4" onClick={()=>setEditing(true)}>{saved.note?'Edit note':'Add a note'}</button>}
  </div>
  {saved&&editing&&<form className="mt-3 max-w-xl" onSubmit={event=>{event.preventDefault();void save(saved.useful);}}>
   <label>What would make it better? <span className="text-board-muted">(optional)</span><textarea className={`${control} mt-2`} maxLength={2000} rows={2} value={note} disabled={locked||busy} onChange={event=>setNote(event.target.value)}/></label>
   <div className="mt-2 flex gap-3"><button className={secondary} disabled={locked||busy||note===saved.note}>Save note</button><button type="button" disabled={busy} onClick={()=>{setNote(saved.note);setEditing(false);}}>Close</button></div>
  </form>}
  {error&&<p role="alert" className="mt-2">{error}</p>}
 </section>;
}
