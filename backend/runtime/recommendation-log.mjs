import {createHmac,randomUUID} from 'node:crypto';
import {redact} from './trace-policy.mjs';

const operations=new Set(['knowledge.interview','knowledge.search']);
const identity=/^(?:user_?id|owner_?id|author_?id|author|alias|authorAlias)$/i;

export function recommendationExchange({token,operation,payload,reply,durationMs},key) {
  if(!operations.has(operation)||!/^jb_agent_[a-f0-9]{64}$/.test(token))return null;
  let remaining=60000,truncated=false;
  function scrub(value,depth=0) {
    if(remaining<=0||depth>10){truncated=true;return '[OMITTED]';}
    if(typeof value==='string'){
      const withoutLinks=value.replace(/https?:\/\/[^\s<>"`]+/gi,link=>{
        try{const url=new URL(link);url.username='';url.password='';url.search='';url.hash='';return url.toString();}catch{return '[URL]';}
      });
      if(withoutLinks.length>12000)truncated=true;
      const clean=redact(withoutLinks,{...process.env,LOOKOUT_RECOMMENDATION_LOG_SECRET:key});
      const bytes=Buffer.from(clean),limit=Math.max(0,remaining-2);
      if(bytes.length>limit)truncated=true;
      const result=bytes.subarray(0,limit).toString('utf8');remaining-=Buffer.byteLength(JSON.stringify(result));return result;
    }
    if(Array.isArray(value)){
      const result=[];remaining-=2;
      for(const item of value){if(result.length>=50||remaining<=0){truncated=true;break;}result.push(scrub(item,depth+1));remaining--;}
      return result;
    }
    if(value&&typeof value==='object'){
      const result={};remaining-=2;
      for(const [name,item] of Object.entries(value)){
        if(Object.keys(result).length>=80||remaining<=0){truncated=true;break;}
        if(name.length>200){truncated=true;continue;}
        if(identity.test(name)||/secret|password|authorization|cookie|credential|api.?key|token/i.test(name))continue;
        remaining-=Buffer.byteLength(JSON.stringify(name))+2;
        Object.defineProperty(result,name,{value:scrub(item,depth+1),enumerable:true});
      }
      return result;
    }
    remaining-=32;return value??null;
  }
  const success=reply.status===200;
  const request=success?scrub(payload):null;
  const response=success?scrub(reply.data):null;
  const requestId=randomUUID();
  return {severity:success?'INFO':'WARNING',insertId:requestId,timestamp:new Date().toISOString(),jsonPayload:{
    schemaVersion:1,event:'agent.recommendation_exchange',requestId,operation,
    connectionKey:'connection-'+createHmac('sha256',key).update(token).digest('hex').slice(0,32),
    status:reply.status,durationMs,request,response,truncated,
    limits:['Connection pseudonym, not an account ID.','Sanitized authorized response; not a relevance grade.'],
  }};
}

export function createRecommendationLogger(env=process.env,{request=fetch,warn=()=>console.warn('Recommendation telemetry unavailable; agent response unchanged.')}={}) {
  if(env.LOOKOUT_RECOMMENDATION_LOG_ENABLED!=='true')return null;
  const project=env.LOOKOUT_RECOMMENDATION_LOG_PROJECT,key=env.LOOKOUT_RECOMMENDATION_LOG_SECRET;
  if(!/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(project||'')||!key||key.length<32)throw Error('Recommendation logging requires a project and server-only pseudonym key of at least 32 characters');
  let cachedToken,expiresAt=0,pendingToken,inflight=0;
  async function accessToken(){
    if(cachedToken&&Date.now()<expiresAt)return cachedToken;
    if(!pendingToken)pendingToken=(async()=>{
      const response=await request('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',{headers:{'Metadata-Flavor':'Google'},redirect:'error',signal:AbortSignal.timeout(3000)});
      if(!response.ok)throw Error('Metadata token unavailable');
      const data=await response.json();
      if(typeof data.access_token!=='string'||!data.access_token||!Number.isFinite(data.expires_in)||data.expires_in<=60)throw Error('Metadata token unavailable');
      cachedToken=data.access_token;expiresAt=Date.now()+(data.expires_in-60)*1000;return cachedToken;
    })().finally(()=>{pendingToken=null;});
    return pendingToken;
  }
  return exchange=>{
    if(!operations.has(exchange.operation))return;
    if(inflight>=32){warn();return;}
    const entry=recommendationExchange(exchange,key);
    if(!entry)return;
    inflight++;
    void (async()=>{
      const token=await accessToken();
      const response=await request('https://logging.googleapis.com/v2/entries:write',{
        method:'POST',redirect:'error',signal:AbortSignal.timeout(3000),headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
        body:JSON.stringify({logName:`projects/${project}/logs/lookout-shadow`,resource:{type:'global'},entries:[entry],partialSuccess:false}),
      });
      if(!response.ok){if(response.status===401){cachedToken=null;expiresAt=0;}throw Error('Logging unavailable');}
    })().catch(()=>warn()).finally(()=>{inflight--;});
  };
}
