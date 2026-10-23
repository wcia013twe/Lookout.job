"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspace } from '../lib/workspace';
import { Notice } from './ui';
export default function DemoSafeProfile({children}) {
 const w=useWorkspace();
 const router=useRouter();
 const signedIn=Boolean(w.user && !w.user.is_anonymous);
 useEffect(()=>{
  if(!w.demo && w.authReady && !signedIn)router.replace('/');
 },[w.demo,w.authReady,signedIn,router]);
 // Do not mount profile providers or editors while auth is loading or absent.
 if(!w.demo && !signedIn)return <Notice>{w.authReady ? 'Returning to Discover…' : 'Checking sign-in…'}</Notice>;
 return <>{w.demo && <Notice>Fictional profile and settings. Edits stay in memory; private files and account services remain unavailable.</Notice>}{children}</>;
}
