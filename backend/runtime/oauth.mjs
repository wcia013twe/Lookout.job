import {Provider,errors} from 'oidc-provider';
import {createHash,randomBytes} from 'node:crypto';
import {readFile,stat} from 'node:fs/promises';
export const opaqueAgentToken=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value);
const hash=value=>createHash('sha256').update(value).digest('hex');
const secret=()=>randomBytes(32).toString('base64url');
const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','Referrer-Policy':'no-referrer'});res.end(JSON.stringify(value));};
export function oauthStore(rpc){return async(action,args={})=>{const {data,error}=await rpc('mcp_oauth_store',{action,args});if(error){if(error.code==='28000')throw new errors.InvalidGrant('OAuth authority expired or revoked');throw Error('OAuth storage rejected');}return data;};}
export function durableAdapter(store){return class Adapter{
 constructor(model){this.model=model;}
 async upsert(id,payload,ttl){const {jti,...data}=payload;if(this.model==='Session')data._sessionId=id;await store('upsert',{model:this.model,hash:hash(id),payload:data,ttl:Math.min(ttl,2592000),grant:this.model==='Grant'?id:payload.grantId});}
 async find(id){if(this.model==='Client')return undefined;try{const value=await store('find',{model:this.model,hash:hash(id)});if(!value)return undefined;const {_sessionId,...payload}=value;return {...payload,jti:id};}catch(error){if(error instanceof errors.InvalidGrant)return undefined;throw error;}}
 async findByUid(uid){const value=await store('uid',{model:this.model,hash:hash(uid),uid});if(!value)return undefined;const {_sessionId,...payload}=value;return {...payload,jti:_sessionId};}
 async findByUserCode(){return undefined;}
 async destroy(id){if(this.model==='Grant')await this.revokeByGrantId(id);else if(['AccessToken','RefreshToken'].includes(this.model)){const item=await this.find(id);if(item?.grantId)await this.revokeByGrantId(item.grantId);}else await store('destroy',{model:this.model,hash:hash(id)});}
 async consume(id){const result=await store('consume',{model:this.model,hash:hash(id)});if(!result||result.replayed){if(result?.grant)await this.revokeByGrantId(result.grant);throw new errors.InvalidGrant('Already consumed');}}
 async revokeByGrantId(grant){await store('revoke',{grant});}
};}
export async function loadOAuthConfig(env=process.env){
 if(env.LOOKOUT_OAUTH_ENABLED!=='true')return null;
 if(!env.LOOKOUT_OAUTH_CONFIG_FILE)throw Error('OAuth configuration file is required');
 if((await stat(env.LOOKOUT_OAUTH_CONFIG_FILE)).mode&0o077)throw Error('OAuth config file must be private (0600)');
 const config=JSON.parse(await readFile(env.LOOKOUT_OAUTH_CONFIG_FILE,'utf8'));
 validateOAuthConfig(config);return config;
}
export function validateOAuthConfig(config,{test=false}={}){
 for(const field of ['issuer','resource','consentUrl','redirectUri']){
 const url=new URL(config[field]);if((url.protocol!=='https:'&&!(test&&url.hostname==='127.0.0.1'&&url.protocol==='http:'))||url.username||url.password||url.hash||url.search)throw Error('Invalid OAuth URL');
 }
 const issuer=new URL(config.issuer);if(issuer.pathname!=='/oauth'||config.resource!==issuer.origin+'/mcp')throw Error('OAuth issuer/resource must use the MCP origin');
 if(typeof config.clientId!=='string'||!config.clientId||!config.jwks?.keys?.length||!config.jwks.keys.every(k=>k.d&&k.kid&&k.use==='sig'&&k.kty==='EC'&&k.crv==='P-256'))throw Error('Explicit client and private signing keys required');
 if(!Array.isArray(config.cookieKeys)||config.cookieKeys.length<1||config.cookieKeys.some(k=>typeof k!=='string'||Buffer.from(k,'base64').length<32))throw Error('Persistent cookie keys required');
 return config;
}
export async function createOAuth({config,rpc,authenticateHuman,test=false}){
 validateOAuthConfig(config,{test});const store=oauthStore(rpc);const policy=await store('readiness');
 if(!policy?.enabled||policy.resource!==config.resource||policy.client_id!==config.clientId)throw Error('OAuth database policy is not ready');
 await store('prune');
 const Adapter=durableAdapter(store),issuer=new URL(config.issuer),webOrigin=new URL(config.consentUrl).origin;
 const provider=new Provider(config.issuer,{
 adapter:Adapter,jwks:config.jwks,cookies:{keys:config.cookieKeys,long:{sameSite:'lax'},short:{sameSite:'lax'}},
 clients:[{client_id:config.clientId,client_name:'ChatGPT',redirect_uris:[config.redirectUri],response_types:['code'],grant_types:['authorization_code','refresh_token'],token_endpoint_auth_method:'none',id_token_signed_response_alg:'ES256'}],
 responseTypes:['code'],scopes:['openid','offline_access'],subjectTypes:['public'],claims:{openid:['sub']},
 formats:{bitsOfOpaqueRandomness:256},pkce:{required:()=>true},rotateRefreshToken:()=>true,
 issueRefreshToken:()=>true,expiresWithSession:()=>false,
 ttl:{AccessToken:300,AuthorizationCode:60,RefreshToken:Math.min(policy.max_grant_seconds,2592000),Grant:Math.min(policy.max_grant_seconds,2592000),Session:3600,Interaction:600,IdToken:300},
 features:{devInteractions:{enabled:false},registration:{enabled:false},revocation:{enabled:true,allowedPolicy:(_ctx,client,token)=>client.clientId===token.clientId},userinfo:{enabled:false},
 resourceIndicators:{enabled:true,defaultResource:()=>config.resource,useGrantedResource:()=>true,
 getResourceServerInfo:async(_ctx,resource)=>{if(resource!==config.resource)throw new errors.InvalidTarget();return {scope:'lookout',audience:config.resource,accessTokenFormat:'opaque',accessTokenTTL:300};}}},
 renderError:async(ctx)=>{ctx.type='html';ctx.body='<!doctype html><title>Connection unavailable</title><p>Connection setup was rejected. Return to Lookout and restart setup.</p>';},
 findAccount:async(_ctx,id)=>({accountId:id,claims:async()=>({sub:id})}),
 interactions:{url:(_ctx,interaction)=>config.issuer+'/interaction/'+interaction.uid},
 loadExistingGrant:async ctx=>{const id=ctx.oidc.result?.consent?.grantId;return id?provider.Grant.find(id):undefined;},
 });
 // Trust the fixed configured issuer; never trust unvalidated forwarded Host headers.
 provider.proxy=!test;
 provider.use(async(ctx,next)=>{
 if(ctx.path==='/auth'&&ctx.query.resource!==config.resource)throw new errors.InvalidTarget('Exact MCP resource is required');
 await next();
 });
 const callback=provider.callback();
 const tickets=new Adapter('ConsentTicket'),finishes=new Adapter('ConsentFinish');
 async function take(model,id){if(!opaqueAgentToken(id))throw Error('Invalid consent ticket');return store('take',{model,hash:hash(id)});}
 async function readJson(req){let size=0,text='';for await(const chunk of req){size+=chunk.length;if(size>16384)throw Error('Request too large');text+=chunk;}return JSON.parse(text);}
 const metadata={resource:config.resource,authorization_servers:[config.issuer],scopes_supported:['lookout'],bearer_methods_supported:['header']};
 async function handle(req,res,path){
 if(path==='/.well-known/oauth-protected-resource/mcp'||path==='/.well-known/oauth-protected-resource'){json(res,200,metadata);return true;}
 if(path==='/.well-known/oauth-authorization-server/oauth'){req.url='/oauth/.well-known/oauth-authorization-server';path='/oauth/.well-known/oauth-authorization-server';}
 if(!path.startsWith('/oauth/')&&path!=='/oauth')return false;
 res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',"frame-ancestors 'none'; base-uri 'none'");
 req.headers['x-forwarded-host']=issuer.host;req.headers['x-forwarded-proto']=issuer.protocol.slice(0,-1);
 try{
 if(path==='/oauth/consent'){
 if(req.headers.origin!==webOrigin)return json(res,403,{error:'Origin forbidden'}),true;
 res.setHeader('Access-Control-Allow-Origin',webOrigin);res.setHeader('Vary','Origin');
 if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.writeHead(204);res.end();return true;}
 if(req.method!=='POST'||!req.headers['content-type']?.includes('application/json'))return json(res,400,{error:'JSON POST required'}),true;
 const token=req.headers.authorization?.match(/^Bearer ([^\s]+)$/)?.[1];
 const human=token&&await authenticateHuman(token);if(!human?.id||human.is_anonymous||human.oauth)throw Error('Human sign-in required');
 const body=await readJson(req);if(!opaqueAgentToken(body.ticket))throw Error('Invalid consent ticket');
 const ticket=await tickets.find(body.ticket);if(!ticket)throw Error('Consent expired');
 if(body.action==='read'){
 const connections=await store('connections',{user:human.id});json(res,200,{client:'ChatGPT',resource:config.resource,connections});return true;
 }
 if(body.action!=='approve'&&body.action!=='deny')throw Error('Invalid consent action');
 const connections=await store('connections',{user:human.id});
 const connection=connections.find(c=>c.id===body.connectionId);
 if(body.action==='approve'&&(!connection||JSON.stringify(connection.scopes)!==JSON.stringify(body.scopes)||!Number.isFinite(Date.parse(body.expiresAt))||Date.parse(body.expiresAt)<=Date.now()||Date.parse(body.expiresAt)>Date.parse(connection.expiresAt)))throw Error('Connection changed');
 const consumed=await take('ConsentTicket',body.ticket);if(!consumed)throw Error('Consent already used');
 const finish=secret();await finishes.upsert(finish,{uid:ticket.uid,user:human.id,connection:connection?{...connection,expiresAt:body.expiresAt}:null,denied:body.action==='deny'},120);
 json(res,200,{redirect:config.issuer+'/interaction/'+ticket.uid+'/finish?ticket='+encodeURIComponent(finish)});return true;
 }
 if(path.startsWith('/oauth/interaction/')&&!path.endsWith('/finish')){
 if(req.method!=='GET')throw Error('Use GET');
 const details=await provider.interactionDetails(req,res);
 if(path!==`/oauth/interaction/${details.uid}`||details.params.client_id!==config.clientId||details.params.resource!==config.resource)throw Error('Wrong interaction');
 const ticket=secret();await tickets.upsert(ticket,{uid:details.uid},600);
 res.writeHead(303,{Location:config.consentUrl+'#ticket='+encodeURIComponent(ticket)});res.end();return true;
 }
 if(/^\/oauth\/interaction\/[^/]+\/finish$/.test(path)){
 if(req.method!=='GET')throw Error('Use GET');
 const details=await provider.interactionDetails(req,res),ticket=new URL(req.url,config.issuer).searchParams.get('ticket');
 // Check browser interaction cookie BEFORE consuming the completion capability.
 const pending=ticket&&await finishes.find(ticket);if(!pending||pending.uid!==details.uid||path!==`/oauth/interaction/${details.uid}/finish`||details.params.client_id!==config.clientId||details.params.resource!==config.resource)throw Error('Wrong browser interaction');
 const finish=await take('ConsentFinish',ticket);if(!finish)throw Error('Consent already used');
 await store('complete',{hash:hash(details.uid)});
 if(finish.denied){await provider.interactionFinished(req,res,{error:'access_denied'},{mergeWithLastSubmission:false});return true;}
 const grant=new provider.Grant({accountId:finish.user,clientId:config.clientId});grant.jti=grant.generateTokenId();
 const bound=await store('bind',{grant:grant.jti,user:finish.user,connection:finish.connection.id,scopes:finish.connection.scopes,expires:finish.connection.expiresAt,client:config.clientId,resource:config.resource});
 grant.addOIDCScope('openid offline_access');grant.addResourceScope(config.resource,'lookout');
 await grant.save(Math.max(1,Math.floor((Date.parse(bound.expires_at)-Date.now())/1000)));
 await provider.interactionFinished(req,res,{login:{accountId:finish.user},consent:{grantId:grant.jti}},{mergeWithLastSubmission:false});return true;
 }
 // Mount the library at the fixed issuer path; preserve original URL for issuer generation.
 req.originalUrl=req.url;req.url=req.url.slice('/oauth'.length)||'/';
 await callback(req,res);return true;
 }catch{if(!res.headersSent)json(res,400,{error:'OAuth request rejected; restart connection setup'});else res.end();return true;}
 }
 return {provider,handle,challenge:`Bearer resource_metadata="${issuer.origin}/.well-known/oauth-protected-resource/mcp"`};
}
