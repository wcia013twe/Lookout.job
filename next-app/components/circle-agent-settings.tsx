"use client";
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {useKnowledgeClient} from '../app/circles/_lib/client';
import type {Circle,Detail,Receipt,Cursor,Request} from '../app/circles/_lib/types';
import {Section,Field,Notice,control,primary,secondary} from './ui';

type Sources={items:Receipt[];nextCursor:Cursor|null};
const message=(error:unknown)=>error instanceof Error?error.message:'Could not load Circle settings. Try again.';

function CircleSettings({circle,request}:{circle:Circle;request:Request}) {
 const [detail,setDetail]=useState<Detail|null>(null),[sources,setSources]=useState<Sources|null>(null);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[feedback,setFeedback]=useState(''),[retry,setRetry]=useState(0);
 const current=useRef(true),pending=useRef<{operation:string;payload:string;key:string}|null>(null);
 useEffect(()=>{current.current=true;setLoading(true);setDetail(null);setSources(null);setError('');
  let active=true;
  Promise.all([request<Detail>('circles.read',{circleId:circle.id}),request<Sources>('knowledge.citations',{circleId:circle.id})]).then(([d,s])=>{if(active){setDetail(d);setSources(s);}}).catch(e=>{if(active)setError(message(e));}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;current.current=false;};
 },[circle.id,request,retry]);
 async function write(operation:string,payload:Record<string,unknown>) {
  const serialized=JSON.stringify(payload),previous=pending.current;
  const key=previous?.operation===operation&&previous.payload===serialized?previous.key:crypto.randomUUID();
  pending.current={operation,payload:serialized,key};
  await request(operation,{circleId:circle.id,...payload,eventKey:key});pending.current=null;
 }
 async function savePolicy(event:FormEvent<HTMLFormElement>) {
  event.preventDefault();if(busy||!detail)return;
  const form=new FormData(event.currentTarget),allowedTypes=['resource','opportunity'].filter(type=>form.has(type));
  setBusy(true);setError('');setFeedback('');
  try {await write('circles.policy',{allowedTypes});if(current.current){setDetail({...detail,policy:allowedTypes});setFeedback('Sharing permissions saved.');}}
  catch(e){if(current.current)setError(message(e));}finally{if(current.current)setBusy(false);}
 }
 async function retract(receipt:Receipt) {
  if(busy)return;setBusy(true);setError('');setFeedback('');
  try {await write('knowledge.retract',{postId:receipt.post_id,revision:receipt.revision});const next=await request<Sources>('knowledge.citations',{circleId:circle.id});if(current.current){setSources(next);setFeedback('Receipt retracted.');}}
  catch(e){if(current.current)setError(message(e));}finally{if(current.current)setBusy(false);}
 }
 async function more() {
  if(busy||!sources?.nextCursor)return;setBusy(true);setError('');
  try {const next=await request<Sources>('knowledge.citations',{circleId:circle.id,cursor:sources.nextCursor});if(current.current)setSources({items:[...sources.items,...next.items],nextCursor:next.nextCursor});}
  catch(e){if(current.current)setError(message(e));}finally{if(current.current)setBusy(false);}
 }
 return <div className="mt-5" aria-busy={loading||busy}>
  {loading&&<p role="status" className="text-sm text-board-muted">Loading Circle settings…</p>}
  <div role="alert"><Notice>{error}</Notice></div>
  {error&&<button className={secondary} disabled={busy||loading} onClick={()=>setRetry(value=>value+1)}>Reload Circle settings</button>}
  {detail&&<>
   <h3 className="font-semibold">Agent sharing permissions</h3>
   <p className="my-3 text-sm text-board-muted">Ask me before sharing.</p>
   <details className="border-b border-board-line pb-4"><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">Allow limited public links</summary>
    <p className="mb-3 max-w-prose text-sm leading-relaxed text-board-muted">Fixed public-link templates only. Personal posts still need review.</p>
    <form onSubmit={savePolicy} key={detail.policy.join(',')}><fieldset disabled={busy||loading} className="space-y-2"><legend className="sr-only">Permitted agent contribution types</legend>
     {['resource','opportunity'].map(type=><label key={type} className="flex min-h-11 items-center gap-3 text-sm"><input name={type} type="checkbox" defaultChecked={detail.policy.includes(type)}/>{type==='resource'?'Preparation resource links':'Opportunity links'}</label>)}
     <button className={`${primary} mt-2`}>Save link permissions</button>
    </fieldset></form>
   </details>
   <details className="border-b border-board-line py-3"><summary className="min-h-11 cursor-pointer py-2 font-semibold">My agent’s sources</summary>
    <p className="my-3 max-w-prose text-sm leading-relaxed text-board-muted">Private history of Circle sources your agent reported using. Private answers are never included.</p>
    {!sources?.items.length&&<p className="py-3 text-sm text-board-muted">No citations recorded for you in this Circle yet.</p>}
    <ul className="divide-y divide-board-line">{sources?.items.map(receipt=><li key={receipt.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
     <div className="min-w-0 text-sm"><p>{receipt.category==='answer'?'Answer':'Preparation plan'} · revision {receipt.revision} · {new Date(receipt.created_at).toLocaleDateString()}</p><p className="break-all text-board-muted">{receipt.reference}</p><p>{!receipt.source_available?'Source withdrawn or hidden':receipt.retracted_at?'Receipt retracted':'Agent-reported use'}</p></div>
     {!receipt.retracted_at&&<button className={secondary} disabled={busy||loading} onClick={()=>void retract(receipt)}>Retract receipt</button>}
    </li>)}</ul>
    {sources?.nextCursor&&<button className={secondary} disabled={busy||loading} onClick={()=>void more()}>More receipts</button>}
   </details>
  </>}
  <p role="status" className="mt-3 text-sm text-board-muted">{feedback}</p>
 </div>;
}

function CircleList({request}:{request:Request}) {
 const [circles,setCircles]=useState<Circle[]>([]),[selected,setSelected]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{let active=true;setLoading(true);setError('');request<{circles:Circle[]}>('circles.list').then(result=>{if(active){setCircles(result.circles);setSelected(previous=>{const wanted=previous||new URLSearchParams(window.location.search).get('circle');return result.circles.some(circle=>circle.id===wanted)?wanted!:result.circles[0]?.id||'';});}}).catch(e=>{if(active)setError(message(e));}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[request,retry]);
 const circle=circles.find(item=>item.id===selected);
 return <>
  {loading&&<p role="status" className="text-sm text-board-muted">Loading your circles…</p>}
  <div role="alert"><Notice>{error}</Notice></div>
  {error&&<button className={secondary} onClick={()=>setRetry(value=>value+1)}>Retry Circle connection</button>}
  {!loading&&!error&&!circles.length&&<p className="text-sm text-board-muted">Join a Circle to manage your agent’s sharing permissions.</p>}
  {circle&&<><Field label="Circle"><select className={control} value={selected} onChange={event=>setSelected(event.target.value)}>{circles.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><CircleSettings key={selected} circle={circle} request={request}/></>}
 </>;
}

export default function CircleAgentSettings() {
 const client=useKnowledgeClient();
 return <Section title="Circle sharing">{client.ready?<CircleList key={client.identity} request={client.request}/>:<p className="text-sm text-board-muted">Sign in to manage your Circle sharing permissions.</p>}</Section>;
}
