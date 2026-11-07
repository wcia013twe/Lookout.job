import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchesProfileEmployment} from '../next-app/lib/discover-view.mjs';

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
