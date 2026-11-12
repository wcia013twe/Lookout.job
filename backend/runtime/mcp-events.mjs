import {createHash, createHmac, randomUUID, timingSafeEqual} from 'node:crypto';
import {lookup} from 'node:dns';
import {request} from 'node:https';
import {isIP} from 'node:net';

export const eventDefinition = {
  name: 'lookout.work_available',
  description: 'A new private Lookout change is available for this connection. Read pending work with read_muse_changes; notification receipt does not acknowledge work or authorize any action.',
  delivery: ['webhook'],
  inputSchema: {type:'object',properties:{},additionalProperties:false},
  payloadSchema: {type:'object',properties:{changeId:{type:'string',format:'uuid'},kind:{type:'string'}},required:['changeId','kind'],additionalProperties:false},
};
export class EventError extends Error {
  constructor(code, message, reason) {super(message);this.code=code;this.reason=reason;}
}
const invalid=()=>{throw new EventError(-32602,'Invalid event subscription');};
export function callbackUrl(value) {
  let url;try {url=new URL(value);} catch {invalid();}
  if(url.protocol!=='https:' || url.username || url.password || url.hash || (url.port && url.port!=='443') || value.length>2048)invalid();
  const host=url.hostname.replace(/^\[|\]$/g,'');
  if(isIP(host)&&!publicAddress(host))invalid();
  return url.href;
}
export function signingKey(secret) {
  if(typeof secret!=='string' || !/^whsec_[A-Za-z0-9+/]+={0,2}$/.test(secret))invalid();
  const key=Buffer.from(secret.slice(6),'base64');
  if(key.length<24 || key.length>64 || key.toString('base64')!==secret.slice(6))invalid();
  return key;
}
// Fail closed on IPv6. Public IPv4 callbacks remain usable; mapped and reserved
// IPv6 never slip through a different address-family representation.
export function publicAddress(ip) {
  if(isIP(ip)!==4)return false;
  const [a,b,c]=ip.split('.').map(Number);
  return !(a===0 || a===10 || a===127 || a>=224 || (a===100&&b>=64&&b<=127)
    || (a===169&&b===254) || (a===172&&b>=16&&b<=31) || (a===192&&(b===0||b===168||b===2||b===88))
    || (a===198&&(b===18||b===19||b===51)) || (a===203&&b===0&&c===113));
}
export function publicLookup(host, options, done) {
  lookup(host,{all:true},(error,addresses)=>{
    if(error)return done(error);
    const value=addresses.find(({address})=>publicAddress(address));
    if(!value)return done(Error('No supported public callback address'));
    done(null,options.all?[value]:value.address,value.family);
  });
}
export function webhookPost(url, headers, body) {
  url=new URL(callbackUrl(url));
  if(isIP(url.hostname) && !publicAddress(url.hostname))return Promise.reject(Error('Non-public callback address'));
  return new Promise((resolve,reject)=>{
    // The lookup result is the socket destination; hostname remains the TLS name.
    // No proxy, automatic redirect, or subsequent DNS resolution is used.
    const req=request(url,{method:'POST',agent:false,lookup:publicLookup,headers,
      signal:AbortSignal.timeout(10000)},res=>{
      let length=0;const chunks=[];
      res.on('data',chunk=>{length+=chunk.length;if(length>4096)res.destroy(Error('Oversized callback response'));else chunks.push(chunk);});
      res.on('error',reject);
      res.on('end',()=>resolve({status:res.statusCode,body:Buffer.concat(chunks).toString('utf8')}));
    });
    req.on('error',reject);req.end(body);
  });
}
export function signedHeaders(subscription, id, body, now=Date.now()) {
  const timestamp=String(Math.floor(now/1000));
  const keys=[subscription.secret];
  if(subscription.old_secret && Date.parse(subscription.rotate_until)>now)keys.push(subscription.old_secret);
  return {'Content-Type':'application/json','webhook-id':id,'webhook-timestamp':timestamp,
    'webhook-signature':keys.map(secret=>'v1,'+createHmac('sha256',signingKey(secret)).update(`${id}.${timestamp}.${body}`).digest('base64')).join(' '),
    'X-MCP-Subscription-Id':subscription.id};
}
export function createEvents({rpc,post=webhookPost,now=Date.now,wake=()=>{}}) {
  const db=async(action,args={})=>{
    const {data,error}=await rpc('mcp_event_dispatch',{action,args});
    if(error)throw new EventError(error.code==='42501'?-32000:-32603,'Event operation rejected');
    return data;
  };
  const handle=async(token,method,params={})=>{
    const hash=createHash('sha256').update(token).digest('hex');
    const owner=await db('authorize',{hash});
    if(method==='events/list')return {events:[eventDefinition]};
    if(!['events/subscribe','events/unsubscribe'].includes(method))throw new EventError(-32601,'Method not found');
    if(!params || params.name!==eventDefinition.name || !params.arguments || typeof params.arguments!=='object' || Array.isArray(params.arguments) || Object.keys(params.arguments).length || params.delivery?.mode!=='webhook')invalid();
    if(params.cursor!=null)invalid();
    const url=callbackUrl(params.delivery.url);
    const id='sub_'+createHash('sha256').update(JSON.stringify([owner.connectionId,url,params.name,{}])).digest('hex');
    if(method==='events/unsubscribe'){await db('remove',{hash,id});return {};}
    signingKey(params.delivery.secret);
    if(params.ttlMs!=null && (!Number.isSafeInteger(params.ttlMs)||params.ttlMs<=0))invalid();
    const expires=new Date(now()+Math.min(params.ttlMs??86400000,86400000)).toISOString();
    const existing=await db('read',{hash,id});
    const subscription={id,url,secret:params.delivery.secret};
    let verifiedUntil=existing?.verified_until;
    if(!existing || existing.secret!==subscription.secret || Date.parse(existing.verified_until)<=now()){
      const challenge=randomUUID();const body=JSON.stringify({type:'verification',challenge});
      let response;
      try {response=await post(url,signedHeaders(subscription,'verify_'+randomUUID(),body,now()),body);}
      catch {throw new EventError(-32015,'Callback verification failed','timeout');}
      let echoed;try {echoed=JSON.parse(response.body).challenge;} catch {}
      const received=Buffer.from(typeof echoed==='string'?echoed:'');const expected=Buffer.from(challenge);
      if(response.status<200||response.status>=300||received.length!==expected.length||!timingSafeEqual(received,expected))throw new EventError(-32015,'Callback verification failed','challenge_failed');
      verifiedUntil=new Date(now()+300000).toISOString();
    }
    const saved=await db('save',{hash,id,url,secret:subscription.secret,expires,verifiedUntil});
    wake();
    return {id,refreshBefore:saved.expiresAt,cursor:null,truncated:false};
  };
  const deliver=async()=>{
    // Database leases fence competing API instances. Stable activity IDs dedupe
    // retries; webhook receipt never writes muse_change_receipts.
    const jobs=await db('claim');
    for(const job of jobs){
      let status=0;
      try {
        const current=await db('delivery',{id:job.id,lease:job.lease});
        if(!current)continue;
        const event={eventId:current.event_id,name:eventDefinition.name,timestamp:current.occurred_at,data:{changeId:current.event_id,kind:current.kind},cursor:null};
        const body=JSON.stringify(event);
        status=(await post(current.url,signedHeaders(current,current.event_id,body,now()),body)).status;
      } catch {}
      await db('finish',{id:job.id,lease:job.lease,status});
    }
    return db('next');
  };
  return {handle,deliver};
}
