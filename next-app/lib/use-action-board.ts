"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {createBackend} from '../../backend/client.mjs';
import {useWorkspace} from './workspace';
import {subscribePreparationRefresh} from './action-board.mjs';
export type BoardItem={key:string;kind:string;sourceId:string;version:string;createdAt:string;employmentType?:string;status?:string;appliedDate?:string;actionDate?:string;applicationId?:string;company?:string;role?:string;title?:string;body?:string;recipient?:string;destination?:string;subject?:string;proposedAt?:string;timeZone?:string;reason:string;href:string;requiresReview:boolean;reviewed:boolean;canAccept:boolean;canReject:boolean;inferences?:{field:string;reason:string}[];coverLetterSource?:string;coverLetter?:string;blocker?:string;resume?:{id:string;name:string;version?:string};reference?:{id:string;kind:string;label:string;detail?:string;href:string};questions?:{question:string;answer:string;answerSource?:string;questionSource?:string;inferenceNote?:string;profileField?:string;savedAnswerId?:string;preferenceField?:string;required?:boolean;fieldType?:string;options?:any[]}[]};
export type BoardSnapshot={trackerWork?:import('../components/tracker-work-list').TrackerWork[];outreach?:{sourceId:string;response:string;body:string;subject:string;recipient:string}[];items:BoardItem[];holds:{application_id:string;resumed_at:string|null;version:number}[];history:{decision_key:string;source_kind?:string;source_id?:string;response:string;responded_at:string}[]};
const inFlightReads=new WeakMap<object,Map<string,Promise<BoardSnapshot>>>();
export function useActionBoard(){
 const w=useWorkspace(),owner=w.demo?'demo':w.user?.id||null;
 const [snapshot,setSnapshot]=useState<BoardSnapshot|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const epoch=useRef(0),pending=useRef<{signature:string;payload:any}|null>(null),mutating=useRef(false);
 const identity=w.services||w.client;
 const api=useRef<any>(null);api.current=owner?(w.services||createBackend(w.client,owner)):null;
 const refresh=useCallback(async()=>{const version=epoch.current;if(!api.current?.readActionBoard)return;try{let reads=inFlightReads.get(identity);if(!reads){reads=new Map();inFlightReads.set(identity,reads);}let request=reads.get(owner!);if(!request){request=api.current.readActionBoard();reads.set(owner!,request!);void request!.then(()=>reads!.delete(owner!),()=>reads!.delete(owner!));}const data=await request!;if(version===epoch.current){setSnapshot(data);setError('');}}catch{if(version===epoch.current)setError('Action Board could not refresh. Reload before making a decision.');}},[owner,w.services,identity]);
 useEffect(()=>{epoch.current++;setSnapshot(null);setError('');setBusy(false);mutating.current=false;pending.current=null;void refresh();if(!owner)return;return subscribePreparationRefresh(document,window,owner,()=>void refresh());},[owner,refresh]);
 async function respond(item:Pick<BoardItem,'key'> & {version?:string},response:string,policy?:string,input?:Record<string,unknown>){
  if(mutating.current||!api.current)throw Error('Wait for the current decision to finish.');
  const signature=JSON.stringify({key:item.key,response,...(response==='resume'?{expectedVersion:Number(item.version)}:{}),...(policy?{policy}:{}),...(input?{input}:{})});
  if(pending.current?.signature!==signature)pending.current={signature,payload:{...JSON.parse(signature),eventKey:crypto.randomUUID()}};
  const version=epoch.current;mutating.current=true;setBusy(true);setError('');
  try{await api.current.respondActionBoard(pending.current.payload);if(version!==epoch.current)return;pending.current=null;await refresh();if(!w.demo)await window.JB?.cloud?.refresh?.();document.dispatchEvent(new CustomEvent('workspace:cloud-ready',{detail:{userId:owner}}));}
  catch(e){if(version===epoch.current)setError('The decision changed or could not save. Reload and review its current version.');throw e;}
  finally{if(version===epoch.current){mutating.current=false;setBusy(false);}}
 }
 async function saveMessage(item:BoardItem,fields:{subject:string;message:string}){
  if(mutating.current||!api.current)throw Error('Wait for the current save to finish.');
  const version=epoch.current;mutating.current=true;setBusy(true);
  try{await api.current.saveActionBoardMessage({id:item.sourceId,expectedRevision:Number(item.version),...fields});if(version===epoch.current)await refresh();}
  finally{if(version===epoch.current){mutating.current=false;setBusy(false);}}
 }
 return {snapshot,error,busy,refresh,respond,saveMessage};
}
