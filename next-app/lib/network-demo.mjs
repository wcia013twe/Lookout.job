import {demoFixtures as baseFixtures} from './demo.mjs';
import {emptyCompany,processTag} from '../../lib/network-model.mjs';
// Extend the established demo without coupling company fixtures to application fixtures.
export function demoFixtures(date){
 const fixtures=baseFixtures(date);
 const companies=[
 {id:'demo-stripe-target',revision:1,record:{...emptyCompany('Stripe'),website:'https://stripe.com',priority:'Apply Now',targetTeams:'Software Engineer, New Grad · Backend & infrastructure',
 research:'Stripe builds software for accepting payments and operating internet businesses. For this new-grad scenario, focus on backend reliability: request retries, safe state transitions, and dependable APIs. Team placement is still unknown; clarify that before treating the broad role as an infrastructure opportunity.',
 interest:'Your fictional Query Lab project and Go/PostgreSQL internship give you a concrete story about query latency and reliability. Use that evidence to explain how you debug a system, measure a change, and handle failures.',
 concerns:'You have not demonstrated production payments experience. Verify new-grad eligibility, the actual team, mentorship and on-call expectations; do not assume a broad SWE role guarantees infrastructure work.',
 nextAction:'Ask Jamie how new grads are matched to backend teams, then tailor your Query Lab story to the team’s work.',
 sources:[{title:'Stripe company website',url:'https://stripe.com',observedAt:date,summary:'Reference link for this authored demo. Live role availability and eligibility have not been verified.'}],contactIds:['demo-stripe-alum'],applicationIds:['demo-stripe']}}
,
 {id:'dddddddd-1111-4111-8111-111111111111',revision:1,record:{...emptyCompany('Cedar Systems (demo)'),priority:'Strong Consider',interest:'Fictional database infrastructure team; a chance to build on the Query Lab project.',targetTeams:'Storage and query execution',concerns:'Verify mentorship and production ownership.',research:'Fictional company building PostgreSQL-backed job processing. Team scope is unconfirmed.',nextAction:'Ask the recruiter about storage-team scope',followUpDate:date,sources:[{title:'Fictional engineering brief',url:'https://example.com/cedar-engineering',observedAt:date,summary:'Demo evidence only: query plans, retries, and backpressure.'}]}},
 {id:'dddddddd-2222-4222-8222-222222222222',revision:1,record:{...emptyCompany('Northstar Compute (demo)'),targetTeams:'Inference scheduling',nextAction:'Research team ownership and hiring plans'}},
 {id:'dddddddd-3333-4333-8333-333333333333',revision:1,record:{...emptyCompany('Archived Example (demo)'),archived:true,nextAction:'Paused follow-up',followUpDate:date}}
 ];
 // The Stripe scenario is authored demo content, never an inferred real recommendation.
 fixtures.state.network.companies=companies;
 fixtures.state.demo.networkTakeaways={'demo-stripe-target':[
  {text:'Use Query Lab to explain retry safety. Walk through a request that succeeds but times out, how you would avoid a duplicate effect, and what evidence you would inspect.',postId:'demo-stripe-retries',label:'Maya’s interview note',circleId:'demo-circle'},
  {text:'Clarify team matching with Jamie before over-investing in a broad new-grad title. Ask when placement happens and what a backend team’s first project could involve.',postId:'demo-stripe-placement',label:'Priya’s team-placement note',circleId:'demo-circle'}
 ]};
 fixtures.state.network.referrals=[];
 // Archived migration evidence exercises duplicate IDs and malformed legacy notes.
 fixtures.state.network.companies.push({id:'demo-legacy-duplicate',revision:4,companyId:null,needsReview:true,legacyNotes:'{unparsed legacy notes',record:{...emptyCompany('Cedar Systems (demo)'),research:'{unparsed legacy notes',archived:true}});
 const stripe=fixtures.state.workflow.applications['demo-stripe'];
 if(stripe){Object.assign(stripe,{title:'Software Engineer, New Grad',url:'https://example.com/demo/stripe-new-grad',applicationUrl:'https://example.com/demo/stripe-new-grad',note:'Fictional new-grad scenario. No live posting or application.'});}
 for(const roles of [fixtures.roles,fixtures.state.demo.roles])for(const role of roles)if(role.id==='demo-stripe')Object.assign(role,{title:'Software Engineer, New Grad',applicationUrl:'https://example.com/demo/stripe-new-grad',url:'https://example.com/demo/stripe-new-grad'});
 fixtures.state.network.referrals.push({id:'demo-stripe-alum',company:'Stripe',contact:'Jamie Chen (fictional)',contactType:'alumni',title:'Backend Engineer',status:'Not asked',tags:['application:demo-stripe'],source:'Demo',connection:'Fictional connection through the university systems club.',message:'Hi Jamie, I’m exploring a Stripe new-grad backend role. My Query Lab project gave me experience debugging PostgreSQL latency and retry behavior. How are new grads matched to infrastructure teams, and what would you ask to understand the team’s first-year scope? Thanks, Demo Candidate'});
 const cedar=Object.values(fixtures.state.workflow.applications).find(a=>a.company==='Cedar Systems (demo)');
 if(cedar){
  const platform={...structuredClone(cedar),id:'demo-cedar-platform',backendId:'demo-cedar-platform',title:'Platform Engineer',status:'Submitted',url:'https://example.com/demo/jobs/cedar-platform',applicationUrl:'https://example.com/demo/jobs/cedar-platform',milestones:[],activity:[],questions:[]};
  fixtures.state.workflow.applications[platform.id]=platform;
  fixtures.state.tracker.ids.push(platform.id);fixtures.state.tracker.items[platform.id]={status:'Submitted',openedDate:date,appliedDate:date};
  fixtures.roles.push(platform);if(fixtures.state.demo.roles!==fixtures.roles)fixtures.state.demo.roles.push(structuredClone(platform));
  fixtures.state.network.referrals.push(
   {id:'demo-process-recruiter',collection:'network-demo',company:cedar.company,contact:'Morgan (fictional)',contactType:'recruiter',title:cedar.title,tags:[processTag(cedar)],status:'Asked',subject:'Backend round at Cedar',message:'Hi Morgan, thanks for confirming the backend round. Is there any additional preparation material for the PostgreSQL and queue-reliability discussion?',source:'Demo'},
   {id:'demo-company-engineer',collection:'network-demo',company:cedar.company,contact:'Taylor (fictional)',contactType:'engineer',title:'Storage Engineer',status:'Replied',message:'Hi Taylor, thank you for sharing the engineering overview. I appreciate your advice about the storage team.',source:'Demo'}
  );

 }
 return fixtures;
}
