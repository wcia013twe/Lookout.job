import test from 'node:test';
import assert from 'node:assert/strict';
import {buildInterviewPipelines} from '../lib/interview-prep.mjs';

const app=(id,company='Example')=>({id,company,title:'Engineer',milestones:[]});
const artifact=(id,kind,links=[],extra={})=>({id,content:{id,kind,title:id,links,...extra}});

test('projects only explicit application links and preserves unassigned materials',()=>{
 const applications=[app('app-1','SameCo'),app('app-2','SameCo')];
 const linked=artifact('research','company_research',[{applicationId:'app-1'}]);
 const unlinked=artifact('guess','interview_brief',[],{company:'SameCo'});
 const unrelated=artifact('other-company','notes',[{company:'SameCo'}],{company:'SameCo'});
 const result=buildInterviewPipelines([linked,unlinked,unrelated],applications,'2026-11-13');
 assert.deepEqual(result.pipelines[0].active.map(row=>row.item.id),['research']);
 assert.deepEqual(result.pipelines[1].active,[]);
 assert.deepEqual(result.unassigned.map(row=>row.item.id),['guess','other-company']);
});

test('classifies preparation and orders upcoming, undated active, then previous',()=>{
 const materials=[
  artifact('future','practice',[{applicationId:'app-1'}],{prepOn:'2026-11-20'}),
  artifact('undated','story_bank',[{applicationId:'app-1'}]),
  artifact('past','interview_debrief',[{applicationId:'app-1'}],{prepOn:'2026-11-01'}),
  artifact('brief','interview_brief',[{applicationId:'app-1'}],{preparedFor:'2026-11-22'}),
  artifact('research','read_up',[{applicationId:'app-1'}]),
 ];
 const {pipelines}=buildInterviewPipelines(materials,[app('app-1')],'2026-11-13');
 const pipeline=pipelines[0];
 assert.deepEqual(pipeline.upcoming.map(row=>[row.item.id,row.kind]),[['future','practice'],['brief','round brief']]);
 assert.deepEqual(pipeline.active.map(row=>[row.item.id,row.kind]),[['undated','reusable answer'],['research','research']]);
 assert.deepEqual(pipeline.previous.map(row=>[row.item.id,row.kind]),[['past','notes']]);
});

test('retains duplicate source rows and excludes completed or cancelled prep from active buckets',()=>{
 const duplicate=artifact('same','practice',[{applicationId:'app-1'}]);
 const completed=artifact('done','mock_interview',[{applicationId:'app-1'}],{sessionStatus:'completed'});
 const cancelled=artifact('cancelled','practice',[{applicationId:'app-1'}],{sessionStatus:'cancelled'});
 const {pipelines}=buildInterviewPipelines([duplicate,duplicate,completed,cancelled],[app('app-1')],'2026-11-13');
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
