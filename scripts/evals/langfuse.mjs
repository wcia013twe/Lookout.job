#!/usr/bin/env node
import {readFileSync,writeFileSync,mkdirSync,existsSync,openSync,closeSync,unlinkSync,renameSync} from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {scoreConfigs,widgets,dashboard,VERSION} from './config.mjs';
import {build,hash} from './contract.mjs';
import {call,rows,unwrap} from './client.mjs';
import {tracingConfig} from '../../backend/runtime/trace-policy.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const save=(p,data)=>{writeFileSync(p+'.tmp',JSON.stringify(data,null,2)+'\n',{mode:0o600});renameSync(p+'.tmp',p);};
const contains=(obj,id)=>!!obj&&typeof obj==='object'&&(obj.id===id||Object.values(obj).some(v=>contains(v,id)));
const configs=()=>rows(call(['score-configs','list','--all']));
async function main() {
  const {values:v}=parseArgs({options:{setup:{type:'boolean'},record:{type:'string'},verify:{type:'boolean'},'dry-run':{type:'boolean'},'receipt-dir':{type:'string'},help:{type:'boolean'}}});
  if(v.help||!v.setup&&!v.record){console.log('Usage: npm run evals:langfuse -- --setup | --record <result.json> [--dry-run|--verify] [--receipt-dir <directory>]');return;}
  if(v.setup&&v.record)throw Error('Choose setup or a result record');
  const record=v.record?read(v.record):null;
  const preview=record?build(record):null; // Validate before network or mutation.
  if(v['dry-run']) {console.log(JSON.stringify(v.setup?{version:VERSION,dashboard,scoreConfigs,widgets}:{version:VERSION,experimentId:preview.experimentId,traceId:preview.traceId,environment:preview.environment,scores:preview.scores.map(({name,value})=>({name,value}))},null,2));return;}
  const config=tracingConfig();if(!config)throw Error('Langfuse credentials/base URL missing');
  const project=hash([config.baseUrl,config.publicKey]);
  const dir=path.resolve(v['receipt-dir']||'.langfuse-exports/evals');mkdirSync(dir,{recursive:true,mode:0o700});
  const setupPath=path.join(dir,project+'-setup-v1.json');
  if(v.setup) {
    const lock=setupPath+'.lock';closeSync(openSync(lock,'wx',0o600));
    try {
      const existing=configs(),ids={};
      for(const spec of scoreConfigs) {
        const matches=existing.filter(x=>x.name===spec.name&&!x.isArchived);
        if(matches.length>1)throw Error('Multiple score configs named '+spec.name);
        let found=matches[0];
        if(found)for(const key of ['dataType','minValue','maxValue','categories'])if(spec[key]!==undefined&&JSON.stringify(found[key])!==JSON.stringify(spec[key]))throw Error('Existing score config differs: '+spec.name);
        found ||= unwrap(call(['score-configs','create'],spec));
        if(!found.id)throw Error('Score config ID missing');ids[spec.name]=found.id;
      }
      const dashboards=rows(call(['unstable-dashboards','list','--all'])).filter(x=>x.name===dashboard.name);
      if(dashboards.length>1)throw Error('Multiple dashboards named '+dashboard.name);
      const saved=dashboards[0]||unwrap(call(['unstable-dashboards','create'],dashboard));
      if(!saved.id)throw Error('Dashboard ID missing');
      const current=unwrap(call(['unstable-dashboards','get',saved.id]));
      const known=rows(call(['unstable-dashboard-widgets','list','--all']));
      const widgetIds=[];
      for(const [i,spec] of widgets.entries()) {
        const matches=known.filter(x=>x.name===spec.name);
        if(matches.length>1)throw Error('Multiple widgets named '+spec.name);
        const widget=matches[0]||unwrap(call(['unstable-dashboard-widgets','create'],spec));
        if(!widget.id)throw Error('Widget ID missing');widgetIds.push(widget.id);
        const id=hash([VERSION,saved.id,spec.name]).slice(0,24);
        if(!contains(current,id))call(['unstable-dashboards','add-placement',saved.id],{id,type:'widget',widgetId:widget.id,x:(i%2)*6,y:Math.floor(i/2)*5,width:6,height:5});
      }
      const remote=unwrap(call(['unstable-dashboards','get',saved.id]));
      for(const spec of widgets)if(!contains(remote,hash([VERSION,saved.id,spec.name]).slice(0,24)))throw Error('Dashboard placement read-back incomplete');
      const projects=rows(call(['projects','list']));
      const result={version:VERSION,dashboardId:saved.id,widgetIds,scoreConfigIds:ids,projectId:projects.length===1?projects[0].id:null,status:'configured',verifiedPlacements:true};
      save(setupPath,result);console.log(JSON.stringify(result,null,2));
    } finally {unlinkSync(lock);}
    return;
  }
  const existing=configs(),ids={};
  for(const spec of scoreConfigs){const found=existing.filter(x=>x.name===spec.name&&!x.isArchived);if(found.length!==1)throw Error('Run --setup first; score configuration missing/ambiguous');ids[spec.name]=found[0].id;}
  const plan=build(record,ids);
  const receipt=path.join(dir,project+'-'+plan.traceId+'.json');
  // Prevent duplicate scenario attempts within an experiment and silent regrading.
  const assignment=path.join(dir,project+'-'+hash([plan.experimentId,plan.itemId])+'-item.json');
  const binding={traceId:plan.traceId,recordDigest:hash(record)};
  if(existsSync(assignment)&&JSON.stringify(read(assignment))!==JSON.stringify(binding))throw Error('Experiment item already bound to different evidence/results. Use a new repetition or grader version.');
  if(v.verify) {
    const obs=rows(call(['observations','list','--trace-id',plan.traceId,'--fields','core,basic','--all']));
    const scores=rows(call(['scores','list','--trace-id',plan.traceId,'--fields','subject','--all']));
    const experiments=rows(call(['experiments','list','--id',plan.experimentId,'--from-start-time',new Date(record.startedAt*1000-1000).toISOString()]));
    const verified=obs.some(x=>x.id===plan.rootId)&&experiments.some(x=>x.id===plan.experimentId)&&plan.scores.every(s=>scores.some(x=>x.id===s.id&&x.name===s.name&&x.value===s.value&&x.subject?.id===plan.rootId&&x.subject?.traceId===plan.traceId));
    save(receipt+'.verification.json',{verified,traceId:plan.traceId,experimentId:plan.experimentId});
    if(!verified)throw Error('Read-back incomplete; retry verification later, never rerun participant');
    console.log(JSON.stringify({verified,traceId:plan.traceId,experimentId:plan.experimentId}));return;
  }
  const lock=assignment+'.lock';closeSync(openSync(lock,'wx',0o600));
  try {
    if(existsSync(assignment)&&JSON.stringify(read(assignment))!==JSON.stringify(binding))throw Error('Experiment item binding changed');
    save(assignment,binding);
    if(existsSync(receipt)){console.log(JSON.stringify({...read(receipt),status:'already-accepted'}));return;}
    call(['otel','export-traces'],{resourceSpans:[{resource:{attributes:[{key:'service.name',value:{stringValue:'lookout-evals'}}]},scopeSpans:[{scope:{name:'lookout-evals',version:VERSION},spans:[plan.span]}]}]});
    call(['scores','create'],plan.scores);
    const result={status:'accepted-not-verified',traceId:plan.traceId,experimentId:plan.experimentId,scoreCount:plan.scores.length};save(receipt,result);console.log(JSON.stringify(result));
  } finally {unlinkSync(lock);}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
