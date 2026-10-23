// Isolated, explicitly fictional onboarding. Never calls the network or account store.
export function demoOnboardingAction(store, operation, payload={}) {
 let s=store.get('demo.onboarding') || {revision:0,step:'intent_pending',prompt:'What kind of jobs are you looking for?',data:{},tasks:[]};
 s=structuredClone(s);
 if(operation==='onboarding.get_state') return s;
 if(operation==='tasks.read') return {tasks:s.tasks,dispatch:'demo-only',pushAvailable:false};
 if(payload.expectedRevision!==s.revision)throw Error('Demo state changed. Refresh.');
 if(operation==='onboarding.submit_step') {
  const {event,data={}}=payload;
  if(event==='connection_test'){s.data.connectionTest={connectionId:'demo-connection',checkedAt:'2026-10-23T12:00:00Z'};s.automationSetup={connectionId:'demo-connection',schedule:store.get('workflow.searchPreferences.schedule')||null};s.prompt='Fictional connection confirmed; no tasks executed.';}
  else if(event==='pause'){s.data.resumeStep=s.step;s.step='paused';s.prompt='Fictional onboarding paused.';}
  else if(event==='resume'&&s.step==='paused'){s.step=s.data.resumeStep;s.prompt='Resume the fictional scenario.';}
  else if(event==='runtime'&&s.step==='connection_pending'){s.data.runtime={connectionId:'demo-connection',browsingReportedAt:'2026-01-01T00:00:00Z',name:'Demo agent'};s.step='intent_pending';s.prompt='Your fictional agent is connected.';}
  else if(event==='intent'&&s.step==='intent_pending'){
   if(typeof data.text!=='string'||data.text.trim().length<3)throw Error('Describe a search intent.');
   s.data.intent={text:data.text};s.step='action_policy_pending';s.prompt='Fictional first result: recommend, prepare for review, or request routine auto-apply setup?';
   const role=store.get('demo.onboardingRole');
   s.matchJob=role?{id:role.id,url:'#',employer:{company:role.company,title:role.title}}:{id:'demo-onboarding-job',url:'#',employer:{company:'ExampleCo (fictional)',title:'Backend Engineering Intern (demo)'}};
   s.data.match={fit:'Illustrative role from the demo search. This is not a real opening.',fitPreliminary:true,evidence:'Fictional evidence for UI preview only',checkedAt:'Demo fixture'};
  } else if(event==='policy'&&s.step==='action_policy_pending'){
   if(!['recommend','prepare','auto_apply_requested'].includes(data.choice))throw Error('Choose a policy.');
   s.data.policy=data.choice;s.step=data.choice==='recommend'?'execution_ready':'profile_verification_pending';s.prompt=data.choice==='recommend'?'Queue a fictional discovery result.':'Fictional profile setup: review essential facts before preparation.';
  } else if(event==='profile_checked'&&s.step==='profile_verification_pending') {s.step='execution_ready';s.prompt='Queue a fictional action. No real applications are sent.';}
  else if(event==='execution_result'&&s.step==='execution_ready'&&s.tasks.some(t=>t.id===data.taskId&&t.state==='completed')){s.step='delivery_pending';s.prompt='Choose an illustrative delivery preference.';}
  else if(event==='delivery'&&s.step==='delivery_pending'){s.data.delivery={...data,active:false};s.step='ready';s.prompt='Fictional first result is ready. Notifications and social sharing stay off.';}
  else throw Error('Unsupported demo transition.');
  s.revision++;
 } else if(operation==='tasks.create'&&s.step==='execution_ready') {
  if(!s.tasks.some(t=>t.event_key===payload.eventKey))s.tasks.unshift({id:'demo-onboarding-task-'+s.revision,kind:payload.kind,event_key:payload.eventKey,state:payload.kind==='validate_auto_apply'?'needs_user':'completed',result:{summary:payload.kind==='validate_auto_apply'?'Demo: auto-apply stays off; runner and authorization require verification.':'Fictional completed result for local UI review. No real jobs or applications.'}});
 } else throw Error('Only fictional onboarding actions are allowed.');
 store.set('demo.onboarding',s);return s;
}
