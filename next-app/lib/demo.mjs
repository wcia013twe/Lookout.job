import { profileFromPrompt, initialPrompt, updateField } from '../../lib/search-profile.mjs';
import { createPreparationPlan } from '../../lib/preparation-model.mjs';
import { createDemoWorkspace } from './muse-demo-fixtures.mjs';
export { createDemoServices } from './muse-demo-fixtures.mjs';
export function canUseDemo(user) {return Boolean(user?.id && !user.is_anonymous && user.app_metadata?.demo_preview === true);}
export function createMemoryStore(initial,onChange=()=>{}) {
 let state=structuredClone(initial);
 const get=path=>structuredClone(path?path.split('.').reduce((v,k)=>v?.[k],state):state);
 function set(path,value) {const keys=path.split('.');let node=state;for(const key of keys.slice(0,-1))node=node[key]??={};node[keys.at(-1)]=structuredClone(value);onChange(get());}
 return {get,set,update:(path,fn)=>set(path,fn(get(path)))};
}

function demoSearchProfiles() {
 return [['general', 'Full-time engineering (demo)', 'Full-time', 'demo-ft-tiers'], ['internships', 'Internships (demo)', 'Internship', 'demo-intern-tiers']].map(([id, name, employment, listId]) => {
  let prompt = (employment === 'Full-time' ? 'I want a reliable team with time to learn.\n\n' : '') + initialPrompt({ employmentTypes: [employment], locations: ['United States'] });
  for (const [heading, key, value] of [
   ['Search Filters', 'Work arrangement', 'Remote'],
   ['Role preferences', 'Roles', 'Software engineering'],
   ['Role preferences', 'Specializations', 'Backend, distributed systems'],
   ['Work-life balance & benefits', 'Work-life balance', 'Predictable hours and sustainable on-call rotation (demo).'],
   ['Work-life balance & benefits', 'Employer benefits', 'Health coverage and a learning budget (demo).'],
   ['Priority & flexibility', 'Work-life balance', 'Preferred'],
   ['Priority & flexibility', 'Employment', 'Required'],
   ['Priority & flexibility', 'Location', 'Preferred'],
   ['Career goals & tradeoffs', 'Career goals', 'Build deeper systems experience (fictional demo).'],
   ['Career goals & tradeoffs', 'Tradeoffs', employment === 'Internship' ? 'Consider timing changes for strong mentorship and conversion potential (demo).' : 'Flexible on company size for an excellent engineering team (demo).'],
   ['Company priorities', 'Tier list ID', listId],
   ['Company priorities', 'Tier list name', employment + ' company priorities (demo)'],
  ]) prompt = updateField(prompt, heading, key, value);
  return { ...profileFromPrompt(prompt, { id, name, active: employment === 'Full-time' }), version: 0 };
 });
}
function demoTierLists() {
 return ['FT', 'Internship'].map((employmentType, index) => ({ id: index ? 'demo-intern-tiers' : 'demo-ft-tiers', name: (index ? 'Internship' : 'Full-time') + ' company priorities (demo)', employmentType, description: 'Fictional companies and rankings for demo mode.', tiers: [{id:'S',label:'S'},{id:'A',label:'A'},{id:'B',label:'B'}], companies: [{id:'demo-example-systems',name:'Example Systems (demo)'},{id:'demo-example-compute',name:'Example Compute (demo)'}], placements: {S:[index ? 'demo-example-compute' : 'demo-example-systems'], A:[], B:[index ? 'demo-example-systems' : 'demo-example-compute'], unranked:[]} }));
}

function baseDemoFixtures(date) {
 const roles=[['robinhood','Robinhood','Backend Engineer','FT'],['stripe','Stripe','Infrastructure Engineer','FT'],['nvidia','NVIDIA','ML Systems Intern','Internship'],['databricks','Databricks','Distributed Systems Engineer','FT']].map(([key,company,title,employmentType])=>({id:`demo-${key}`,company,title,employmentType,location:'Remote / San Francisco',category:'Infrastructure',applicationUrl:'#',discoveredDate:date,whyItFits:'Illustrative role for demo mode. Explore infrastructure, performance and reliable distributed systems.',sourceFreshness:'Mock listing'}));
 const referrals=[{id:'demo-rh-contact',company:'Robinhood',contact:'Alex Morgan (demo)',contactType:'recruiter',title:'Backend Engineer',status:'Not asked',subject:'Backend engineering at Robinhood',message:'Hi Alex,\n\nI’m interested in backend engineering at Robinhood and the infrastructure behind reliable financial products. What is the best next step to discuss opportunities on your team?\n\nThanks,\nDemo Candidate',notes:'Fictional contact for demo mode.'},{id:'demo-stripe-contact',company:'Stripe',contact:'Jamie Chen (demo)',contactType:'senior',title:'Infrastructure Engineer',status:'Asked',message:'Hi Jamie,\n\nI’m exploring infrastructure engineering at Stripe and would love to learn more about the systems behind reliable payments. Would you be open to pointing me toward the right team or recruiting contact?\n\nThanks,\nDemo Candidate',notes:'Fictional contact for demo mode.'}];
 for(const contact of referrals){contact.evidence='I built a sample distributed query service during my demo internship.';contact.reason=`The infrastructure work at ${contact.company} interests me.`;}
 const applications=Object.fromEntries(roles.slice(0,2).map((role,i)=>[role.id,{...role,url:'#',status:i?'Blocked':'Awaiting approval',revision:0,resumeId:'demo-resume',questionsReviewed:false,questions:[{id:'demo-question',question:'Why this team?',answer:'I’m interested in the reliability and performance challenges of your infrastructure.'}],blocker:i?'Demo: review an unfamiliar application question.':'',activity:[],submissionAttempts:[]}]));
 const deadline=new Date(Date.parse(date+'T00:00:00Z')+7*86400000).toISOString().slice(0,10);
 const preparationPlans={'demo-robinhood':createPreparationPlan({application:applications['demo-robinhood'],deadline:{date:deadline,stage:'Technical interview (demo)',confirmed:true,source:{kind:'manual'}},dailyMinutes:45,now:date})};
 return {roles,state:{progress:{xp:275,xpAwards:{},streakDays:[date]},tracker:{ids:['demo-robinhood','demo-stripe'],items:{'demo-robinhood':{status:'Applied',openedDate:date,appliedDate:date},'demo-stripe':{status:'Interview',openedDate:date}}},drops:{seenDropIds:[],packStamps:{},packRewards:{}},network:{referrals,people:[]},workflow:{applications,preparationPlans,profile:{name:'Demo Candidate',firstName:'Demo',lastName:'Candidate',email:'candidate@example.com',location:'New York, NY',headline:'Software engineer',skills:'Go, Python, PostgreSQL, distributed systems',workExperience:[{company:'Example Systems',title:'Software Engineering Intern',description:'Built and profiled a sample distributed query service.'}],education:[{school:"Example University",degree:"BS",fieldOfStudy:"Computer Science"}],projects:[{name:"Query Lab (demo)",role:"Developer",description:"Fictional distributed query project."}],setupAgent:"own",setupAgentName:"Muse",verified:false},resumes:[{id:'demo-resume',name:'Demo backend résumé',variant:'Backend',version:1}],savedAnswers:[{id:"demo-answer",question:"Why infrastructure?",answer:"I enjoy debugging reliability and performance problems.",companyScope:"",policy:"ask",verified:false}],deletedAnswerIds:[],cloudDirty:false,searchPreferences:{profiles:demoSearchProfiles(),quietMode:{cadence:"daily",timezone:"America/New_York",digestHour:18,digestDay:1,urgentDeadlineHours:24}},tierLists:demoTierLists(),activeTierListId:'demo-ft-tiers'},ui:{packOpen:false}}};
}

// Extend the established admin demo; its profile, referrals, progress and tier
// fixtures remain the starting point. Feature scenarios share its memory store.
export function demoFixtures(date) {
 const base=baseDemoFixtures(date),muse=createDemoWorkspace(date);
 const roles=[...base.roles,...muse.demo.roles];
 const baseApplications=Object.fromEntries(Object.entries(base.state.workflow.applications).map(([id,value])=>[id,{...value,backendId:id,backendRevision:value.revision||0}]));
 const preparationPlans={...base.state.workflow.preparationPlans,...muse.workflow.preparationPlans};
 const basePreparationRows=Object.fromEntries(Object.entries(base.state.workflow.preparationPlans).map(([id,plan])=>[id,{application_id:id,user_id:muse.demo.identity,plan,version:1,updated_at:muse.demo.createdAt}]));
 const state={
  ...base.state,
  tracker:{...base.state.tracker,ids:[...new Set([...base.state.tracker.ids,...muse.tracker.ids])],items:{...base.state.tracker.items,...muse.tracker.items}},
  workflow:{
   ...base.state.workflow,
   applications:{...baseApplications,...muse.workflow.applications},preparationPlans,
   resumes:[...base.state.workflow.resumes,...muse.workflow.resumes],
   searchPreferences:{...muse.workflow.searchPreferences,...base.state.workflow.searchPreferences,targetsVersion:1,targets:[{id:"demo-board",name:"Example Jobs (demo)",kind:"board",address:"https://example.com/jobs"},{id:"demo-careers",name:"Example Systems careers (demo)",kind:"careers",address:"https://example.com/careers"},{id:"demo-social",name:"Example community (demo)",kind:"social",address:"@example_demo"}]},
  },
  demo:{...muse.demo,roles,preparationRows:{...basePreparationRows,...muse.demo.preparationRows}},
 };
 return {roles,state};
}
