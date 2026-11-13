"use client";
import {useCallback,useId,useMemo,useRef,useState,useSyncExternalStore} from 'react';
import {createBackend} from '../../backend/client.mjs';
import {useWorkspace} from '../lib/workspace';
import {createFeedbackCache,emptyFeedback,feedbackTargetAvailable} from '../lib/recommendation-feedback.mjs';
import {createDemoFeedbackServices} from '../lib/recommendation-feedback-demo.mjs';
import ProfileIcon from './profile-icon';
import {control,primary,secondary} from './ui';

type Kind='job'|'network'|'planning';
type Props={kind?:Kind;targetId:string;target:string;context?:object};
const caches=new WeakMap<object,Map<string,ReturnType<typeof createFeedbackCache>>>();

export default function RecommendationFeedback(props:Props) {
  const workspace=useWorkspace();
  const identity=workspace.demo?`demo:${workspace.demoEpoch}`:workspace.user?.id;
  if(!identity||!workspace.store||!feedbackTargetAvailable(workspace,props))return null;
  return <AccountFeedback key={`${identity}:${props.kind}:${props.targetId}`} {...props}/>;
}

function AccountFeedback({kind='job',targetId,target,context}:Props) {
  const workspace=useWorkspace();
  const {demo,demoEpoch,store,user,client,locked}=workspace;
  const owner=user?.id;
  const cache=useMemo(()=>{
    const identity=demo?`demo:${demoEpoch}`:owner!;
    if(!caches.has(store))caches.set(store,new Map());
    const entries=caches.get(store)!;
    if(!entries.has(identity))entries.set(identity,createFeedbackCache(demo?createDemoFeedbackServices(new URLSearchParams(window.location.search).get('demoApi')):createBackend(client,owner),{current:()=>demo || (window.JB?.auth?.userId===owner)}));
    return entries.get(identity)!;
  },[demo,demoEpoch,store,owner,client]);
  const identity=useMemo(()=>({kind,targetId}),[kind,targetId]);
  const subscribe=useCallback((listener:()=>void)=>cache.subscribe(identity,listener),[cache,identity]);
  const snapshot=useCallback(()=>cache.get(identity),[cache,identity]);
  const saved=useSyncExternalStore(subscribe,snapshot,()=>emptyFeedback);
  const dialog=useRef<HTMLDialogElement>(null), generation=useRef(0);
  const [reason,setReason]=useState(''),[note,setNote]=useState('');
  const [draft,setDraft]=useState(false);
  const titleId=useId(),descriptionId=useId();
  const disabled=locked||saved.status!=='ready';
  const reasons=kind==='job'?['Role scope','Experience fit','Location','Compensation']:kind==='network'?['Relevant person','Timing','Relationship','Suggested approach']:['Topic','Timing','Workload','Priority'];
  async function save(rating:'helpful'|'not-helpful'|null) {
    if(disabled)return;
    const epoch=++generation.current;
    const successful=await cache.save(identity,{rating,reason:rating==='not-helpful'?reason:'',note:rating==='not-helpful'?note:''},context,crypto.randomUUID());
    if(successful&&generation.current===epoch){dialog.current?.close();setDraft(false);}
  }
  function edit() {
    if(!draft){setReason(saved.reason||'');setNote(saved.note||'');}
    dialog.current?.showModal();
  }
  return <section className="mt-2" aria-label={`Recommendation feedback for ${target}`}>
    <div className="flex flex-wrap items-center gap-1">
      <span className="mr-1 text-xs text-board-muted">Helpful?</span>
      {(['helpful','not-helpful'] as const).map(rating=><button key={rating} type="button" disabled={disabled} title={rating==='helpful'?'Yes, helpful':'No, not helpful'} aria-label={rating==='helpful'?'Yes, helpful':'No, not helpful'} aria-pressed={saved.rating===rating} className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border text-board-muted disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-board-accent ${saved.rating===rating?'border-board-accent bg-board-tag text-board-accent':'border-transparent hover:border-board-line'}`} onClick={()=>rating==='not-helpful'&&saved.rating!==rating?edit():void save(saved.rating===rating?null:rating)}><ProfileIcon name={rating==='helpful'?'check':'close'} width={15} height={15}/></button>)}
      {(saved.rating==='not-helpful'||draft)&&<button type="button" className="text-xs text-board-accent underline disabled:opacity-50" disabled={disabled} onClick={edit}>Edit feedback</button>}
      <span role="status" className="text-xs text-board-muted">{saved.status==='loading'?'Loading feedback…':saved.status==='saving'?'Saving feedback…':saved.rating?(demo?'Demo feedback saved':'Feedback saved'):saved.version>0?'Feedback cleared':''}</span>
    </div>
    {saved.error&&<p role="alert" className="mt-1 text-xs text-board-muted">{saved.error} <button type="button" className="underline" onClick={()=>cache.load(identity)}>Reload saved feedback</button></p>}
    <dialog ref={dialog} aria-labelledby={titleId} aria-describedby={descriptionId} className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-board-line bg-board-panel p-5 text-board-text shadow-2xl backdrop:bg-black/60">
      <form onSubmit={event=>{event.preventDefault();void save('not-helpful');}}>
        <h2 id={titleId} className="text-base font-semibold">What missed the mark?</h2>
        <p id={descriptionId} className="mt-1 text-sm text-board-muted">Your agent can use this feedback.</p>
        <p className="mt-3 truncate text-xs text-board-muted" title={target}>{target}</p>
        <label className="mt-4 block text-xs text-board-muted">Reason (optional)<select autoFocus className={`${control} mt-1`} value={reason} disabled={saved.status==='saving'} onChange={event=>{setReason(event.target.value);setDraft(true);}}><option value="">Choose a reason</option>{reason&&!reasons.includes(reason)&&<option>{reason}</option>}{reasons.map(value=><option key={value}>{value}</option>)}</select></label>
        <label className="mt-3 block text-xs text-board-muted">Note (optional)<textarea className={`${control} mt-1`} rows={3} maxLength={2000} value={note} disabled={saved.status==='saving'} onChange={event=>{setNote(event.target.value);setDraft(true);}}/></label>
        <p className="mt-3 text-xs text-board-muted">{demo?'Fictional demo only. Reset demo clears this feedback.':'Private to your account. This does not apply, send a message, or complete a task.'}</p>
        {saved.error&&<p role="alert" className="mt-3 text-xs">{saved.error} <button type="button" className="underline" onClick={()=>cache.load(identity)}>Reload saved feedback</button></p>}
        <div className="mt-4 flex justify-end gap-2"><button type="button" className={secondary} onClick={()=>dialog.current?.close()}>Cancel</button><button type="submit" className={primary} disabled={disabled}>{saved.status==='saving'?'Saving…':'Save feedback'}</button></div>
      </form>
    </dialog>
  </section>;
}
