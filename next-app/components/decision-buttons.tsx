"use client";
import {useRef,useState,type ReactNode} from 'react';
import {swipeResponse,decisionFeedback} from '../../lib/action-board.mjs';
import {useActionBoard,type BoardItem} from '../lib/use-action-board';
import {primary,secondary,control} from './ui';
export function SwipeDecision({canAccept,canReject,onRespond,children,disabled=false}:{canAccept:boolean;canReject:boolean;onRespond:(response:string)=>void;children:ReactNode;disabled?:boolean}){
 const start=useRef<{x:number;y:number;width:number;pointer:number}|null>(null),[label,setLabel]=useState('');
 return <div className="board-swipe" style={{touchAction:'pan-y'}} onPointerDown={event=>{if(disabled||event.pointerType!=='touch'||!matchMedia('(max-width: 767px)').matches||(event.target as HTMLElement).closest('button,a,input,textarea,select,summary'))return;start.current={x:event.clientX,y:event.clientY,width:event.currentTarget.clientWidth,pointer:event.pointerId};}} onPointerMove={event=>{const s=start.current;if(!s||s.pointer!==event.pointerId)return;const dx=event.clientX-s.x,dy=event.clientY-s.y;if(Math.abs(dy)>20&&Math.abs(dy)>Math.abs(dx)){start.current=null;setLabel('');return;}setLabel(swipeResponse({dx,dy,width:s.width,canAccept,canReject})==='accept'?'Release to accept':swipeResponse({dx,dy,width:s.width,canAccept,canReject})==='reject'?'Release to reject':'');}} onPointerCancel={()=>{start.current=null;setLabel('');}} onPointerUp={event=>{const s=start.current;start.current=null;setLabel('');if(!s||s.pointer!==event.pointerId||disabled)return;const response=swipeResponse({dx:event.clientX-s.x,dy:event.clientY-s.y,width:s.width,canAccept,canReject});if(response)onRespond(response);}}>
 {children}{label&&<p role="status" className="mt-2 text-sm font-semibold text-board-accent md:hidden">{label}</p>}
 </div>;
}
export function DecisionButtons({item,busy,onRespond,chosenPolicy,onPolicyChange}:{item:BoardItem;busy:boolean;chosenPolicy?:string;onPolicyChange?:(policy:string)=>void;onRespond:(response:string,policy?:string)=>void}){
 const [localPolicy,setLocalPolicy]=useState('ask');const policy=chosenPolicy??localPolicy;
 return <div className="mt-3 flex flex-wrap items-center gap-3">
 {item.kind==='verify_answer'&&<label className="text-sm">Reuse permission<select className={`${control} ml-2`} value={policy} disabled={busy} onChange={e=>{setLocalPolicy(e.target.value);onPolicyChange?.(e.target.value);}}><option value="ask">Ask every time</option><option value="auto">Allow matching-question autofill</option></select></label>}
 {item.canAccept&&<button type="button" className={primary} disabled={busy||(item.requiresReview&&!item.reviewed)} onClick={()=>onRespond('accept',item.kind==='verify_answer'?policy:undefined)}>Accept</button>}
 {item.canReject&&<button type="button" className={secondary} disabled={busy} onClick={()=>onRespond('reject')}>Reject</button>}
 {item.requiresReview&&!item.reviewed&&<span className="text-xs text-board-muted">Review this version before accepting.</span>}
 </div>;
}
// Owning pages share the same receipts and validators as Action Board.
export function OwnedDecisionActions({kind,sourceId,body,subject,recipient,destination,version}:{kind:string;sourceId:string;body?:string;subject?:string;recipient?:string;destination?:string;version?:number}){
 const board=useActionBoard(),[feedback,setFeedback]=useState('');
 const item=board.snapshot?.items.find(i=>i.kind===kind&&i.sourceId===sourceId&&(body===undefined||i.body===body)&&(subject===undefined||(i.subject||'')===subject)&&(recipient===undefined||(i.recipient||'')===recipient)&&(destination===undefined||(i.destination||'')===destination)&&(version===undefined||i.version===String(version)));
 const saved=board.snapshot?.outreach?.find(i=>i.sourceId===sourceId&&(body===undefined||i.body===body)&&(subject===undefined||i.subject===subject)&&(recipient===undefined||i.recipient===recipient));
 if(!item&&saved)return <p role="status" className="mt-2 text-sm">{saved.response==='accept'?'Ready for you to send. Nothing was sent.':'Message declined. No further work on this draft.'}</p>;
 if(!item)return feedback?<p role="status" className="mt-2 text-sm">{feedback}</p>:null;
 async function respond(response:string,policy?:string){if(!item)return;try{await board.respond(item,response,policy);setFeedback(decisionFeedback(item,response));}catch{}}
 return <div className="mt-3">{item.requiresReview&&!item.reviewed&&<button type="button" className={secondary} disabled={board.busy} onClick={()=>void respond('review')}>I reviewed this exact message</button>}<DecisionButtons item={item} busy={board.busy} onRespond={(response,policy)=>void respond(response,policy)}/>{(board.error||feedback)&&<p role="status" className="mt-2 text-sm">{board.error||feedback}</p>}</div>;
}
export function ApplicationWorkControl({applicationId}:{applicationId:string}){
 const board=useActionBoard();const held=board.snapshot?.holds.find(h=>h.application_id===applicationId&&!h.resumed_at);
 if(!held)return null;
 return <div className="mt-3 text-sm"><p>Agent work stopped. This job stays saved.</p><button type="button" className={`${secondary} mt-2`} disabled={board.busy} onClick={()=>void board.respond({key:applicationId,version:String(held.version)},'resume').catch(()=>{})}>Resume agent work</button>{board.error&&<p role="alert">{board.error}</p>}</div>;
}
