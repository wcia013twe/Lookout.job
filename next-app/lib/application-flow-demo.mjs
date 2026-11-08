// Optional, resettable demo scenarios. No account storage or backend calls.
export function withApplicationFlowDemo(fixtures,scenario) {
 if(scenario==='application-rounds'){
  const app=fixtures.state.workflow.applications['demo-interview'];
  app.milestones.push({id:'demo-rounds-home',kind:'technical_round',label:'Take-home exercise (demo)',phase:'completed',occurred_at:null,round:{stage:'SCREEN',type:'take_home'},source:{kind:'user',note:'Fictional completed screening exercise.'}},{id:'demo-rounds-manager',kind:'interview',label:'Hiring manager (demo)',phase:'received',occurred_at:null,round:{stage:'INTERVIEW',type:'hiring_manager'},source:{kind:'user'}},{id:'demo-rounds-cancelled',kind:'technical_round',label:'Cancelled onsite (demo)',phase:'scheduled',occurred_at:null,round:{stage:'INTERVIEW',type:'onsite',cancelled:true},source:{kind:'user'}});
  return fixtures;
 }
 if(!['application-flow','application-flow-empty','application-flow-single'].includes(scenario))return fixtures;
 const definitions=scenario==='application-flow-empty'?[]:scenario==='application-flow-single'?[['waiting','Applied']]:[
  ['waiting','Applied'],['screen','Blocked'],['interview','Interview'],['offer','Offer'],['rejected','Rejected'],['withdrawn','Withdrawn']];
 const applications=Object.fromEntries(definitions.map(([outcome,status])=>{
  const id=`demo-flow-${outcome}`;
  return [id,{id,company:`Example ${outcome} (demo)`,title:'Infrastructure Engineer (demo)',employmentType:'FT',status,questions:[],activity:[],
   milestones:outcome==='screen'?[{kind:'phone_screen',phase:'received'}]:['rejected','withdrawn'].includes(outcome)?[{kind:'application_submitted',phase:'completed'}]:[]}];
 }));
 fixtures.state.workflow.applications=applications;
 fixtures.state.tracker={ids:Object.keys(applications),items:{}};
 return fixtures;
}
