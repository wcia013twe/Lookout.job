"use client";
import LocationSelector from "./location-selector";
import BrandMark from "./brand-mark";
import {useRef,useState} from "react";
import Link from "next/link";
import {AnimatePresence,motion,MotionConfig,useReducedMotion} from "framer-motion";
import {useWorkspace} from "../lib/workspace";
import {ApplicationProfileProvider,useApplicationProfile} from "./application-profile-context";
import {readField,updateField} from "../../lib/search-profile.mjs";
import {uploadResume,validateResume} from "../../lib/resume-model.mjs";
import {onboardingReveal,saveOnboardingSelection} from "../lib/onboarding-catalog.mjs";
import ResumeImport from "./resume-import";
import AgentSelector from "./agent-selector";
import OnboardingAgentConnection from "./onboarding-agent-connection";
import OnboardingRoleReveal from "./onboarding-role-reveal";
import OnboardingCircleStory from "./onboarding-circle-story";
import BrowserAppInstructions from "./browser-app-instructions";
import ImportSearchHandoff from "./import-search-handoff";
import {useSimplifyImports} from "../lib/simplify-import";
import GoogleSignInButton from "./google-sign-in-button";
import {Dots,Icon,Button,Quiet,Title,Field,SuggestedField,Pills} from "./onboarding-ui";

export default function Onboarding(){
 const w=useWorkspace();
 if(!w.state)return null;
 return <ApplicationProfileProvider key={w.demo?"demo-"+w.demoEpoch:w.user?.id||"guest"}><OnboardingFlow/></ApplicationProfileProvider>;
}
function OnboardingFlow(){
 const w=useWorkspace(),a=useApplicationProfile(),profile=w.state.workflow.profile;
 const [finishing,setFinishing]=useState(false);
 async function finish(){setFinishing(true);setError("");try{await w.websiteOnboarding.complete();}catch(e){setError(e.message||"Could not save setup. Please retry.");setFinishing(false);}}
 const [scene,setScene]=useState("start"),[method,setMethod]=useState(""),[linkedin,setLinkedin]=useState(profile.linkedin||"");
 const [work,setWork]=useState(readField(a.profile.prompt,"Role preferences","Roles").value);
 const [location,setLocation]=useState(readField(a.profile.prompt,"Search Filters","Location").value);
 const [employment,setEmployment]=useState(readField(a.profile.prompt,"Search Filters","Employment").value||"Full-time");
 const [savedResumeId,setSavedResumeId]=useState("");
 const [resumeId,setResumeId]=useState(readField(a.profile.prompt,"Application materials","Default resume ID").value);
 const [sample,setSample]=useState(false),[role,setRole]=useState(null),[error,setError]=useState(""),[feedback,setFeedback]=useState(""),[uploading,setUploading]=useState(false);
 const [provider,setProvider]=useState(profile.setupAgentProvider||"muse"),[agentName,setAgentName]=useState(profile.setupAgentName||"Muse");
 const file=useRef(null),heading=useRef(null),joinedOnce=useRef(false),uploadLock=useRef(false);
 const reduce=useReducedMotion();
 const resumes=(w.state.workflow.resumes||[]).filter(r=>!r.supersededBy),resume=resumes.find(r=>r.id===resumeId);
 const later=()=>go("circles");
 function go(next){setError("");setFeedback("");setScene(next);}
 async function chooseFile(selected){
  if(!selected||uploadLock.current||w.locked||w.demo)return;
  uploadLock.current=true;setUploading(true);setError("");
  try {
   validateResume(selected,"Master");
   if(!w.user||!window.JB.cloud.ready)throw Error("Sign in and wait for your account to connect, then choose your résumé.");
   const row=await uploadResume({client:w.client,getOwner:()=>window.JB.auth.userId,file:selected,variant:"Master",version:1});
   w.store.update("workflow.resumes",items=>[...items,{id:row.id,name:row.name,variant:row.variant,version:row.version,objectPath:row.object_path,contentHash:row.content_hash}]);
   setResumeId(row.id);setFeedback("");
  }catch(e){setError(e.message||"Could not upload your résumé. Please try again.");}
  finally{uploadLock.current=false;setUploading(false);if(file.current)file.current.value="";}
 }
 function continueBackground(e){
  e.preventDefault();setError("");
  if(method==="linkedin"){
   try {
    const url=new URL(linkedin.trim());
    if(url.protocol!=="https:"||!["linkedin.com","www.linkedin.com"].includes(url.hostname)||!/^\/in\/[^/]+/.test(url.pathname))throw Error();
    const saved=w.store.get("workflow.profile");
    if(saved.linkedin!==url.href)w.store.set("workflow.profile",{...saved,linkedin:url.href,verified:false});
   }catch{setError("Use a LinkedIn profile link, like https://linkedin.com/in/your-name.");return;}
  }
  if(method==="resume"&&resume&&(w.demo||resume.objectPath)&&savedResumeId!==resume.id)return;
  go("preferences");
 }
 async function findRole(e){
  e.preventDefault();
  if(a.busy||uploading||w.locked||!work.trim()||!location.trim())return;
  try{
   let prompt=updateField(a.profile.prompt,"Role preferences","Roles",work.trim());
   prompt=updateField(prompt,"Search Filters","Employment",employment);
   prompt=updateField(prompt,"Search Filters","Location",location.trim());
   if(resumeId)prompt=updateField(prompt,"Application materials","Default resume ID",resumeId);
   const preview=onboardingReveal(w.demo?w.roles:(w.publicRoles||w.roles),{work,employment,location},{demo:w.demo});
   prompt=saveOnboardingSelection(prompt,!w.demo&&preview.role?preview.role:null);
   if(!await a.saveProfilePrompt(prompt))return;
   setRole(preview.role);setSample(preview.sample);go("reveal");
  }catch(e){setError(e.message||"Could not save your search. Try again.");}
 }
 function selectAgent(value,label){
  setProvider(value);setAgentName(label);
  const current=w.store.get("workflow.profile");
  w.store.set("workflow.profile",{...current,setupAgent:value==="platform"?"platform":"own",setupAgentProvider:value,setupAgentName:label});
 }
 const room=<div className="mb-6"><AgentSelector joinedOnce={joinedOnce} agent={provider==="platform"?"platform":"own"} provider={provider} onSelect={selectAgent}/>{provider==="platform"&&<p className="hint">Cappy is a preview. To start now, connect your own agent below.</p>}{provider==="custom"&&<Field label="Agent name"><input maxLength={100} value={agentName} onChange={e=>selectAgent("custom",e.target.value)}/></Field>}</div>;
 let content;
 if(scene==="start")content=<><Dots/><Title sub="Add your résumé when you’re ready. We’ll help with what’s next.">Let’s start with you.</Title><form onSubmit={continueBackground}>
  <div className="entry-choices">{/* LinkedIn connector is not available yet.
   <button type="button" className={"entry-choice"+(method==="linkedin"?" selected":"")} onClick={()=>setMethod("linkedin")}><span className="linkedin-mark" aria-hidden="true">in</span><strong>Add LinkedIn profile</strong><Icon/></button>
  */}<button type="button" className={"entry-choice"+(method==="resume"?" selected":"")} onClick={()=>{setMethod("resume");if(w.user&&!w.demo)file.current?.click();}}><Icon kind="file"/><strong>{w.demo?"Use a demo résumé":"Upload résumé"}</strong><Icon/></button></div>
  {!w.demo&&<input ref={file} className="sr-only" type="file" accept=".pdf,.docx" aria-label="Upload résumé file" disabled={!w.user||uploading||w.locked} onChange={e=>void chooseFile(e.target.files?.[0])}/>}
  {/* LinkedIn profile entry is disabled until its connector is implemented. */}
  {method==="resume"&&<div className="space-y-4">
   {!w.user&&!w.demo?<><p className="hint">Sign in to save your résumé privately.</p><Button secondary disabled={!w.authReady} onClick={w.signIn}>Sign in</Button></>:
   <>{resumes.length>0&&<Field label={w.demo?"Demo résumé":"Choose a saved résumé"}><select value={resumeId} onChange={e=>setResumeId(e.target.value)}><option value="">Choose a résumé</option>{resumes.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>}
    {!w.demo&&<Button secondary disabled={uploading} onClick={()=>file.current?.click()}>{uploading?"Uploading…":resume?"Choose another file":"Choose a PDF or DOCX"}</Button>}
    <p className="hint">{w.demo?"Fictional résumé only. No private file is read or uploaded.":"PDF or DOCX · up to 10 MB. Your résumé details are extracted and saved with APILayer."}</p></>}
  </div>}
  {resume&&method==="resume"&&(w.demo||resume.objectPath)&&<ResumeImport key={`${w.demo?w.demoEpoch:w.user?.id}-${resume.id}`} resumeId={resume.id} autoStart compact onComplete={()=>setSavedResumeId(resume.id)}/>}
  {feedback&&<p className="hint" role="status">{feedback}</p>}
  <div className="actions"><Button type="submit" disabled={uploading||w.locked||(!resume&&method!=="linkedin")||(method==="resume"&&resume&&(w.demo||resume.objectPath)&&savedResumeId!==resume.id)}>Continue</Button><Quiet onClick={()=>go("preferences")}>I’ll do this later</Quiet></div>
 </form><OnboardingSimplifyImport/></>;
 if(scene==="preferences")content=<><Dots/><Title sub="Just the basics. You can change these anytime.">What’s your next move?</Title><form onSubmit={findRole}>
  <SuggestedField label="Type of work" value={work} onChange={setWork} placeholder="Type a role or choose below" options={["Software Engineer","Data Scientist","Data Analyst","Product Manager","Business Analyst","UX Designer","QA Engineer","Cybersecurity Analyst","IT Specialist","Technical Program Manager","Solutions Engineer","Marketing Specialist"]}/>
  <Pills label="Job type" value={employment} onChange={setEmployment} options={["Full-time","Internship","Contract","Open to options"]}/>
  <LocationSelector value={location} onChange={setLocation}/>
  <div className="actions"><Button type="submit" disabled={a.busy||!work.trim()||!location.trim()}>{a.busy?"Saving…":"Find my first role"}</Button><Quiet onClick={later}>I’ll do this later</Quiet></div>
  {a.feedback&&<p className={a.saveError?"error":"hint"} role="status">{a.feedback}</p>}
 </form></>;
 if(scene==="reveal")content=<OnboardingRoleReveal role={role} demo={w.demo} onPrepare={()=>{if(w.demo&&!sample)w.store.set("demo.onboardingRole",role);go("connect");}} onLater={later}/>;
 if(scene==="connect")content=<OnboardingAgentConnection room={room} onFinish={()=>go("circles")} onLater={later}/>;
 if(scene==="circles")content=<OnboardingCircleStory onLater={()=>go("done")}/>;
 if(scene==="done")content=<><Dots/><Title sub="Explore roles, check your applications, or pick up where you left off.">Make your next move.</Title><Button disabled={finishing||w.locked} onClick={()=>void finish()}>{finishing?"Saving setup…":"Open my workspace"}</Button><BrowserAppInstructions/></>;
 if(!w.demo&&!w.user)content=<><Dots/><Title sub="Create your Lookout account or return to your workspace before setting up your search and agent.">Sign up or sign in.</Title><div className="actions"><GoogleSignInButton disabled={!w.authReady} onClick={w.signIn} label={w.authReady?"Continue with Google":"Checking sign-in…"}/></div><p className="hint">New here? Continuing with Google creates your account. Already joined? Use the same Google account to sign in.</p></>;
 return <MotionConfig reducedMotion="user"><div className="lookout-onboarding setup-experience"><header className="brandbar"><Link className="brand" href="/"><BrandMark/>lookout</Link>{w.demo&&<span className="hint">Demo · fictional data</span>}</header><div className="ob-main"><AnimatePresence mode="wait"><motion.section key={scene} ref={heading} tabIndex={-1} aria-label="Onboarding" onAnimationComplete={()=>heading.current?.focus({preventScroll:true})} className={"stage "+(["reveal","connect"].includes(scene)?"wide":"")} initial={reduce?false:{opacity:.6,y:12}} animate={{opacity:1,y:0}} exit={reduce?{}:{opacity:0,y:-6}} transition={{duration:.25}}>{content}{(error||w.error||w.syncError)&&<p className="error" role="alert">{error||w.error||w.syncError}</p>}</motion.section></AnimatePresence></div><footer className="app-foot"><Dots/><span>Your next chapter starts here.</span></footer></div></MotionConfig>;
}

function OnboardingSimplifyImport(){
 const imports=useSimplifyImports();
 return <ImportSearchHandoff key={imports.scope} imports={imports}/>;
}
