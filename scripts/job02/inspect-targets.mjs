#!/usr/bin/env node
// Read-only target inspection. Never fills a field, uploads, clicks Apply or submits.
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
import {read,write,hash} from './core.mjs';
const [input,output]=process.argv.slice(2);if(!input||!output||fs.existsSync(output))throw Error('Usage: inspect-targets.mjs TARGETS_JSON NEW_OUTPUT');
fs.mkdirSync(output,{recursive:true,mode:0o700});const browser=await chromium.launch({headless:true,executablePath:process.env.JOB02_CHROMIUM||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),records=[];
try{for(const target of read(input)){
 const context=await browser.newContext({serviceWorkers:'block',acceptDownloads:false}),network=[];await context.routeWebSocket('**/*',ws=>ws.close());
 await context.route('**/*',route=>{const req=route.request();if(!['GET','HEAD'].includes(req.method())){network.push({blocked:true,method:req.method(),url:req.url()});return route.abort('blockedbyclient');}return route.continue();});
 const page=await context.newPage();try{
  const response=await page.goto(target.url,{waitUntil:'domcontentloaded',timeout:45000});await page.waitForTimeout(2500);
  const observed=await page.evaluate(()=>({url:location.href,title:document.title,text:document.body.innerText.slice(0,40000),forms:[...document.forms].map(f=>({action:f.action,method:f.method})),iframes:[...document.querySelectorAll('iframe')].map(f=>({src:f.src,title:f.title})),fields:[...document.querySelectorAll('input,textarea,select')].map((e,index)=>({fieldId:e.id||`${e.name||e.tagName.toLowerCase()}:${index}`,name:e.name,type:e.type||e.tagName.toLowerCase(),question:(e.labels?.[0]?.innerText||e.getAttribute('aria-label')||e.name||'').trim(),required:e.required,disabled:e.disabled,visible:!!(e.offsetWidth||e.offsetHeight||e.getClientRects().length),options:e.tagName==='SELECT'?[...e.options].map(o=>({value:o.value,label:o.label})):[],maxLength:e.maxLength>0?e.maxLength:null})),buttons:[...document.querySelectorAll('button,input[type=submit]')].map(b=>({text:b.innerText||b.value,type:b.type,disabled:b.disabled})),scripts:[...document.scripts].map(s=>s.src).filter(Boolean)}));
  write(path.join(output,target.id+'.json'),{source:target,checkedAt:new Date().toISOString(),status:response?.status(),readOnly:true,filled:false,uploaded:false,observed,blockedRequests:network,formMetadataHash:hash(observed.fields),sideEffectSafetyVerified:false});records.push({id:target.id,status:response?.status(),url:observed.url,fields:observed.fields.length,forms:observed.forms.length,iframes:observed.iframes.length,sideEffectSafetyVerified:false});
 }catch(e){write(path.join(output,target.id+'-failure.json'),{source:target,error:e.message,readOnly:true,filled:false,uploaded:false});records.push({id:target.id,error:e.message});}finally{await context.close();}
}}finally{await browser.close();}
write(path.join(output,'manifest.json'),{readOnly:true,participantInferenceExecuted:false,records});console.log(JSON.stringify(records));
