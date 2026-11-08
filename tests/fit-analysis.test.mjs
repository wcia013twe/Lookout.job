import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFitAnalysis,fitAnalysisLabels} from '../next-app/lib/fit-analysis.ts';
const why='Strong Consider: conditional on eligibility.\n- Team: Build developer tools.\n- Your contribution: Test integrations.\n- Your growth: Own a scoped prototype.';
const gap='- Support: Paired mentors; cadence unknown.\n- Practical fit: $27–$50/hour. Work setting unknown.\nPriority rises with confirmed dates.';
test('five saved labels become five plain-text sections, with intro and caveats preserved',()=>{
 const parsed=parseFitAnalysis(why,gap);assert.deepEqual(parsed.bullets.map(b=>b.label),fitAnalysisLabels);assert.equal(parsed.intro,'Strong Consider: conditional on eligibility.');assert.match(parsed.bullets[4].text,/Priority rises with confirmed dates/);
 assert.deepEqual(parseFitAnalysis(why.replaceAll('\n- ',' '),gap.replaceAll('\n- ',' ')),parsed);
});
test('partial, duplicate and reordered labels stay legacy prose instead of inventing bullets',()=>{
 assert.equal(parseFitAnalysis('Ordinary legacy narrative.','A material gap.'),null);
 assert.equal(parseFitAnalysis(why,'Support: Mentors.'),null);
 assert.equal(parseFitAnalysis(why,gap+' Team: Duplicate.'),null);
 assert.equal(parseFitAnalysis(why.replace('Your contribution: Test integrations.','Your growth: Test integrations.'),gap),null);
 assert.equal(parseFitAnalysis(why,'Support: Practical fit: something'),null);
});
test('analysis content remains literal text, including markup-like employer content',()=>{
 const input=why.replace('Build developer tools.','<script>alert(1)</script> & **not markup**');
 assert.match(parseFitAnalysis(input,gap).bullets[0].text,/<script>alert/);
});
