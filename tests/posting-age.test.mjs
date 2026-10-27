import test from 'node:test';
import assert from 'node:assert/strict';
import {matchesPostingAge,formatPostedDate,postingStatus} from '../lib/posting-age.mjs';
import {discoverPreviewRoles} from '../next-app/lib/discover-preview-demo.mjs';
const now=Date.parse('2026-10-27T12:00:00Z');
test('publication filters use posted time rather than a fresh availability check',()=>{
 const role={postedDate:'2026-10-01',postingObservation:{postedAt:'2026-09-15T12:00:00Z',checkedAt:'2026-10-27T12:00:00Z',liveness:'active'}};
 assert.equal(postingStatus(role),'Live');
 for(const range of ['1','3','7','14','30'])assert.equal(matchesPostingAge(role,range,now),false);
 assert.equal(matchesPostingAge(role,'any',now),true);
 assert.match(formatPostedDate(role,now),/Sep 15, 2026 · 6 weeks ago/);
});
test('filter cutoffs include the boundary and exclude future or unknown dates',()=>{
 for(const days of [1,3,7,14,30]){
  const boundary=now-days*86400000;
  assert.equal(matchesPostingAge({postedDate:new Date(boundary).toISOString()},String(days),now),true);
  assert.equal(matchesPostingAge({postedDate:new Date(boundary-1).toISOString()},String(days),now),false);
 }
 for(const date of [null,'invalid',new Date(now+1).toISOString()])assert.equal(matchesPostingAge({postedDate:date},'1',now),false);
 const unknown={postedDate:'2026-10-27',postingObservation:{postedAt:null}};
 assert.equal(matchesPostingAge(unknown,'unknown',now),true);
 assert.equal(formatPostedDate(unknown,now),'Not disclosed');
 assert.equal(postingStatus(unknown),'Unverified');
});
test('fictional demo covers recent, older, unknown publication and all availability states',()=>{
 const roles=discoverPreviewRoles('2026-10-27');
 assert.deepEqual(roles.map(postingStatus),['Live','Closed','Unverified']);
 assert.deepEqual(roles.map(r=>matchesPostingAge(r,'1',now)),[true,false,false]);
 assert.deepEqual(roles.map(r=>matchesPostingAge(r,'14',now)),[true,true,false]);
 assert.deepEqual(roles.map(r=>matchesPostingAge(r,'unknown',now)),[false,false,true]);
});
