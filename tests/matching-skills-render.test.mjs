import test from 'node:test';
import assert from 'node:assert/strict';
import {React,renderToStaticMarkup,bundleComponent} from './helpers/render.mjs';
const Component=(await bundleComponent('next-app/components/role-matching-skills.tsx'))();
const render=whyItFits=>renderToStaticMarkup(React.createElement(Component,{whyItFits}));
test('renders compact supported skills and omits legacy or invalid lists',()=>{
 const html=render('Matching skills: Distributed systems; Backend services\nTeam: Works on systems.');
 assert.match(html,/Matching skills:/);assert.match(html,/Distributed systems · Backend services/);assert.doesNotMatch(html,/Team:/);
 assert.equal(render('A good match for Go.'),'');
 assert.equal(render('Matching skills: A; B; C; D\nTeam: X'),'');
});
