"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {createBackend} from '../../backend/client.mjs';
import {finishWebsiteOnboarding,websiteOnboardingComplete} from './website-onboarding.mjs';
export function useWebsiteOnboarding(client,user){
 const owner=user?.id||null,current=useRef(owner);current.current=owner;
 const [snapshot,setSnapshot]=useState(null),[retry,setRetry]=useState(0);
 useEffect(()=>{
  if(!owner||!client)return;
  let alive=true;
  setSnapshot({owner,status:'loading'});
  createBackend(client,owner).onboardingAction('onboarding.get_state').then(state=>{
   if(alive&&current.current===owner)setSnapshot({owner,status:websiteOnboardingComplete(state)?'complete':'incomplete'});
  }).catch(()=>{if(alive&&current.current===owner)setSnapshot({owner,status:'error'});});
  return()=>{alive=false;};
 },[client,owner,retry]);
 const complete=useCallback(async()=>{
  if(!owner||current.current!==owner)throw Error('Sign in before finishing setup.');
  const state=await finishWebsiteOnboarding(createBackend(client,owner));
  if(current.current!==owner)throw Error('Account changed. Return to your account and retry.');
  if(!websiteOnboardingComplete(state))throw Error('Setup could not be saved. Please retry.');
  setSnapshot({owner,status:'complete'});
 },[client,owner]);
 return {status:snapshot?.owner===owner?snapshot.status:'loading',complete,retry:()=>setRetry(n=>n+1)};
}
