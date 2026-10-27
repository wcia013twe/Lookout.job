import test from 'node:test';
import assert from 'node:assert/strict';
import {interviewingCompanies,companySpaces,companyTopics,companyConversations,companyActivity} from '../lib/company-spaces.mjs';
import {demoFixtures} from '../next-app/lib/demo.mjs';
import {createCircleKnowledgeDemo} from '../lib/circle-knowledge-demo.mjs';
import {validateKnowledge} from '../supabase/functions/agent-gateway/knowledge.mjs';

test('recommendations use current owned interview progress and deduplicate company processes',()=>{
 const applications={a:{company:'Bloomberg',title:'New grad',status:'Applied'},b:{company:'Bloomberg',title:'Backend',status:'Interview'},c:{company:'Stripe',title:'Infrastructure',status:'Applied'},d:{company:'Closed',status:'Rejected'},e:{company:'Offer company',status:'Offer'},f:{company:'Screening',status:'OA'},g:{company:'Withdrawn company',status:'Withdrawn'}};
 const tracker={ids:Object.keys(applications),items:{a:{status:'Interview'},d:{status:'Interview'},g:{status:'Interview'}}};
 const result=interviewingCompanies({applications,tracker});
 assert.deepEqual(result.map(row=>row.company),['Bloomberg','Screening']);
 assert.equal(result[0].stage,'Interview');
});
test('company grouping preserves source contexts and excludes unpublished revisions and replies',()=>{
 const base={id:'one',parentId:null,state:'published',revision:1,publishedRevision:1,content:{company:'Bloomberg',type:'interview_report',contexts:[{kind:'application',company:'Bloomberg'},{kind:'application',company:'Stripe',role:'Infra'}]}};
 const result=companySpaces([base,{...base,id:'draft',revision:2},{...base,id:'withdrawn',state:'withdrawn'},{...base,id:'reply',parentId:'one'}],[{key:'bloomberg',company:'Bloomberg',role:'New grad',stage:'Interview'}]);
 assert.deepEqual(result.map(space=>[space.company,space.posts.length]),[['Bloomberg',1],['Stripe',1]]);
 assert.equal(result[0].recommended,true);assert.equal(result[0].role,'New grad');
 assert.deepEqual(companyTopics(result[0].posts),['Interview experiences']);
});
test('Bloomberg company space is grounded in the shared resettable demo and scoped search contract',()=>{
 const fixture=demoFixtures('2026-10-27'),recommendations=interviewingCompanies({roles:fixture.roles,tracker:fixture.state.tracker,applications:fixture.state.workflow.applications});
 assert.equal(recommendations.find(row=>row.company==='Bloomberg').stage,'Technical interview');
 const demo=createCircleKnowledgeDemo(),payload={scope:'current_memberships',company:'Bloomberg',sort:'newest',limit:50};
 validateKnowledge('knowledge.search',payload);
 const posts=demo.action('knowledge.search',payload).items;
 assert.equal(posts.length,3);assert(posts.every(post=>post.content.uncertainty.includes('Fictional')));
 const bloomberg=companySpaces(posts,recommendations).find(row=>row.company==='Bloomberg');
 assert.deepEqual(companyTopics(bloomberg.posts),['Interview experiences','Recruiting timelines','Questions & advice']);
 for(const post of bloomberg.posts)assert.equal(demo.action('knowledge.read',{circleId:post.circleId,postId:post.id}).post.id,post.id);
 assert.equal(createCircleKnowledgeDemo().action('knowledge.search',payload).items.length,3);
});

test('conversation previews prioritize the owned stage and role without mixing company contexts',()=>{
 const post=(id,stage,role,date='2026-10-26')=>({id,parentId:null,state:'published',revision:1,publishedRevision:1,content:{company:'Bloomberg',stage,role,experienceDate:date}});
 const posts=[post('newer-screen','Recruiter screen','New Grad Software Engineer','2026-10-27'),post('technical','Technical interview','New Grad Software Engineer','2026-10-25'),post('senior','Technical interview','Senior Engineer'),{...post('mixed','Offer','Other'),content:{company:'Bloomberg',stage:'Offer',role:'Other',contexts:[{kind:'application',company:'Stripe',stage:'Technical interview',role:'New Grad Software Engineer'}]}}];
 const previews=companyConversations({key:'bloomberg',stage:'Technical interview',level:3,role:'New Grad Software Engineer',posts},4);
 assert.deepEqual(previews.map(item=>item.post.id),['technical','senior','newer-screen','mixed']);
 assert.equal(previews.at(-1).stage,'Offer');
 assert.equal(previews.at(-1).role,'Other');
});

test('company activity counts source records without inventing population totals or availability',()=>{
 const now=Date.parse('2026-10-27T16:00:00Z');
 const roles=[{id:'a',company:'Bloomberg',applicationUrl:'https://example.com/a',postingObservation:{checkedAt:'2026-10-27T10:00:00Z',liveness:'active'}},{id:'duplicate',company:'Bloomberg',applicationUrl:'https://example.com/a',postingObservation:{checkedAt:'2026-10-27T10:00:00Z',liveness:'active'}},{id:'old',company:'Bloomberg',postingObservation:{checkedAt:'2026-10-20T10:00:00Z',liveness:'active'}},{id:'unknown',company:'Bloomberg'},{id:'other',company:'Stripe',postingObservation:{checkedAt:'2026-10-27T10:00:00Z',liveness:'active'}}];
 const post={id:'p',parentId:null,state:'published',revision:1,publishedRevision:1,authorId:'same-stage-person',content:{type:'interview_report',stage:'Technical interview'}};
 const result=companyActivity({key:'bloomberg',posts:[post,post,{...post,id:'draft',revision:2}]},{roles,partial:true,now});
 assert.equal(result.activeJobs,1);assert.equal(result.activeJobsPartial,true);assert.equal(result.sharedInsights,1);assert.equal(result.insightsPartial,true);
 assert.equal(result.applicants,null);assert.equal(result.atYourStage,null);
 const unavailable=companyActivity({key:'missing',posts:[]},{roles,partial:true,now});
 assert.equal(unavailable.activeJobs,null);assert.equal(unavailable.sharedInsights,null);
});
