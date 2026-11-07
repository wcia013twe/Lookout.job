import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(new URL('../next-app/package.json',import.meta.url));
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const bundle=await build({entryPoints:['next-app/components/profile-automation.tsx'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',jsx:'automatic',logLevel:'silent',plugins:[{name:'workspace-fixture',setup(build){
 build.onLoad({filter:/\/workspace\.jsx$/},()=>({contents:'export const useWorkspace=()=>globalThis.workspace;',loader:'js'}));
 build.onLoad({filter:/\/application-profile-context\.tsx$/},()=>({contents:'export const useApplicationProfile=()=>globalThis.applicationProfile;',loader:'js'}));
}}]});
function render(globalOptIn,profileOptIn=true){
 const module={exports:{}};
 const applicationProfile={profile:{name:'Fictional profile',prompt:`## Application automation\n- Submission mode: ${profileOptIn?'Auto-apply':'Review each application'}\n- Auto-apply routine matches: ${profileOptIn?'Yes':'No'}`},busy:false,feedback:''};
 vm.runInNewContext(bundle.outputFiles[0].text,{module,exports:module.exports,require,console,process,applicationProfile,workspace:{locked:false,state:{workflow:{searchPreferences:{autoSubmitApproved:globalOptIn},tierLists:[]}}}});
 return renderToStaticMarkup(React.createElement(module.exports.default));
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
