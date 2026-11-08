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
