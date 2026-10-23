"use client";
import GoogleSignInButton from "./google-sign-in-button";
import {useEffect,useState} from "react";
import Link from "next/link";
import {useWorkspace,asset} from "../lib/workspace-context";
import {previewDemoReset,resetDemoWorkspace} from "../lib/demo-workspace-reset.mjs";
import {createBackend} from "../../backend/client.mjs";
import {Field,Heading,control,primary,secondary} from "./ui";

export default function WorkspaceReset(){
 const w=useWorkspace();
 const [preview,setPreview]=useState<any>(null),[confirmation,setConfirmation]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[done,setDone]=useState(false),[resetId,setResetId]=useState("");
 useEffect(()=>{setPreview(null);setConfirmation("");setResetId("");setError("");setDone(false);},[w.accountUser?.id,w.demoEpoch]);
 async function inspect(){
  setBusy(true);setError("");
  try{
   const p=w.demo?previewDemoReset(w.store):await createBackend(w.client,w.accountUser.id).previewWorkspaceReset();
   setConfirmation("");setPreview(p);setResetId(p.state==='pending'?p.resetId:crypto.randomUUID());
  }catch{setError("Could not load the reset preview. Try again. Nothing was reset by this preview.");}
  finally{setBusy(false);}
 }
 async function reset(event:React.FormEvent){
  event.preventDefault();setBusy(true);setError("");
  try{
   if(w.demo){
    // Exercise the same confirmation screen using disposable fictional state only.
    resetDemoWorkspace(w.store,confirmation);
    setDone(true);
   }else{
    await window.JB.cloud.pauseForReset();
    const receipt=await createBackend(w.client,w.accountUser.id).resetWorkspace({resetId,confirmation,expectedPersonalVersion:preview.personalVersion});
    if(receipt.state!=='completed')throw Error('Incomplete reset');
    w.store.clearAccountCache(w.accountUser.id,resetId);
    const {error}=await w.client.auth.signOut({scope:'local'});
    if(error){setError('Workspace reset completed. Sign out before onboarding again.');setDone(true);return;}
    // Full navigation unmounts every editor and clears pending component drafts.
    window.location.assign(asset('profile/'));
   }
  }catch{setError("Reset did not finish. Some files may already be deleted and agent connections may be revoked. Preview the current state, then retry to finish. Editing stays paused while reset is pending.");}
  finally{setBusy(false);}
 }
 const total=preview?Object.values(preview.counts).reduce((sum:number,n:any)=>sum+Number(n),0):0;
 return <main className="mx-auto w-full max-w-2xl px-4 py-8 md:px-8 md:py-12">
  <Heading title="Reset workspace">Start onboarding again with an empty personal workspace. Your login account stays available.</Heading>
  {w.demo&&<p className="mb-6 text-sm text-board-muted">Demo preview. Only fictional data in this tab can change. Reset demo data restores the fixtures.</p>}
  <div className="space-y-5 text-sm leading-relaxed">
   <p>Reset permanently deletes your profile, resumes and other private files, saved answers, preferences, searches, applications, preparation, outreach, and private history. All agent connections are revoked.</p>
   <p>Your login, Circle content and memberships, and internal version counters remain. Reset does not withdraw employer applications or stop automations hosted by your agent. Pause those automations before continuing.</p>
   {done?<p role="status">{w.demo?'Fictional workspace reset. Use Reset demo data in the profile menu to restore it.':'Workspace reset completed. Sign in again to onboard.'}</p>:<>
    {!w.demo&&!w.accountUser?<div><p className="mb-4">Sign in to preview and reset your own workspace.</p><GoogleSignInButton disabled={!w.authReady} onClick={w.signIn}/></div>:<>
     {!w.demo&&<p>Signed in as <strong className="break-all">{w.accountUser.email}</strong></p>}
     <button type="button" className={secondary} disabled={busy} onClick={inspect}>{busy?'Working…':preview?'Refresh reset preview':'Preview reset'}</button>
     {preview&&<form className="space-y-5 border-t border-board-line pt-5" onSubmit={reset}>
      <p role="status">{preview.state==='pending'?'A reset is incomplete. Confirm again to finish it. ':''}{total} private records and {preview.files.length} uploaded files remain in this preview.</p>
      <Field label="Type RESET MY WORKSPACE to confirm permanent deletion"><input className={control} autoComplete="off" spellCheck={false} value={confirmation} disabled={busy} onChange={event=>setConfirmation(event.target.value)}/></Field>
      <button className={primary} type="submit" disabled={busy||confirmation!=='RESET MY WORKSPACE'}>{busy?'Resetting…':preview.state==='pending'?'Finish workspace reset':'Permanently reset workspace'}</button>
     </form>}
    </>}
   </>}
   {error&&<p role="alert">{error}</p>}
   <Link className="inline-block min-h-11 py-3 text-board-accent underline underline-offset-4" href="/profile/">Back to profile</Link>
  </div>
 </main>;
}
