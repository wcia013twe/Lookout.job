import {demoFixtures as baseFixtures} from './demo.mjs';
import {emptyCompany,encodeCompany,processTag} from '../../lib/network-model.mjs';
// Extend the established demo without coupling company fixtures to application fixtures.
export function demoFixtures(date){
 const fixtures=baseFixtures(date);
 const companies=[
 {id:'dddddddd-1111-4111-8111-111111111111',revision:1,record:{...emptyCompany('Cedar Systems (demo)'),priority:'Apply Now',interest:'Fictional database infrastructure team; a chance to build on the Query Lab project.',targetTeams:'Storage and query execution',concerns:'Verify mentorship and production ownership.',research:'Fictional company building PostgreSQL-backed job processing. Team scope is unconfirmed.',nextAction:'Ask the recruiter about storage-team scope',followUpDate:date,sources:[{title:'Fictional engineering brief',url:'https://example.com/cedar-engineering',observedAt:date,summary:'Demo evidence only: query plans, retries, and backpressure.'}]}},
 {id:'dddddddd-2222-4222-8222-222222222222',revision:1,record:{...emptyCompany('Northstar Compute (demo)'),interest:'Research-only target with no application or contact yet.',targetTeams:'Inference scheduling',nextAction:'Research team ownership and hiring plans'}},
 {id:'dddddddd-3333-4333-8333-333333333333',revision:1,record:{...emptyCompany('Archived Example (demo)'),archived:true,nextAction:'Paused follow-up',followUpDate:date}}
 ];
 fixtures.state.network.referrals=[...fixtures.state.network.referrals,...companies.map(encodeCompany)];
 const cedar=Object.values(fixtures.state.workflow.applications).find(a=>a.company==='Cedar Systems (demo)');
 if(cedar){
  fixtures.state.network.referrals.push(
   {id:'demo-process-recruiter',collection:'network-demo',company:cedar.company,contact:'Morgan (fictional)',contactType:'recruiter',title:cedar.title,tags:[processTag(cedar)],status:'Asked',subject:'Backend round at Cedar',message:'Hi Morgan, thanks for confirming the backend round. Is there any additional preparation material for the PostgreSQL and queue-reliability discussion?',source:'Demo'},
   {id:'demo-company-engineer',collection:'network-demo',company:cedar.company,contact:'Taylor (fictional)',contactType:'engineer',title:'Storage Engineer',status:'Replied',message:'Hi Taylor, thank you for sharing the engineering overview. I appreciate your advice about the storage team.',source:'Demo'}
  );
  const id='demo-cedar-platform';
  const role={id,company:cedar.company,title:'Platform Engineer (demo)',employmentType:'FT',location:'Fictional City, Remote',priority:'Strong Consider',applicationUrl:'https://example.com/cedar-platform',whyItFits:'Fictional second process at the same company; outreach stays separate from the backend role.'};
  fixtures.roles.push(role);if(fixtures.state.demo.roles!==fixtures.roles)fixtures.state.demo.roles.push(role);
  fixtures.state.workflow.applications[id]={...role,backendId:'dddddddd-4444-4444-8444-444444444444',status:'Submitted',questions:[],url:role.applicationUrl};
  fixtures.state.tracker.ids.push(id);fixtures.state.tracker.items[id]={status:'Applied',openedDate:date,appliedDate:date};
 }
 return fixtures;
}
