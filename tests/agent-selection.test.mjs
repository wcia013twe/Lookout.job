import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readAgentSelection,saveAgentSelection,agentOptions} from '../lib/agent-selection.mjs';
import {fromCloud} from '../lib/cloud-model.mjs';
function store(){const data={"workflow.profile":{name:"Candidate",setupAgentProvider:"claude",setupAgentName:"Claude"},"workflow.searchPreferences":{targets:[{id:"source"}]}};return {get:key=>data[key],set:(key,value)=>data[key]=value,update:(key,fn)=>data[key]=fn(data[key])};}
test('selection survives cloud hydration and both surfaces read the saved choice',()=>{
 const s=store();saveAgentSelection(s,'dot','Dots');
 const restored=fromCloud({profiles:[{facts:s.get('workflow.profile')}],preferences:[{search:structuredClone(s.get('workflow.searchPreferences'))}],resumes:[],answer_library:[],applications:[]});
 assert.deepEqual(readAgentSelection(restored.searchPreferences,restored.profile),{provider:'dot',name:'Dots'});
 assert.deepEqual(restored.searchPreferences.targets,[{id:'source'}]);
 assert.deepEqual(s.get('workflow.profile'),{name:'Candidate'});
});
test('legacy setup migrates without losing the chosen agent or candidate facts',()=>{
 const s=store(),selection=readAgentSelection(s.get('workflow.searchPreferences'),s.get('workflow.profile'));
 saveAgentSelection(s,selection.provider,selection.name);
 assert.deepEqual(readAgentSelection(s.get('workflow.searchPreferences'),s.get('workflow.profile')),selection);
 assert.equal(s.get('workflow.profile').name,'Candidate');
});
test('all selector choices and custom names use the same preference contract',()=>{
 const s=store();for(const option of agentOptions){saveAgentSelection(s,option.id,option.name);assert.equal(readAgentSelection(s.get('workflow.searchPreferences')).provider,option.id);}
 saveAgentSelection(s,'custom','My runtime');assert.equal(readAgentSelection(s.get('workflow.searchPreferences')).name,'My runtime');
 assert.throws(()=>saveAgentSelection(s,'unknown','Unknown'));
});
test('demo selection changes and reset stay inside the fictional store',async()=>{
 const {createDemoStore}=await import('../next-app/lib/demo-store.mjs');
 const fixture={workflow:{profile:{name:'Fictional Candidate'},searchPreferences:{agentSelection:{provider:'muse',name:'Muse'}}}};
 const demo=createDemoStore(fixture);
 saveAgentSelection(demo,'gemini','Gemini');assert.equal(readAgentSelection(demo.get('workflow.searchPreferences')).provider,'gemini');
 demo.reset(fixture);assert.equal(readAgentSelection(demo.get('workflow.searchPreferences')).provider,'muse');
 assert.equal(fixture.workflow.searchPreferences.agentSelection.provider,'muse');
});
