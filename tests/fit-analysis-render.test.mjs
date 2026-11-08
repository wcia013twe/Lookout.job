import test from 'node:test';
import assert from 'node:assert/strict';
import {React,renderToStaticMarkup,bundleComponent} from './helpers/render.mjs';
const Analysis=(await bundleComponent('next-app/components/role-fit-analysis.tsx'))();
const render=props=>renderToStaticMarkup(React.createElement(Analysis,props));
test('actual analysis component emits five semantic bullets and escapes markup',()=>{
 const html=render({whyItFits:'Strong Consider.\n- Team: <script>do not run</script>\n- Your contribution: Build tests.\n- Your growth: Own a scoped change.',materialGap:'- Support: Mentors available.\n- Practical fit: $27–$50/hour; attendance unknown.'});
 assert.equal((html.match(/<li\b/g)||[]).length,5);assert.match(html,/<ul aria-label="Role fit analysis"/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);assert.equal((html.match(/Strong Consider/g)||[]).length,1);
});
test('legacy analysis remains complete with line breaks and no fabricated categories',()=>{
 const html=render({whyItFits:'First paragraph.\nSecond paragraph.',materialGap:'Unknown team.'});assert.doesNotMatch(html,/<li\b/);assert.match(html,/First paragraph\.\nSecond paragraph\./);assert.match(html,/whitespace-pre-line/);assert.match(html,/Unknown team/);
});

for (const [name,gap] of [
 ['active-clearance role','- Support: Mentor and support details are unknown.\n- Practical fit: Active Secret clearance and US citizenship required at application/start. July start and salary pay period are unknown.\nPriority depends on confirming eligibility.'],
 ['obtain-clearance role','- Support: Mentorship is unknown.\n- Practical fit: US citizenship, ability to obtain clearance and SAP access required. Converting eligibility, work arrangement, July start and salary pay period are unknown.\nPriority depends on confirming eligibility.'],
]) test(`bounded cautions retain the complete ${name} gap and all five labels`,()=>{
 const why='Conditional fit.\n- Team: Engineering systems.\n- Your contribution: Build reliable tooling.\n- Your growth: Develop systems judgment.';
 const html=render({whyItFits:why,materialGap:gap});
 const section=html.match(/<section aria-label="What to watch out for"[^>]*>([\s\S]*?)<\/section>/)?.[0];
 assert.ok(section);assert.match(section,/rounded-xl/);assert.match(section,/bg-\[var\(--role-preview-caution\)\]/);
 assert.match(html,/<section aria-label="Why it’s here"[^>]*rounded-xl/);
 assert.equal((html.match(/<li\b/g)||[]).length,5);
 for(const label of ['Team','Your contribution','Your growth','Support','Practical fit']) assert.equal(html.split(`<strong>${label}:</strong>`).length-1,1);
 for(const content of gap.split(/\n- (?:Support|Practical fit): |^- Support: /).filter(Boolean)) assert.ok(section.includes(content),content);
 assert.equal((section.match(/<li\b/g)||[]).length,2);
});
test('legacy gaps retain their boundary and empty gaps do not invent cautions',()=>{
 const html=render({whyItFits:'Legacy evidence.',materialGap:'First caveat.\nSecond caveat.'});
 assert.match(html,/<section aria-label="What to watch out for"[^>]*rounded-xl/);
 assert.match(html,/First caveat.\nSecond caveat./);
 assert.doesNotMatch(render({whyItFits:'Legacy evidence.'}),/What to watch out for/);
});
