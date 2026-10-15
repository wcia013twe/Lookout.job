'use client';
import {useCallback,useRef} from 'react';
import {useWorkspace} from '../../../lib/workspace';
import type {Request} from './types';
import {circleKnowledgeResponse} from '../../../../lib/circle-context.mjs';
export function useKnowledgeClient():{request:Request;ready:boolean;identity:string;demo:boolean;signIn:()=>void} {
 const w=useWorkspace();const owner=w.user?.id,client=w.client,service=w.demo?w.services?.knowledge:null;
 const identity=w.demo?`demo:${w.demoEpoch}`:owner||'guest';const active=useRef({identity,client,service});if(active.current.identity!==identity||active.current.client!==client||active.current.service!==service)active.current={identity,client,service};
 const request:Request=useCallback(async <T,>(operation:string,payload:Record<string,unknown>={}):Promise<T>=>{
  const current=active.current;
  if(current.identity!==identity)throw Error('Account changed. Reload Circles.');
  if(service)return service.action(operation,payload) as T;
  if(!owner||!client)throw Error('Sign in to open a private Circle.');
  const {data,error}=await client.rpc('knowledge_action',{operation,payload});
  if(active.current!==current)throw Error('Account changed. Reload Circles.');
  if(error)throw Error(error.code==='PGRST202'?'Circle Knowledge is not enabled on this backend yet.':error.code==='40001'?'This contribution changed. Reload it before saving.':error.code==='42501'||error.code==='P0002'?'Circle or contribution unavailable. Refresh to check access.':error.message||'Circles could not load. Try again.');
  if(data?.available===false)throw Error(data.reason||'Circle Knowledge is not enabled yet.');
  return circleKnowledgeResponse(operation,data) as T;
 },[identity,owner,client,service]);
 return {request,ready:!!service||!!(owner&&client),identity,demo:!!w.demo,signIn:w.signIn};
}
