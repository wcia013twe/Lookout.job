#!/usr/bin/env node
// Synthetic plumbing only. No resume, fit labels, participant calls or quality claims.
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {read,hash} from './task.mjs';
const [manifestPath,destination]=process.argv.slice(2);if(!manifestPath||!destination)throw Error('Usage: smoke.mjs manifest.json NEW_DIRECTORY');
mkdirSync(destination,{mode:0o700});
const manifest=read(manifestPath),spec=read(new URL('../../examples/job01/scenario.json',import.meta.url));
const run={version:spec.version,episodeId:'job01-synthetic-'+Date.now(),pairId:'synthetic-transport',condition:'baseline',synthetic:true,startedAt:Date.now()/1000,snapshotId:manifest.snapshotId,sourceHash:manifest.files['jobs.json'],status:'completed',finalTargetJobIds:[],checkpoints:spec.stages.map(s=>({stage:s.id,executionSeconds:1,savedJobIds:[],interactions:{}}))};
const grade={version:spec.version,episodeId:run.episodeId,evidenceDigest:hash(run),status:'review_required',timeToTask:{executionSeconds:4},effortToTask:{scriptedInitiations:2,questions:0,repeatedContext:0,reminders:0,corrections:0,approvals:0},qualityOfCompletion:run.checkpoints.map(c=>({stage:c.stage,quality:{coverage:null,selectionPrecision:null,semantic:{}},simulatedCompletionMinute:null})),adherence:Object.fromEntries(spec.adherence.map(k=>[k,{status:'not_applicable'}]))};
for(const [n,v] of Object.entries({run,grade}))writeFileSync(path.join(destination,n+'.json'),JSON.stringify(v,null,2)+'\n',{mode:0o600});
console.log(JSON.stringify({destination,synthetic:true,participantRun:false}));
