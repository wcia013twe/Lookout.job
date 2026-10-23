import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchesProfileEmployment} from '../next-app/lib/discover-view.mjs';
import {demoFixtures} from '../next-app/lib/demo.mjs';
const profile=value=>({prompt:`## Search Filters\n- Employment: ${value}\n`});
test('Discover follows explicit profile employment preferences',()=>{
 assert.equal(matchesProfileEmployment({employmentType:'FT'},profile('Full-time')),true);
 assert.equal(matchesProfileEmployment({employmentType:'Internship'},profile('Full-time')),false);
 assert.equal(matchesProfileEmployment({employmentType:'FT'},profile('Internship')),false);
 assert.equal(matchesProfileEmployment({employmentType:'Internship'},profile('Internship')),true);
 for(const type of ['FT','Internship'])assert.equal(matchesProfileEmployment({employmentType:type},profile('Full-time, Internship')),true);
 assert.equal(matchesProfileEmployment({employmentType:'FT'},profile('Contract')),false);
 assert.equal(matchesProfileEmployment({employmentType:'FT'},{name:'Internships',filters:{}}),true);
});
test('demo profiles produce separate boards without modifying roles or tracking',()=>{
 const fixture=demoFixtures('2026-10-13');
 const before=JSON.stringify(fixture);
 const profiles=fixture.state.workflow.searchPreferences.profiles;
 for(const p of profiles){
  const roles=fixture.roles.filter(role=>matchesProfileEmployment(role,p));
  assert.ok(roles.length);
  assert.ok(roles.every(role=>role.employmentType===(p.id==='internships'?'Internship':'FT')));
 }
 assert.equal(JSON.stringify(fixture),before);
});
