import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('production deployment refuses feature refs before accessing Supabase',()=>{
 const result=spawnSync(process.execPath,['scripts/deploy-supabase.mjs'],{encoding:'utf8',env:{...process.env,GITHUB_REF:'refs/heads/codex/test',PATH:''}});
 assert.notEqual(result.status,0);
 assert.match(result.stderr,/requires the main-branch GitHub workflow/);
 assert.doesNotMatch(result.stdout,/Deploying reviewed source/);
});
