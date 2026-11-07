import test from 'node:test';
import assert from 'node:assert/strict';
import {React,renderToStaticMarkup,bundleComponent} from './helpers/render.mjs';
const component=await bundleComponent('next-app/components/profile-automation.tsx',{plugins:[{name:'workspace-fixture',setup(build){
 build.onLoad({filter:/\/workspace\.jsx$/},()=>({contents:'export const useWorkspace=()=>globalThis.workspace;',loader:'js'}));
 build.onLoad({filter:/\/application-profile-context\.tsx$/},()=>({contents:'export const useApplicationProfile=()=>globalThis.applicationProfile;',loader:'js'}));
}}]});
function render(globalOptIn,profileOptIn=true){
 const applicationProfile={profile:{name:'Fictional profile',prompt:`## Application automation\n- Submission mode: ${profileOptIn?'Auto-apply':'Review each application'}\n- Auto-apply routine matches: ${profileOptIn?'Yes':'No'}`},busy:false,feedback:''};
 const Component=component({applicationProfile,workspace:{locked:false,state:{workflow:{searchPreferences:{autoSubmitApproved:globalOptIn},tierLists:[]}}}});
 return renderToStaticMarkup(React.createElement(Component));
}
test('blocked account explains saved preference, disables auto-apply and offers exact review',()=>{
 for(const value of [undefined,false,'true',1]){
  const html=render(value);
  assert.match(html,/Account-wide auto-apply (is off|has not been authorized|authorization is invalid)/);
  assert.match(html,/Review and approve each exact draft in Applications/);
  assert.match(html,/<input[^>]*aria-describedby="account-auto-apply-status"[^>]*disabled=""[^>]*checked=""/);
  assert.match(html,/saved profile preference; it is inactive/);
 }
});
test('authorized account leaves profile choice editable without implying submission',()=>{
 const on=render(true),off=render(true,false);
 assert.match(on,/Account-wide auto-apply is authorized/);
 assert.doesNotMatch(on,/<input[^>]*disabled=/);
 assert.match(on,/<input[^>]*checked=""/);
 assert.doesNotMatch(off,/<input[^>]*checked=/);
 assert.match(off,/Review each application before submission/);
});
