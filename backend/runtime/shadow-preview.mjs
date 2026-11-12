import {createHash} from 'node:crypto';
import {redact} from './trace-policy.mjs';

const boundedText=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.length<=max;
const finiteMetric=value=>value===null||value===undefined?null:Number.isFinite(value)&&value>=0?value:null;
const previewText=value=>redact(value.replace(/https?:\/\/[^\s<>"`]+/gi,link=>{
  try {const url=new URL(link);url.username='';url.password='';url.search='';url.hash='';return url.toString();}catch{return '[URL]';}
}));

export function shadowPreviewEntry({subjectKey,runId,trigger,mode,recommendation,citations=[],author=null,retrievalMs=null,model=null,tokenUsage=null,cost=null}) {
  if(!boundedText(subjectKey,100)||!/^subject-[a-f0-9]{16,64}$/.test(subjectKey))throw Error('Use a pseudonymous subject key: subject- followed by 16–64 hex characters');
  if(!boundedText(runId,100)||!['onboarding','interview','manual'].includes(trigger)||!['fictional','live'].includes(mode))throw Error('Invalid shadow preview identity');
  if(!boundedText(recommendation,12000)||!Array.isArray(citations)||citations.length>10)throw Error('Bounded recommendation and citations required');
  const sources=citations.map(source=>{
    if(!boundedText(source.sourceId,200)||!Number.isSafeInteger(source.revision)||source.revision<1)throw Error('Source ID and published revision required');
    return {sourceId:previewText(source.sourceId),revision:source.revision};
  });
  const payload={schemaVersion:1,event:'recommendation.shadow_preview',subjectKey,runId:previewText(runId),trigger,mode,
    delivery:{enabled:false,attempted:false},recommendation:previewText(recommendation),citations:sources,author:boundedText(author,200)?previewText(author):null,
    measurement:{retrievalMs:finiteMetric(retrievalMs),model:boundedText(model,100)?previewText(model):null,
      tokenUsage:tokenUsage&&Number.isSafeInteger(tokenUsage.input)&&tokenUsage.input>=0&&Number.isSafeInteger(tokenUsage.output)&&tokenUsage.output>=0?{input:tokenUsage.input,output:tokenUsage.output}:null,cost:finiteMetric(cost)},
    limits:['Operator/agent-authored preview, not independently graded.','Delivery flags describe this preview path only.']};
  return {severity:'INFO',insertId:createHash('sha256').update(JSON.stringify(payload)).digest('hex'),jsonPayload:payload};
}

export async function writeShadowPreview(projectId,preview,accessToken,{request=fetch}={}) {
  if(!/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(projectId))throw Error('Google Cloud project ID required');
  if(!boundedText(accessToken,8192))throw Error('Server-side Google access token required');
  const entry=shadowPreviewEntry(preview);
  const response=await request('https://logging.googleapis.com/v2/entries:write',{
    method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),
    headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},
    body:JSON.stringify({logName:`projects/${projectId}/logs/lookout-shadow`,resource:{type:'global'},entries:[entry],partialSuccess:false}),
  });
  if(!response.ok)throw Error(`Shadow logging failed (HTTP ${response.status}); no delivery attempted`);
  return {insertId:entry.insertId,delivery:{enabled:false,attempted:false}};
}
