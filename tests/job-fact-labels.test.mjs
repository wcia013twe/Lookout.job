import test from 'node:test';
import assert from 'node:assert/strict';
import {compensationLabel,workSettingLabel,sponsorshipLabel} from '../next-app/lib/job-fact-labels.ts';
import {discoverPreviewRoles} from '../next-app/lib/discover-preview-demo.mjs';
test('verbose SingleStore facts become concise unknowns without inventing policy',()=>{
 assert.equal(workSettingLabel('Posting specifies San Francisco or Seattle. Remote/hybrid schedule and team-specific office attendance are not disclosed.'),'Not disclosed');
 assert.equal(sponsorshipLabel('Must be legally authorized to work in the United States. Employer sponsorship policy is not disclosed.'),'Not disclosed');
 assert.equal(sponsorshipLabel('Must be legally authorized to work in the United States.'),'Not disclosed');
 assert.equal(compensationLabel('Not disclosed by employer'),'Not disclosed');
 assert.equal(compensationLabel('$120,000–$150,000 + equity'),'$120,000–$150,000 + equity');
});
test('only explicit arrangements and sponsorship policies become quick facts',()=>{
 for(const [input,expected] of [['Remote (demo)','Remote'],['Hybrid: 3 days in office','Hybrid'],['On-site required','On-site'],['San Francisco','Not disclosed'],['Remote work may be allowed','Not disclosed'],['Remote work is not offered','Not disclosed'],['Ask whether remote work is allowed','Not disclosed']])assert.equal(workSettingLabel(input),expected,input);
 for(const [input,expected] of [['Yes','Available'],['Visa sponsorship available','Available'],['No','Not available'],['No visa sponsorship','Not available'],['Sponsorship is not offered','Not available'],['Sponsorship may be available','Not disclosed'],['Sponsorship availability depends on the team','Not disclosed'],['No sponsorship policy disclosed','Not disclosed'],['Requires sponsorship','Not disclosed']])assert.equal(sponsorshipLabel(input),expected,input);
});
test('demo covers available, unavailable and undisclosed sponsorship',()=>{
 assert.deepEqual(discoverPreviewRoles('2026-10-26').map(r=>sponsorshipLabel(r.sponsorship)),['Available','Not available','Not disclosed']);
});
