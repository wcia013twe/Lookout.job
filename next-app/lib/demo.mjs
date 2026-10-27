import { discoverPreviewRoles } from './discover-preview-demo.mjs';
import {defaultDailySchedule} from '../../lib/daily-schedule.mjs';
import { profileFromPrompt, initialPrompt, updateField } from '../../lib/search-profile.mjs';
import { createPreparationPlan } from '../../lib/preparation-model.mjs';
import { createDemoWorkspace } from './muse-demo-fixtures.mjs';
export { createDemoServices } from './muse-demo-fixtures.mjs';
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
   ['Application answers', 'Requires sponsorship', 'No'],
   ['Application answers', 'Earliest start date', '2027-06-01'],
   ['Application answers', 'Graduation month', '2027-06'],
   ['Application answers', 'Degree pursued', "Bachelor's"],
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
 const brands=['NVIDIA','Databricks','Google','Oracle','Stripe','Robinhood'];
 return ['FT', 'Internship'].map((employmentType, index) => ({
  id:index?'demo-intern-tiers':'demo-ft-tiers',name:(index?'Internship':'Full-time')+' company priorities (demo)',employmentType,
  description:'Illustrative demo rankings only; includes fictional employers and real brand names, not a personal assessment.',
  tiers:['S','A','B','C','D'].map(id=>({id,label:id})),
  companies:[{id:'demo-example-systems',name:'Example Systems (demo)'},{id:'demo-example-compute',name:'Example Compute (demo)'},...brands.map((name,i)=>({id:`demo-brand-${i}`,name}))],
  placements:{S:[index?'demo-example-compute':'demo-example-systems','demo-brand-1','demo-brand-2'],A:['demo-brand-0','demo-brand-4'],B:[index?'demo-example-systems':'demo-example-compute','demo-brand-5'],C:[],D:['demo-brand-3'],unranked:[]}
 }));
}

function baseDemoFixtures(date) {
 const roles=[['robinhood','Robinhood','Backend Engineer, Distributed Systems and Reliability','FT'],['stripe','Stripe','Infrastructure Engineer','FT'],['nvidia','NVIDIA','ML Systems Intern','Internship'],['databricks','Databricks','Distributed Systems Engineer','FT']].map(([key,company,title,employmentType])=>({id:`demo-${key}`,company,title,employmentType,location:'Remote / San Francisco',category:'Infrastructure',applicationUrl:'#',discoveredDate:date,whyItFits:'Illustrative role for demo mode. Explore infrastructure, performance and reliable distributed systems.',sourceFreshness:'Mock listing'}));
 const referrals=[{id:'demo-rh-contact',company:'Robinhood',contact:'Alex Morgan (demo)',contactType:'recruiter',title:'Backend Engineer',status:'Not asked',subject:'Backend engineering at Robinhood',message:'Hi Alex,\n\nI’m interested in backend engineering at Robinhood and the infrastructure behind reliable financial products. What is the best next step to discuss opportunities on your team?\n\nThanks,\nDemo Candidate',notes:'Fictional contact for demo mode.'},{id:'demo-stripe-contact',company:'Stripe',contact:'Jamie Chen (demo)',contactType:'senior',title:'Infrastructure Engineer',status:'Asked',message:'Hi Jamie,\n\nI’m exploring infrastructure engineering at Stripe and would love to learn more about the systems behind reliable payments. Would you be open to pointing me toward the right team or recruiting contact?\n\nThanks,\nDemo Candidate',notes:'Fictional contact for demo mode.'}];
 for(const contact of referrals){contact.evidence='I built a sample distributed query service during my demo internship.';contact.reason=`The infrastructure work at ${contact.company} interests me.`;}
 const applications=Object.fromEntries(roles.slice(0,2).map((role,i)=>[role.id,{...role,url:'#',status:i?'Blocked':'Awaiting approval',revision:0,resumeId:'demo-resume',inspectedAt:'2026-10-26T12:00:00Z',inspectionComplete:false,questionsReviewed:false,questions:[{id:'demo-email-direct',question:'Email',answer:''},{id:'demo-question',question:'Why this team?',answer:'I’m interested in the reliability and performance challenges of your infrastructure.'},...(i?[{id:'demo-missing-schedule',question:'When can you start? (demo)',answer:''}]:[])],blocker:i?'Demo: review an unfamiliar application question.':'',activity:[],submissionAttempts:[]}]));
 const deadline=new Date(Date.parse(date+'T00:00:00Z')+7*86400000).toISOString().slice(0,10);
 const preparationPlans={'demo-robinhood':createPreparationPlan({application:applications['demo-robinhood'],deadline:{date:deadline,stage:'Technical interview (demo)',confirmed:true,source:{kind:'manual'}},dailyMinutes:45,now:date})};
 return {roles,state:{progress:{xp:275,xpAwards:{},streakDays:[date]},tracker:{ids:['demo-robinhood','demo-stripe','demo-nvidia'],items:{'demo-nvidia':{status:'New',openedDate:date},'demo-robinhood':{status:'Applied',openedDate:date,appliedDate:date},'demo-stripe':{status:'Interview',openedDate:date}}},drops:{seenDropIds:[],packStamps:{},packRewards:{}},network:{referrals,people:[]},workflow:{applications,preparationPlans,profile:{name:'Demo Candidate',firstName:'Demo',lastName:'Candidate',email:'candidate@example.com',phone:'+1 202-555-0142',birthday:'2000-06-15',address:'123 Example Street',address2:'Apt 4',postalCode:'10001',preferredName:'Demo',location:'New York, NY',headline:'Software engineer',skills:'Go, Python, PostgreSQL, distributed systems',preferredSkills:['Go','PostgreSQL'],languages:'English\nSpanish',workExperience:[{company:'Example Systems',title:'Software Engineering Intern',location:'New York, NY',employmentType:'Internship',startDate:'2026-06',endDate:'2026-08',current:false,description:'Built and profiled a sample distributed query service.\nCompared cache strategies and documented reliability tradeoffs with a fictional infrastructure team.'},{company:'Example Compute Lab',title:'Student Developer',location:'Remote',employmentType:'Part-time',startDate:'2025-09',current:true,description:'Maintains an illustrative query-planning benchmark and shares reproducible results.'}],education:[{school:"Example University",degree:"BS",fieldOfStudy:"Computer Science",startDate:"2023-08",endDate:"2027-05",description:"Fictional systems and databases coursework."}],projects:[{name:"Query Lab (demo)",role:"Developer",description:"Fictional distributed query project."}],setupAgent:"own",setupAgentName:"Muse",verified:false},resumes:[{id:'demo-resume',name:'Demo backend résumé',variant:'Backend',version:1}],savedAnswers:[{id:"demo-answer",question:"Why infrastructure?",answer:"I enjoy debugging reliability and performance problems.",companyScope:"",policy:"ask",verified:false}],deletedAnswerIds:[],cloudDirty:false,theme:{pack:'base'},searchPreferences:{profiles:demoSearchProfiles(),quietMode:{cadence:"daily",timezone:"America/New_York",digestHour:18,digestDay:1,urgentDeadlineHours:24}},tierLists:demoTierLists(),activeTierListId:'demo-ft-tiers'},ui:{packOpen:false}}};
}

// Extend the detached fictional demo; its profile, referrals, progress and tier
// fixtures remain the starting point. Feature scenarios share its memory store.
export function demoFixtures(date) {
 const base=baseDemoFixtures(date),muse=createDemoWorkspace(date);
 const bloomberg={id:'demo-bloomberg',company:'Bloomberg',title:'New Grad Software Engineer',employmentType:'FT',location:'New York, NY',category:'Backend',applicationUrl:'#',url:'#',discoveredDate:date,sourceFreshness:'Fictional demo',postingObservation:{checkedAt:new Date(Date.parse(date+'T00:00:00Z')).toISOString(),liveness:'active',postedAt:null,description:'Fictional availability for the isolated demo; no employer was checked.'},description:'Fictional role for the Community company-space demo. Not an employer posting.'};
 base.roles.push(bloomberg);base.state.tracker.ids.push(bloomberg.id);base.state.tracker.items[bloomberg.id]={status:'Interview',openedDate:date};
 base.state.workflow.applications[bloomberg.id]={...bloomberg,status:'Interview',revision:0,questions:[],activity:[],submissionAttempts:[],milestones:[{id:'demo-bloomberg-technical-stage',kind:'technical_round',label:'Technical interview',phase:'scheduled',occurred_at:null,source:{kind:'user_reported',note:'Fictional stage for the company-space demo.'}}]};
 const roles=[...discoverPreviewRoles(date),...base.roles,...muse.demo.roles].map(role => role.id === 'demo-interview' ? {...role, workSetting:'Remote (fictional demo)', sponsorship:'Not confirmed (demo)', description:'Fictional posting: build and debug PostgreSQL-backed job processing. Investigate retry safety, query latency and queue backpressure with a systems team.'} : role);
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
   searchPreferences:{...muse.workflow.searchPreferences,...base.state.workflow.searchPreferences,schedule:{...defaultDailySchedule("America/New_York"),routines:[...defaultDailySchedule().routines.map(r=>({...r,enabled:r.id!=="noon"})),{id:"demo-daily-task",title:"System design practice (demo)",description:"Review the fictional Query Lab design and note one tradeoff.",time:"17:30",enabled:true}]},targetsVersion:1,targets:[{id:"demo-board",name:"Example Jobs (demo)",kind:"board",address:"https://example.com/jobs"},{id:"demo-careers",name:"Example Systems careers (demo)",kind:"careers",address:"https://example.com/careers"},{id:"demo-social",name:"Example community (demo)",kind:"social",address:"@example_demo"},{id:"demo-data-careers",name:"Example Data infrastructure and developer platform careers (demo)",kind:"careers",address:"https://example.com/teams/infrastructure-and-developer-platform/careers"},{id:"demo-compute-board",name:"Example Compute Jobs (demo)",kind:"board",address:"https://example.com/compute-jobs"},{id:"demo-systems-social",name:"Example Systems community (demo)",kind:"social",address:"@example_systems_demo"}]},
  },
  demo:{...muse.demo,onboarding:{revision:0,step:"connection_pending",prompt:"Choose a companion and preview connecting.",data:{},tasks:[]},roles,preparationRows:{...basePreparationRows,...muse.demo.preparationRows}},
 };
 return {roles,state};
}

// Illustrative human handoffs only; these never authorize real account actions.
export const demoNeedsYouTasks = [
 {id:'application-review',title:'Review an application',context:'Example Systems · Backend Engineer',reason:'This company is above your review threshold.',action:'Review application',detail:'Review the backend resume and the answer: “I enjoy debugging reliability and performance problems.” Approval would allow this exact application version to proceed.',role:{company:'Example Systems',roleTitle:'Backend Engineer, Distributed Systems and Reliability',roleType:'Full-time',date:'Opened Oct 14',status:'Opened',workflow:'Awaiting approval'}},
 {id:'missing-answer',title:'Confirm a missing fact',context:'Example Compute · ML Systems Intern',reason:'The employer asks whether you can work onsite three days a week.',action:'Answer question',detail:'The fictional draft says “Yes.” Confirm or edit this answer before the application can proceed.'},
 {id:'manual-step',title:'Complete employer verification',context:'Example Data · Infrastructure Engineer',reason:'The employer form requires a CAPTCHA.',action:'View manual step',detail:'In a real application, open the employer form and complete verification yourself. This demo opens no external form.'},
 {id:'uncertain-submission',title:'Check whether an application submitted',context:'Example Search · Search Engineer',reason:'The submission timed out without an employer confirmation.',action:'Verify outcome',detail:'Check the employer portal and confirmation email first. Only a verified non-submission allows a fresh attempt; an observed submission should be recorded instead.'},
 {id:'deadline-confirmation',title:'Confirm an interview deadline',context:'Example Cloud · Technical interview',reason:'The invitation says Friday, but the scheduling link says Thursday.',action:'Review deadline',detail:'Ask the recruiter which date is correct before scheduling preparation. The demo assumes you have confirmed Thursday.'},
 {id:'outreach-review',title:'Review outreach before sending',context:'Example Platform · Alex Morgan (fictional contact)',reason:'A referral message is drafted and waiting for your permission.',action:'Review message',detail:'“Hi Alex, I’m exploring infrastructure engineering at Example Platform. Would you be open to pointing me toward the right recruiting contact?” Approval would permit sending; this demo sends nothing.'},
 {id:'reconnect-service',title:'Reconnect a required service',context:'Email · Interview preparation',reason:'Email access expired while checking an interview invitation.',action:'Preview reconnection',detail:'Reconnect email to resume checking the invitation. This demo requests no credentials and grants no account access.'},
];
