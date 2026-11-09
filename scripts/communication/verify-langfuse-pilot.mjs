#!/usr/bin/env node
// Supplemental read-only verifier; leave exporters referenced by historical freezes unchanged.
import {readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {parseArgs} from 'node:util';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
export function verifyPlan(plan,observations,scores,experiments){
 return plan.spans.every(s=>observations.some(o=>o.id===s.spanId)) &&
  plan.scores.every(s=>scores.some(o=>o.id===s.id&&o.name===s.name&&o.value===(s.dataType==='BOOLEAN'?Boolean(s.value):s.value)&&o.subject?.kind==='observation'&&o.subject?.id===plan.rootId&&o.subject?.traceId===plan.traceId&&o.environment===s.environment)) &&
  experiments.some(e=>e.id===plan.experimentId);
}
export function readScores(cli,unwrap,traceId){
 const value=unwrap(cli(['scores','list','--trace-id',traceId,'--limit','100','--fields','subject','--all','--max-items','10000']));
 const rows=Array.isArray(value)?value:value.data;
 if(!Array.isArray(rows)||rows.length>=10000)throw Error('Score response invalid or safety cap reached');
 return rows;
}
async function main(){
 const {values:v}=parseArgs({options:{case:{type:'string'},root:{type:'string'},run:{type:'string'}}});
 if(!['3','4'].includes(v.case)||!v.root||!v.run)throw Error('--case 3|4 --root <frozen root> --run <run directory> required');
 const root=path.resolve(v.root),run=path.resolve(v.run),receiptDir=path.join(root,'langfuse');
 if(path.dirname(run)!==path.join(root,'runs'))throw Error('Run must belong to frozen root');
 const receipt=path.join(run,'langfuse-final-paginated-verification.json');
 if(existsSync(receipt))throw Error('Preserve existing verification receipt');
 const {build,cli,unwrap}=await import(`../com${v.case}/langfuse.mjs`);
 const json=p=>JSON.parse(readFileSync(p,'utf8'));
 const registrations=readdirSync(receiptDir).filter(n=>n.endsWith('-dataset.json'));
 if(registrations.length!==1)throw Error('One prospective registration receipt required');
 const spec=json(path.join(root,'suite/scenario.json')),grade=json(path.join(run,'grade.final.json'));
 const plan=build(run,grade,spec,json(path.join(receiptDir,registrations[0])));
 const arr=x=>Array.isArray(x)?x:x.data||[];
 const observations=arr(unwrap(cli(['observations','list','--trace-id',plan.traceId,'--limit','1000','--fields','core,basic,metadata'])));
 if(observations.length>=1000)throw Error('Observation safety cap reached; paginate before claiming verification');
 const scores=readScores(cli,unwrap,plan.traceId);
 const experiments=arr(unwrap(cli(['experiments','list','--id',plan.experimentId,'--from-start-time',new Date(Number(BigInt(plan.spans[0].startTimeUnixNano)/1000000n)-1000).toISOString()])));
 const verified=verifyPlan(plan,observations,scores,experiments);
 if(!verified)throw Error('Final export readback incomplete; no participant retry');
 const result={verified,traceId:plan.traceId,expectedScores:plan.scores.length,readScores:scores.length,observations:observations.length,experiments:experiments.length,scorePagination:'CLI --all, cap 10000',evidenceDigest:grade.evidenceDigest};
 writeFileSync(receipt,JSON.stringify(result,null,2)+'\n',{mode:0o600,flag:'wx'});console.log(JSON.stringify(result));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.message);process.exitCode=1;});
