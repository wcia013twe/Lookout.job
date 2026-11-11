import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import vm from 'node:vm';
const result=await build({entryPoints:['next-app/lib/fit-analysis.ts'],bundle:true,write:false,format:'cjs',platform:'node'});
const module={exports:{}};vm.runInNewContext(result.outputFiles[0].text,{module,exports:module.exports});
const read=module.exports.readMatchingSkills;
test('reads only one to three explicitly saved short skills',()=>{
 for(const skills of ['Distributed systems','Go; SQL','Go; SQL; Python']) assert.deepEqual(Array.from(read(`Matching skills: ${skills}\nTeam: A role.`).skills),skills.split(';').map(x=>x.trim()));
});
test('does not convert legacy reasoning, requirements, malformed or oversized lists into matches',()=>{
 for(const why of ['Your experience with Go is relevant.','Matching skills: Go; SQL; Rust; Python\nTeam: X','Matching skills: Go; go\nTeam: X','Matching skills: Kubernetes is required but not established!\nTeam: X','Matching skills: Go']) {assert.equal(read(why).skills.length,0);assert.equal(read(why).narrative,why);}
});
