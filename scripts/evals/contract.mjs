import {exportProvenance} from './provenance.mjs';
import {costValues,costProvenance} from '../n01/cost-export.mjs';
import {createHash} from 'node:crypto';
import {statuses, VERSION} from './config.mjs';
export const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const slug=(v,key)=>{if(typeof v!=='string'||!v||v.length>100||!/^[A-Za-z0-9_.:-]+$/.test(v))throw Error('Invalid '+key+'; use a short identifier');return v;};
export function validate(r) {
  if(r.schemaVersion!==1)throw Error('Unsupported eval schemaVersion');
  for(const key of ['campaignId','suiteId','suiteVersion','scenarioId','scenarioVersion','condition','episodeId','model','reasoning','harnessVersion','graderVersion'])slug(r[key],key);
  if(!Number.isSafeInteger(r.repeat)||r.repeat<1)throw Error('repeat must be a positive integer');
  if(!/^[a-f0-9]{64}$/.test(r.evidenceDigest||''))throw Error('evidenceDigest must be SHA-256 of local evidence bound by the grader');
  if(!statuses.includes(r.status))throw Error('Terminal execution status required');
  if(typeof r.pilot!=='boolean'||typeof r.synthetic!=='boolean')throw Error('Explicit pilot and synthetic flags required');
  if(!Number.isFinite(r.startedAt)||r.startedAt<=0||!Number.isFinite(r.endedAt)||r.endedAt<r.startedAt)throw Error('Actual epoch-second start/end timestamps required');
  const e=r.evaluation;
  if(!e||typeof e.reviewed!=='boolean')throw Error('Explicit evaluation.reviewed required');
  if(e.taskSuccess!==null&&typeof e.taskSuccess!=='boolean')throw Error('taskSuccess must be boolean or null');
  if(e.quality!==null&&(!Number.isFinite(e.quality)||e.quality<0||e.quality>1))throw Error('quality must be 0–1 or null');
  if(!e.reviewed&&(e.taskSuccess!==null||e.quality!==null))throw Error('Unreviewed quality judgments must be null');
  if(e.taskSuccess===true&&r.status!=='completed')throw Error('Incomplete execution cannot be a full task success');
  for(const key of ['activeSeconds','toolCalls','wakesUsed'])if(e[key]!==null&&(!Number.isFinite(e[key])||e[key]<0||key!=='activeSeconds'&&!Number.isSafeInteger(e[key])))throw Error(key+' must be nonnegative or null');
  exportProvenance(r.provenance);
  costValues(r.cost);
  return r;
}
const attr=(key,v)=>({key,value:{stringValue:typeof v==='string'?v:JSON.stringify(v)}});
const ns=n=>(BigInt(Math.round(n*1e6))*1000n).toString();
export function build(r,configIds={}) {
  validate(r);
  const environment=r.synthetic?'verification':r.pilot?'benchmark-pilot':'benchmark';
  // One local dataset item per full scenario; one repetition per experiment.
  const datasetId=hash([VERSION,r.suiteId,r.suiteVersion]);
  const itemId=hash([datasetId,r.scenarioId,r.scenarioVersion]);
  const experimentId=hash([VERSION,datasetId,r.campaignId,r.condition,r.repeat,r.model,r.reasoning,r.harnessVersion,r.graderVersion,environment]);
  const traceId=hash([VERSION,experimentId,itemId,r.episodeId,r.evidenceDigest]).slice(0,32);
  const rootId=hash([traceId,'root']).slice(0,16);
  const experimentName=[r.campaignId,r.condition,'r'+r.repeat,r.harnessVersion,r.graderVersion].join('-');
  const metadata=Object.fromEntries(['campaignId','suiteId','suiteVersion','scenarioId','scenarioVersion','condition','episodeId','model','reasoning','harnessVersion','graderVersion','evidenceDigest'].map(k=>[k,r[k]]));
  metadata.repeat=String(r.repeat);
  const experimentMetadata=Object.fromEntries(['campaignId','suiteId','suiteVersion','condition','model','reasoning','harnessVersion','graderVersion'].map(k=>[k,r[k]]));
  const provenance=exportProvenance(r.provenance);
  const span={traceId,spanId:rootId,name:'evaluate-'+r.condition,kind:1,
    startTimeUnixNano:ns(r.startedAt),endTimeUnixNano:ns(r.endedAt),
    attributes:Object.entries({
      ...(Object.keys(provenance).length?{'langfuse.observation.metadata.provenance':provenance,'langfuse.experiment.metadata.provenance':provenance}:{}),
      ...(r.cost?{'langfuse.observation.metadata.cost':costProvenance(r.cost)}:{}),
      'langfuse.observation.type':'span','langfuse.trace.name':[r.condition,r.campaignId,r.scenarioVersion,r.graderVersion].join(' · '),
      'langfuse.trace.tags':['eval-case:'+r.scenarioId,'eval-run:'+r.repeat],
      'langfuse.environment':environment,'langfuse.release':r.campaignId,
      'langfuse.version':[r.scenarioId,r.scenarioVersion,r.graderVersion].join(':'),
      'session.id':r.episodeId,
      'langfuse.experiment.metadata.repeat':String(r.repeat),'langfuse.experiment.metadata.pilot':String(r.pilot),'langfuse.experiment.metadata.synthetic':String(r.synthetic),
      'langfuse.experiment.id':experimentId,'langfuse.experiment.name':experimentName,
      'langfuse.experiment.dataset.id':datasetId,'langfuse.experiment.item.id':itemId,
      'langfuse.experiment.item.root_observation_id':rootId,
      ...Object.fromEntries(Object.entries(experimentMetadata).map(([k,v])=>['langfuse.experiment.metadata.'+k,v])),
      ...Object.fromEntries(Object.entries(metadata).map(([k,v])=>['langfuse.trace.metadata.'+k,v])),
      'langfuse.observation.input':{scenarioId:r.scenarioId,scenarioVersion:r.scenarioVersion,evidenceDigest:r.evidenceDigest},
      'langfuse.observation.output':{status:r.status,reviewed:r.evaluation.reviewed,taskSuccess:r.evaluation.taskSuccess,quality:r.evaluation.quality},
      'langfuse.observation.metadata.detail':'Evaluation summary only; participant transcript remains in separate local/session traces.',
      ...(r.status!=='completed'?{'langfuse.observation.level':'ERROR'}:{}),
    }).map(([k,v])=>attr(k,v))};
  const scores=[];
  const add=(suffix,value,dataType='NUMERIC')=>{if(value===null)return;const name='eval_v1_'+suffix;scores.push({id:hash([traceId,name]),traceId,observationId:rootId,name,value:dataType==='BOOLEAN'?Number(value):value,dataType,environment,...(configIds[name]?{configId:configIds[name]}:{}),timestamp:new Date(r.endedAt*1000).toISOString(),comment:'Grader '+r.graderVersion+'; evidence '+r.evidenceDigest});};
  add('execution_status',r.status,'CATEGORICAL');add('reviewed',r.evaluation.reviewed,'BOOLEAN');
  add('task_success',r.evaluation.taskSuccess,'BOOLEAN');add('quality',r.evaluation.quality);
  add('active_seconds',r.evaluation.activeSeconds);add('tool_calls',r.evaluation.toolCalls);add('wakes_used',r.evaluation.wakesUsed);
  for(const [name,value,type] of costValues(r.cost))add(name,value,type);
  return {experimentId,experimentName,datasetId,itemId,traceId,rootId,environment,span,scores};
}
