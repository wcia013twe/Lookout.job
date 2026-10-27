'use client';
import {useCallback,useRef} from 'react';
import {useWorkspace} from '../../../lib/workspace';
import type {Request} from './types';
import {callApi,apiFailure} from '../../../../lib/api-failure.mjs';
import {circleKnowledgeResponse} from '../../../../lib/circle-context.mjs';
export function useKnowledgeClient():{request:Request;ready:boolean;identity:string;demo:boolean;signIn:()=>void;openDemo:()=>void;connectionState:'ready'|'loading'|'signed_out'|'unavailable'} {
 const w=useWorkspace();const owner=w.user?.id,client=w.client,service=w.demo?w.services?.knowledge:null;
 const identity=w.demo?`demo:${w.demoEpoch}`:owner||'guest';const active=useRef({identity,client,service});if(active.current.identity!==identity||active.current.client!==client||active.current.service!==service)active.current={identity,client,service};
 const request:Request=useCallback(async <T,>(operation:string,payload:Record<string,unknown>={}):Promise<T>=>{
  const current=active.current;
  if(current.identity!==identity)throw Error('Account changed. Reload Circles.');
  if(service)return service.action(operation,payload) as T;
  if(!owner||!client)throw Error('Sign in to open a private Circle.');
  const data=await callApi(operation,()=>client.rpc('knowledge_action',{operation,payload}),data=>!!data&&typeof data==='object'&&(data.available===false||(operation==='knowledge.interview'?Array.isArray(data.evidence)&&['no_discussions','evidence_available'].includes(data.status):operation==='circles.list'?Array.isArray(data.circles):['knowledge.search','knowledge.feed'].includes(operation)?Array.isArray(data.items):operation==='knowledge.read'?!!data.post&&Array.isArray(data.replies):true)));
  if(active.current!==current)throw Error('Account changed. Reload Circles.');
  if(data.available===false)throw apiFailure(operation,{code:'FEATURE_UNAVAILABLE'});
  return circleKnowledgeResponse(operation,data) as T;
 },[identity,owner,client,service]);
 const ready=!!service||!!(owner&&client);
 const connectionState=ready?'ready':!w.state||(!w.demo&&!w.authReady)?'loading':!owner&&!w.demo?'signed_out':'unavailable';
 return {request,ready,identity,demo:!!w.demo,signIn:w.signIn,openDemo:w.toggleDemo,connectionState};
}
