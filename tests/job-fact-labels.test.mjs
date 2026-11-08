import test from 'node:test';
import assert from 'node:assert/strict';
import {compensationLabel, workSettingLabel, sponsorshipLabel, jobFactText} from '../next-app/lib/job-fact-labels.ts';

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

test('hourly, annual and monthly employer pay remains in its original unit',()=>{
 for(const pay of ['$55–$65/hour','$120,000–$150,000/year base + equity','$6,000–$8,000/month'])assert.equal(compensationLabel(pay),pay);
});

test('known employer base pay is not hidden because bonus or equity is unknown',()=>{
 const pay='$120,000–$150,000/year base; bonus and equity not disclosed';
 assert.equal(compensationLabel(pay),pay);
 assert.equal(compensationLabel('Base salary: $60/hour; bonus unknown'),'Base salary: $60/hour; bonus unknown');
});

test('detailed facts preserve authorization, relocation, cadence and policy caveats',()=>{
 for(const value of [
  'Not disclosed. Requires US work authorization now and in future.',
  'Not disclosed. Attendance not stated. Relocation assistance beyond 50 miles.',
  'Hybrid. At least four office days; body also says 60%, which contradicts the policy.',
  'Remote. Core hours unknown; no relocation support.',
  'Sponsorship considered. Employer may consider current or future sponsorship.',
  'No new H-1B sponsorship. US citizenship is required.'
 ])assert.equal(jobFactText(value),value);
 assert.equal(jobFactText(''),'Not disclosed');assert.equal(jobFactText(undefined),'Not disclosed');
});
