import test from 'node:test';
import assert from 'node:assert/strict';
import {buildInterviewPipelines,interviewPipelineOrder,latestCompanyResearch,answerEntry,practiceCategory,readStructuredAnswer,answerSections,roundMaterials,isInterviewPrepEligible} from '../lib/interview-prep.mjs';

const app=(id,company='Example')=>({id,company,title:'Engineer',milestones:[]});
const progressed=(id,company='Example')=>({...app(id,company),milestones:[{id:`${id}-technical`,kind:'technical_round',phase:'scheduled',round:{stage:'INTERVIEW',type:'technical'}}]});
const artifact=(id,kind,links=[],extra={})=>({id,content:{id,kind,title:id,links,...extra}});

test('projects only explicit application links and preserves unassigned materials',()=>{
 const applications=[progressed('app-1','SameCo'),progressed('app-2','SameCo')];
 const linked=artifact('research','company_research',[{applicationId:'app-1'}]);
 const unlinked=artifact('guess','interview_brief',[],{company:'SameCo'});
 const unrelated=artifact('other-company','notes',[{company:'SameCo'}],{company:'SameCo'});
 const result=buildInterviewPipelines([linked,unlinked,unrelated],applications,'2026-11-13');
 assert.deepEqual(result.pipelines[0].active.map(row=>row.item.id),['research']);
 assert.deepEqual(result.pipelines[1].active,[]);
 assert.deepEqual(result.unassigned.map(row=>row.item.id),['guess','other-company']);
});

test('only applications with explicit progress beyond screening receive pipelines',()=>{
 const initial=app('initial');
 const screening={...app('screening'),milestones:[{id:'screen',kind:'phone_screen',phase:'scheduled',round:{stage:'SCREEN',type:'recruiter'}}]};
 const confirmedNext={...app('next'),milestones:[{id:'tech',kind:'technical_round',phase:'scheduled',round:{stage:'INTERVIEW',type:'technical'}}]};
 const completedScreen={...app('completed-screen'),milestones:[{id:'screen-done',kind:'phone_screen',phase:'completed',round:{stage:'SCREEN',type:'recruiter'}}]};
 const nextAfterScreen={...app('next-after-screen'),milestones:[{id:'screen-done-2',kind:'phone_screen',phase:'completed',round:{stage:'SCREEN',type:'recruiter'}},{id:'behavioral',kind:'interview',phase:'scheduled',round:{stage:'INTERVIEW',type:'behavioral'}}]};
 const rows=[artifact('initial-material','practice',[{applicationId:'initial'}]),artifact('screen-material','notes',[{applicationId:'screening'}]),artifact('completed-screen-material','notes',[{applicationId:'completed-screen'}])];
 assert.equal(isInterviewPrepEligible(initial),false);
 assert.equal(isInterviewPrepEligible(screening),false);
 assert.equal(isInterviewPrepEligible(completedScreen),false);
 assert.equal(isInterviewPrepEligible(confirmedNext),true);
 assert.equal(isInterviewPrepEligible({...confirmedNext,archived:true,status:'Rejected'}),true);
 assert.equal(isInterviewPrepEligible(nextAfterScreen),true);
 const result=buildInterviewPipelines(rows,[initial,screening,completedScreen,confirmedNext,nextAfterScreen],'2026-11-16');
 assert.deepEqual(result.pipelines.map(row=>row.application.id),['next','next-after-screen']);
 assert.deepEqual(result.unassigned.map(row=>row.item.id),['initial-material','screen-material','completed-screen-material']);
});

test('completed screening alone remains out, completed screening plus an interview round qualifies',()=>{
 const screening={...app('screen-complete'),imported:{record:{rounds:[{id:'s',label:'Recruiter screen',stage:'SCREEN',type:'recruiter',phase:'completed',date:null,notes:'',cancelled:false}]}}};
 const progressed={...app('past-process'),status:'Submitted',imported:{record:{rounds:[{id:'s',label:'Recruiter screen',stage:'SCREEN',type:'recruiter',phase:'completed',date:null,notes:'',cancelled:false},{id:'t',label:'Technical round',stage:'INTERVIEW',type:'technical',phase:'completed',date:'2026-10-01',notes:'',cancelled:false}]}}};
 assert.equal(isInterviewPrepEligible(screening),false);
 assert.equal(isInterviewPrepEligible(progressed),true);
 const [pipeline]=buildInterviewPipelines([artifact('past-notes','interview_debrief',[{applicationId:'past-process'}])],[progressed],'2026-11-16').pipelines;
 assert.equal(pipeline.application.id,'past-process');
 assert.equal(interviewPipelineOrder([pipeline],'2026-11-16')[0].group,'Previous');
});

test('classifies preparation and orders upcoming, undated active, then previous',()=>{
 const materials=[
  artifact('future','practice',[{applicationId:'app-1'}],{prepOn:'2026-11-20'}),
  artifact('undated','story_bank',[{applicationId:'app-1'}]),
  artifact('past','interview_debrief',[{applicationId:'app-1'}],{prepOn:'2026-11-01'}),
  artifact('brief','interview_brief',[{applicationId:'app-1'}],{preparedFor:'2026-11-22'}),
  artifact('research','read_up',[{applicationId:'app-1'}]),
 ];
 const {pipelines}=buildInterviewPipelines(materials,[progressed('app-1')],'2026-11-13');
 const pipeline=pipelines[0];
 assert.deepEqual(pipeline.upcoming.map(row=>[row.item.id,row.kind]),[['future','practice'],['brief','round brief']]);
 assert.deepEqual(pipeline.active.map(row=>[row.item.id,row.kind]),[['undated','reusable answer'],['research','research']]);
 assert.deepEqual(pipeline.previous.map(row=>[row.item.id,row.kind]),[['past','notes']]);
});

test('retains duplicate source rows and excludes completed or cancelled prep from active buckets',()=>{
 const duplicate=artifact('same','practice',[{applicationId:'app-1'}]);
 const completed=artifact('done','mock_interview',[{applicationId:'app-1'}],{sessionStatus:'completed'});
 const cancelled=artifact('cancelled','practice',[{applicationId:'app-1'}],{sessionStatus:'cancelled'});
 const {pipelines}=buildInterviewPipelines([duplicate,duplicate,completed,cancelled],[progressed('app-1')],'2026-11-13');
 assert.deepEqual(pipelines[0].active.map(row=>row.item.id),['same','same']);
 assert.deepEqual(pipelines[0].previous.map(row=>row.item.id),['done','cancelled']);
});

test('does not infer links from company or round dates and exposes real application rounds separately',()=>{
 const application={...app('app-1'),milestones:[{id:'round-1',kind:'technical_round',label:'Technical',phase:'scheduled',confirmation:'confirmed',occurred_at:'2026-11-20T10:00:00Z'}]};
 const result=buildInterviewPipelines([artifact('company-only','company_research',[],{company:'Example'})],[application],'2026-11-13');
 assert.equal(result.unassigned[0].item.id,'company-only');
 assert.equal(result.pipelines[0].rounds[0].id,'round-1');
 assert.equal(result.pipelines[0].upcoming.length,0);
});

test('keeps unknown application links and unclassified saved materials accessible as unassigned',()=>{
 const unknown=artifact('unknown','practice',[{applicationId:'missing-app'}]);
 const unclassified=artifact('future-kind','new_saved_kind',[],{body:'Saved data'});
 const {unassigned,pipelines}=buildInterviewPipelines([unknown,unclassified],[progressed('app-1')],'2026-11-13');
 assert.deepEqual(unassigned.map(row=>row.item.id),['unknown','future-kind']);
 assert.deepEqual(pipelines[0].active,[]);
});

test('selects company research history by explicit application link and latest saved timestamp',()=>{
 const old=artifact('old','company_research',[{applicationId:'app-1'}],{updatedAt:'2026-01-01'});
 const latest=artifact('latest','company_research',[{applicationId:'app-1'}],{updatedAt:'2026-03-01'});
 const unrelated=artifact('unrelated','company_research',[{applicationId:'app-2'}],{updatedAt:'2027-01-01'});
 assert.deepEqual(latestCompanyResearch([old,latest,unrelated],app('app-1')).map(row=>row.id),['latest','old']);
});

test('reads answer bank sections and explicit practice categories without inventing body formats',()=>{
 const answer=artifact('answer','story_bank',[],{body:'# Category\nLeadership\n# Status\nReady\n# Question\nTell me about a time\n# Answer\nI built a system.\n# Experiences\nPlatform migration\n# Company adaptation\nConnect to their scale.'});
 const practice=artifact('practice','practice',[],{category:'Systems design'});
 assert.deepEqual(answerEntry(answer),{category:'Leadership',status:'Ready',question:'Tell me about a time',answer:'I built a system.',experiences:'Platform migration',companyAdaptation:'Connect to their scale.'});
 assert.equal(practiceCategory(practice),'Systems design');
 assert.equal(practiceCategory(artifact('plain','practice')),'Practice');
});

test('orders pipelines by actual round dates rather than material preparation dates',()=>{
 const round=(id,date,phase='scheduled')=>({id,date,phase,cancelled:false});
 const pipelines=[
  {application:app('undated'),rounds:[]},
  {application:app('later'),rounds:[round('later-round','2026-12-01')]},
  {application:app('past'),rounds:[round('past-round','2026-10-01','completed')]},
  {application:app('sooner'),rounds:[round('soon-round','2026-11-18')]},
  {application:{...app('archived'),archived:true},rounds:[round('future','2026-12-10')]},
 ];
 const ordered=interviewPipelineOrder(pipelines,'2026-11-16');
 assert.deepEqual(ordered.map(row=>row.application.id),['sooner','later','undated','past','archived']);
 assert.equal(ordered[2].group,'Active · date not set');
});

test('structured answers preserve paragraphs and unfamiliar layouts stay raw',()=>{
 const values=['Behavioral questions','Needs Review','A question','First paragraph.\n\nSecond paragraph.\n### Supporting detail\nKeep this.','Experience','Adaptation'];
 const body=answerSections.map((heading,index)=>`## ${heading}\n${values[index]}`).join('\n\n');
 assert.equal(readStructuredAnswer(body).Answer,values[3]);
 assert.equal(readStructuredAnswer('Legacy notes\n'+body),null);
 assert.equal(readStructuredAnswer(body+'\n## Unknown\nPreserve me'),null);
 assert.equal(readStructuredAnswer(body.replace('Needs Review','Unknown')),null);
});

test('round materials require the same explicit application and preparation task link',()=>{
 const tasks=[{id:'task-1',roundId:'round-1'},{id:'task-2',roundId:'round-2'}];
 const items=[artifact('correct','notes',[{applicationId:'app-1',taskId:'task-1'}]),artifact('round-id-not-task','notes',[{applicationId:'app-1',taskId:'round-1'}]),artifact('other-round','notes',[{applicationId:'app-1',taskId:'task-2'}]),artifact('cross-link','notes',[{applicationId:'app-1'},{applicationId:'other',taskId:'task-1'}])];
 assert.deepEqual(roundMaterials(items,['app-1'],tasks,'round-1').map(item=>item.id),['correct']);
});
