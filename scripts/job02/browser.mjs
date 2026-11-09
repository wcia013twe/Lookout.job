// Host-owned browser. Models get bounded field operations, no click/evaluate/key/network API.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import {chromium} from 'playwright';
import {hash,write,read} from './core.mjs';
export class BrowserHost{
 constructor({targets,resume,output,profile,executablePath,synthetic=false,controlled=false,fixtureRoot=null}){Object.assign(this,{targets,resume,output,profile,executablePath,synthetic,controlled,fixtureRoot});this.pages=new Map();this.events=[];this.sequence=0;}
 async start(){fs.mkdirSync(this.output,{recursive:true,mode:0o700});this.context=await chromium.launchPersistentContext(this.profile,{headless:true,executablePath:this.executablePath||undefined,serviceWorkers:'block',acceptDownloads:false});
  await this.context.routeWebSocket('**/*',ws=>ws.close());
  await this.context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url()),target=this.context.pages().find(p=>p===req.frame().page())?._job02Target;
   if(this.controlled){
    if(target&&req.method()==='GET'&&req.url()===target.url&&req.isNavigationRequest()&&target.fixture&&/^[a-z0-9_-]+\.html$/i.test(target.fixture)){return route.fulfill({status:200,contentType:'text/html',body:fs.readFileSync(path.join(this.fixtureRoot,target.fixture))});}
    this.events.push({kind:'network_blocked',targetId:target?.id,method:req.method(),url:u.origin+u.pathname});return route.abort('blockedbyclient');
   }
   const allowed=target&&this.allowRequest(req,target);
   if(!allowed){this.events.push({kind:'network_blocked',targetId:target?.id,method:req.method(),url:u.origin+u.pathname});return route.abort('blockedbyclient');}
   return route.continue();
  });return this;
 }
 allowRequest(req,t){
  const url=new URL(req.url()),base=new URL(t.url);
  if(url.origin!==base.origin&&!t.resourceOrigins?.includes(url.origin))return false;
  if(!['GET','HEAD'].includes(req.method()))return t.safeBeforeSubmit===true&&(t.safeUploadEndpoints||[]).includes(req.url())&&req.method()==='POST';
  if(req.isNavigationRequest())return req.frame()===req.frame().page().mainFrame()&&req.url()===t.url;
  return !['document','fetch','xhr','eventsource'].includes(req.resourceType());
 }
 target(id){const t=this.targets.find(t=>t.id===id);if(!t)throw Error('Unknown fixed target');return t;}
 async open(id){const t=this.target(id);if(t.kind==='workday'){this.manuals??=new Set();this.manuals.add(id);return {targetId:id,manualHandoff:true,url:t.url,inspectionComplete:false,questions:[],reason:'Workday is yours to complete. Open the employer application link.'};}
  let p=this.pages.get(id);if(!p){p=await this.context.newPage();p._job02Target=t;this.pages.set(id,p);await p.goto(t.url,{waitUntil:'domcontentloaded',timeout:30000});}return this.inspect(id);
 }
 async inspect(id){if(this.drift)throw Error('Frozen form drift; stop this pair and prepare a new target freeze');const p=this.pages.get(id);if(!p)throw Error('Open this target first');
  const data=await p.evaluate(()=>{
   const els=[...document.querySelectorAll('input:not([type=submit]):not([type=button]),textarea,select')];
   const fields=els.map((e,index)=>({fieldId:e.id||`${e.name||e.tagName.toLowerCase()}:${index}`,index,fieldType:e.type||e.tagName.toLowerCase(),question:(e.labels?.[0]?.innerText||e.getAttribute('aria-label')||e.name||'').trim(),required:e.required,disabled:e.disabled,visible:!!(e.offsetWidth||e.offsetHeight||e.getClientRects().length),options:e.tagName==='SELECT'?[...e.options].map(o=>({value:o.value,label:o.label})):[],maxLength:e.maxLength>0?e.maxLength:null,value:e.type==='file'?null:e.type==='checkbox'||e.type==='radio'?e.checked:e.value,files:e.files?[...e.files].map(f=>({name:f.name,size:f.size,type:f.type})):[],valid:e.checkValidity(),validationMessage:e.validationMessage||null}));
   return {url:location.href,pageText:document.body.innerText.slice(0,30000),fields,alerts:[...document.querySelectorAll('[role=alert],.error,.field-error,[aria-invalid=true]')].filter(e=>e.offsetWidth||e.offsetHeight||e.getClientRects().length).map(e=>e.innerText||e.getAttribute('aria-label')||'Invalid control').filter(Boolean),busy:!!document.querySelector('[aria-busy=true]'),formCount:document.forms.length,iframeCount:document.querySelectorAll('iframe').length,nextControl:[...document.querySelectorAll('button,input[type=submit]')].some(e=>/^(next|continue|save and continue)$/i.test(e.innerText?.trim()||e.value||'')),submitControls:[...document.querySelectorAll('button[type=submit],input[type=submit]')].map(e=>({text:e.innerText||e.value,disabled:e.disabled}))};
  });
  const shape=data.fields.map(({value,files,valid,validationMessage,...f})=>f),fingerprint=hash(shape);
  const target=this.target(id),allowed=[target.expectedFingerprint,...(target.expectedFingerprints||[])].filter(Boolean);
  if((!this.synthetic&&!target.expectedFingerprint)||(allowed.length&&!allowed.includes(fingerprint))){
   this.drift={kind:'frozen_form_drift',targetId:id,expectedFingerprint:target.expectedFingerprint??null,allowedFingerprints:allowed,observedFingerprint:fingerprint,submissionAllowed:false};
   fs.mkdirSync(this.output,{recursive:true,mode:0o700});write(path.join(this.output,'form-drift.json'),this.drift);
   throw Error('Frozen form drift; stop this pair and prepare a new target freeze');
  }
  const complete=data.formCount===1&&data.iframeCount===0&&!data.nextControl;
  const result={targetId:id,...data,fingerprint,inspectionComplete:complete,readyToSubmit:complete&&data.fields.filter(f=>f.visible&&!f.disabled).every(f=>f.valid)&&data.alerts.length===0&&!data.busy,resumeUpload:this.uploads?.get(id)||null,submissionAllowed:false};
  this.last??=new Map();this.last.set(id,result);return result;
 }
 async fill(id,fieldId,value,expectedFingerprint){
  const current=await this.inspect(id);if(current.fingerprint!==expectedFingerprint)throw Error('Form changed; reinspect before filling');
  const matches=current.fields.filter(f=>f.fieldId===fieldId);if(matches.length!==1)throw Error('Ambiguous or missing field');const f=matches[0];
  if(f.disabled||!f.visible||['hidden','file'].includes(f.fieldType))throw Error('Unsupported or nonvisible field');
  const loc=this.pages.get(id).locator('input:not([type=submit]):not([type=button]),textarea,select').nth(f.index);
  if(['checkbox','radio'].includes(f.fieldType)){if(typeof value!=='boolean')throw Error('Boolean choice required');await loc.setChecked(value);}
  else if(f.fieldType==='select-one'){if(!f.options.some(o=>o.value===value))throw Error('Exact current option required');await loc.selectOption(value);}
  else {if(typeof value!=='string'||f.maxLength&&value.length>f.maxLength)throw Error('Invalid field value/length');await loc.fill(value);}
  return this.inspect(id);
 }
 async upload(id,fieldId,expectedFingerprint){
  const c=await this.inspect(id);if(c.fingerprint!==expectedFingerprint)throw Error('Form changed; reinspect');const matches=c.fields.filter(f=>f.fieldId===fieldId&&f.fieldType==='file');
  if(matches.length!==1||! /resume|résumé|cv\b/i.test(matches[0].question))throw Error('Exact inspected resume input required');
  await this.pages.get(id).locator('input:not([type=submit]):not([type=button]),textarea,select').nth(matches[0].index).setInputFiles(this.resume);
  this.uploads??=new Map();this.uploads.set(id,{fieldId,sha256:hash(fs.readFileSync(this.resume)),bytes:fs.statSync(this.resume).size});const result=await this.inspect(id);result.upload=result.resumeUpload;return result;
 }
 async capture(label){if(!/^[a-z0-9_-]+$/i.test(label))throw Error('Safe capture label required');const targets=[];for(const t of this.targets){const p=this.pages.get(t.id);if(!p){targets.push({targetId:t.id,observed:this.manuals?.has(t.id)===true,manualHandoff:this.manuals?.has(t.id)===true,url:t.url,inspectionComplete:false});continue;}const state=await this.inspect(t.id),name=`${label}-${t.id}.png`;await p.screenshot({path:path.join(this.output,name),fullPage:true});targets.push({...state,screenshot:name});}const r={synthetic:this.synthetic,targets,networkEvents:this.events,at:new Date().toISOString()};write(path.join(this.output,label+'.json'),r);return r;}
 async call(name,a){if(name==='browser_open')return this.open(a.targetId);if(name==='browser_inspect')return this.inspect(a.targetId);if(name==='browser_fill')return this.fill(a.targetId,a.fieldId,a.value,a.expectedFingerprint);if(name==='browser_upload_resume')return this.upload(a.targetId,a.fieldId,a.expectedFingerprint);throw Error('Browser operation unavailable; submission/click/key/evaluate are not exposed');}
 async close(){if(this.context)await this.context.close();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===import.meta.filename){
 const cfg=read(process.argv[2]),b=await new BrowserHost(cfg).start();
 for await(const line of readline.createInterface({input:process.stdin})){try{const m=JSON.parse(line);if(m.name==='capture'){console.log(JSON.stringify({result:await b.capture(m.arguments.label)}));}else console.log(JSON.stringify({result:await b.call(m.name,m.arguments)}));}catch(e){console.log(JSON.stringify({error:e.message}));}}
 await b.close();
}
