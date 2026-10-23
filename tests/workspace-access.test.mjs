import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canViewWorkspace,isPublicReferencePage} from '../next-app/lib/workspace-access.ts';

test('workspace visibility waits for a resolved non-anonymous account and closes on sign-out',()=>{
 const one={id:'one'},two={id:'two'};
 const transition=[
  {authReady:false,user:null},
  {authReady:false,user:one},
  {authReady:true,user:one},
  {authReady:true,user:null},
  {authReady:false,user:two},
  {authReady:true,user:two},
  {authReady:true,user:{id:'anonymous',is_anonymous:true}},
 ];
 assert.deepEqual(transition.map(canViewWorkspace),[false,false,true,false,false,true,false]);
 assert.equal(canViewWorkspace({authReady:true,user:{}}),false);
});
test('explicit demo mode can render fictional data without granting account access',()=>{
 assert.equal(canViewWorkspace({authReady:false,user:null,demo:true}),true);
 assert.equal(canViewWorkspace({authReady:false,user:null,demo:false}),false);
});
test('only privacy and individual reference guides are public outside onboarding',()=>{
 for(const path of ['/privacy','/privacy/','/career-toolkit/resume-parse/'])assert.equal(isPublicReferencePage(path),true,path);
 for(const path of ['/','/discover/','/applications/','/needs-you/','/profile/','/referrals/','/circles/','/progress/','/career-toolkit/','/workspace-reset/'])assert.equal(isPublicReferencePage(path),false,path);
});
