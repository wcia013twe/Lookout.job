import test from 'node:test';
import assert from 'node:assert/strict';
import {React,renderToStaticMarkup,bundleComponent} from './helpers/render.mjs';
import {demoFixtures} from '../next-app/lib/demo.mjs';
const component=await bundleComponent('next-app/components/needs-you.tsx',{plugins:[{name:'setup-fixture',setup(build){
 build.onLoad({filter:/\/workspace\.jsx$/},()=>({contents:'export const useWorkspace=()=>globalThis.workspace;',loader:'js'}));
 build.onLoad({filter:/\/use-action-board\.ts$/},()=>({contents:'export const useActionBoard=()=>globalThis.board;',loader:'js'}));
 build.onLoad({filter:/\/(action-decision-card|tracker-work-list|action-attention|preparation-reminders|draft-review)\.tsx$/},()=>({contents:'export default function Stub(){return null}',loader:'js'}));
}}]});
function render(profile,resumes,items=[]){
 const Component=component({workspace:{state:{workflow:{profile,resumes,applications:{},actionInbox:[]}}},board:{snapshot:{items,history:[]}}});
 return renderToStaticMarkup(React.createElement(Component));
}
const saved={name:'Fictional Candidate',email:'candidate@example.com',verified:false};
const resume={id:'fictional-resume'};
test('saved profile and current resume clear setup flag and its count regardless of verification',()=>{
 for(const verified of [false,true]){
  const html=render({...saved,verified},[resume]);
  assert.doesNotMatch(html,/Set up profile/);
  assert.match(html,/No actions to show/);
  assert.match(html,/tabular-nums">0<\/span>/);
 }
});
test('missing details or only superseded resumes keep the setup action',()=>{
 for(const [profile,resumes] of [[{},[resume]],[{...saved,name:'  '},[resume]],[{...saved,email:''},[resume]],[saved,[]],[saved,[{...resume,supersededBy:'replacement'}]]]){
  const html=render(profile,resumes);
  assert.match(html,/Set up profile/);
  assert.match(html,/tabular-nums">1<\/span>/);
 }
});
test('existing detached demo covers saved unverified setup and reset returns the reminder',()=>{
 const {state}=demoFixtures('2026-11-10');
 assert.equal(state.workflow.profile.verified,false);
 assert.doesNotMatch(render(state.workflow.profile,state.workflow.resumes),/Set up profile/);
 assert.match(render({},[]),/Set up profile/);
});
