import test from 'node:test';
import assert from 'node:assert/strict';
import {React,renderToStaticMarkup,bundleComponent} from './helpers/render.mjs';
const Component=(await bundleComponent('next-app/components/job-description.tsx',{plugins:[{name:'css-test',setup(build){build.onLoad({filter:/\.module\.css$/},()=>({contents:'export default {};',loader:'js'}));}}]}))({URL});
const render=props=>renderToStaticMarkup(React.createElement(Component,props));
test('explicit structured paraphrases are saved summaries, not employer quotes',()=>{
 const description='Structured paraphrase from employer posting.\nResponsibilities: Build systems.\nRequirements: <script>example</script>';
 const html=render({description,url:'https://example.com/job/1'});
 assert.match(html,/Saved summary · not the original job posting/);assert.doesNotMatch(html,/<blockquote|From the job posting/);
 assert.match(html,/Structured paraphrase from employer posting\.\nResponsibilities: Build systems\./);
 assert.match(html,/&lt;script&gt;example&lt;\/script&gt;/);assert.match(html,/href="https:\/\/example.com\/job\/1"/);
});
test('source text, demo identity, missing text and safe URLs retain their behavior',()=>{
 assert.match(render({description:'Original posting text.'}),/<blockquote[^>]*>Original posting text\.<\/blockquote>/);
 assert.match(render({description:'Structured paraphrase (demo).',demo:true}),/Fictional demo description/);
 assert.match(render({}),/Full description not collected/);
 assert.doesNotMatch(render({description:'Text.',url:'javascript:alert(1)'}),/<a /);
});
