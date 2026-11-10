import test from 'node:test';
import assert from 'node:assert/strict';
import {render} from '../scripts/evals/paper-tables.mjs';
test('paper table preserves unknowns, measured zeros, releases, and separate versions',()=>{
 const row={case:'COM1',run:1,condition:'baseline',version:'v1',release:'EVAL-01',scores:{task_success:false,quality:0,active_seconds:0,reviewed:true}};
 const tex=render({rows:[row,{...row,version:'v2',release:'EVAL-02',scores:{reviewed:false}}]},'COM');
 assert.match(tex,/Fail & 0\.000 & 0\.0 & -- & -- & Yes/);
 assert.match(tex,/-- & -- & -- & -- & -- & No/);
 assert.match(tex,/EVAL-01/);assert.match(tex,/EVAL-02/);
 assert.equal((tex.match(/begin\{table\*\}/g)||[]).length,2);
 assert.doesNotMatch(render({rows:[row]},'JOB'),/COM1/);
});
