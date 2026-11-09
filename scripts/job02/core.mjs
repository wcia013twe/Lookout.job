import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
export const hash=v=>createHash('sha256').update(typeof v==='string'||Buffer.isBuffer(v)?v:JSON.stringify(v)).digest('hex');
export const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
export const write=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true,mode:0o700});fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n',{flag:'wx',mode:0o600});};
export const digest=p=>hash(fs.readFileSync(p));
export function files(root,exclude=[]){const out={};for(const d of fs.readdirSync(root,{withFileTypes:true})){if(exclude.includes(d.name))continue;const p=path.join(root,d.name);if(d.isSymbolicLink())throw Error('Symlink evidence rejected');if(d.isDirectory())for(const [n,h]of Object.entries(files(p,exclude)))out[d.name+'/'+n]=h;else if(d.isFile())out[d.name]=digest(p);}return out;}
export function validateTargets(spec){
 if(spec.taskId!=='JOB02'||spec.noSubmit!==true||spec.targets.length!==3)throw Error('JOB02 fixed three-target no-submit scenario required');
 for(const [i,kind]of ['workday','personal_input','greenhouse'].entries()){
  const t=spec.targets[i];if(t.kind!==kind||!t.id||!t.url||!t.title||!t.company)throw Error('Exact live target selection pending: '+kind);
  const u=new URL(t.url);if(u.protocol!=='https:'||u.username||u.password||u.hash)throw Error('Canonical HTTPS target required');
  if(kind==='workday'&&!/(^|\.)myworkdayjobs\.com$/.test(u.hostname))throw Error('Manual target must be actual Workday');
  if(kind!=='workday'&&!['job-boards.greenhouse.io','boards.greenhouse.io'].includes(u.hostname))throw Error('Supported single-page native Greenhouse target required');
  if(t.expectedFingerprints!==undefined&&(!Array.isArray(t.expectedFingerprints)||t.expectedFingerprints.length>20||t.expectedFingerprints.some(x=>typeof x!=='string'||! /^[a-f0-9]{64}$/.test(x))))throw Error('Reviewed conditional form fingerprints required');
  if(kind!=='workday'&&(t.safeBeforeSubmit!==true||!t.sideEffectEvidence?.length||!t.expectedFingerprint))throw Error('Live upload/autosave evidence and form fingerprint required');
 }
 if(new Set(spec.targets.map(t=>t.id)).size!==3||new Set(spec.targets.map(t=>t.url)).size!==3)throw Error('Unique targets required');
 return true;
}
export function validateReference(spec,reference,actor){
 if(reference.status!=='reviewed'||!reference.reviewer||actor.status!=='reviewed'||!actor.reviewer)throw Error('Reviewed private field reference and actor required');
 for(const t of spec.targets)if(reference.outcomes?.[t.id]!==undefined&&!['manual','ready','ready_or_supported_blocker'].includes(reference.outcomes[t.id]))throw Error('Frozen target outcome invalid');
 for(const stage of spec.stages)for(const target of spec.targets){const criteria=reference.criteria?.[stage.id]?.[target.id];if(!Array.isArray(criteria)||!criteria.length||criteria.some(k=>!spec.quality.includes(k)))throw Error('Applicable stage-target rubric required');}
 for(const target of spec.targets.filter(t=>t.kind!=='workday')){const fields=reference.fields?.[target.id];if(!Array.isArray(fields)||!fields.length||fields.some(f=>!f.fieldId||!Array.isArray(f.acceptedValues)||!f.acceptedValues.length))throw Error('Live factual field references required');}
 return true;
}
export function actorAnswer(actor,targetId,question){
 if(typeof question!=='string'||!question.trim())throw Error('Specific question required');
 const found=actor.facts.filter(f=>(f.targetId===targetId||f.targetId==='*')&&new RegExp(f.questionPattern,'i').test(question));
 if(found.length!==1)return {factId:null,answer:actor.unknownResponse,reuse:'none',ambiguous:found.length>1};
 const f=found[0];return {factId:f.unknown?null:f.id,answer:f.answer,reuse:f.reuse,unknown:f.unknown===true};
}
export function assertFrozen(root){const f=read(path.join(root,'freeze.json'));for(const [name,h]of Object.entries(f.files))if(digest(path.resolve(root,name))!==h)throw Error('Frozen binding changed: '+name);return f;}
export const gates=['browser_parity','native_schemas','human_ingress','three_path_rehearsal','submission_guard','failure_injection','live_targets','grader_handoff','telemetry_mapping'];
export function readiness(root,receipts){
 const freeze=assertFrozen(root),errors=[];try{validateTargets(read(path.join(root,'suite/scenario.json')));}catch(e){errors.push(e.message);}
 try{validateReference(read(path.join(root,'suite/scenario.json')),read(path.join(root,'reference.private.json')),read(path.join(root,'suite/actor.private.json')));}catch(e){errors.push(e.message);}
 for(const gate of gates){const r=receipts[gate];if(!r||r.status!=='passed'||r.freezeHash!==digest(path.join(root,'freeze.json'))||r.synthetic!==false&&['browser_parity','native_schemas','human_ingress','live_targets'].includes(gate)||!r.artifacts||!Object.keys(r.artifacts).length)errors.push('Missing actual bound gate: '+gate);else for(const [p,h]of Object.entries(r.artifacts))if(!fs.existsSync(p)||digest(p)!==h)errors.push('Gate evidence changed: '+gate);}
 const ledger=fs.existsSync(path.join(root,'errors.json'))?read(path.join(root,'errors.json')):[];
 for(const e of ledger)if(!e.resolvedBy||!Object.values(receipts).some(r=>r.id===e.resolvedBy&&r.status==='passed'&&r.errorIds?.includes(e.id)))errors.push('Unresolved harness error: '+e.id);
 return {taskId:'JOB02',ready:errors.length===0,freezeHash:digest(path.join(root,'freeze.json')),gateHashes:Object.fromEntries(Object.entries(receipts).map(([k,v])=>[k,hash(v)])),errors,inferenceExecuted:false,createdAt:new Date().toISOString(),version:freeze.version};
}
export function launchGate(root){const f=assertFrozen(root),r=read(path.join(root,'readiness.json')),receipts=read(path.join(root,'receipts.json')),now=readiness(root,receipts);if(!r.ready||!now.ready||hash(r.gateHashes)!==hash(now.gateHashes)||r.freezeHash!==digest(path.join(root,'freeze.json')))throw Error('Launch blocked: valid receipt-bound readiness required');return f;}
export function recordError(root,error,classification='harness'){
 const p=path.join(root,'errors.json'),ledger=fs.existsSync(p)?read(p):[];
 const entry={id:'JOB02-error-'+String(ledger.length+1),at:new Date().toISOString(),classification,message:String(error.message||error).slice(0,300),resolvedBy:null};
 ledger.push(entry);fs.writeFileSync(p,JSON.stringify(ledger,null,2)+'\n',{mode:0o600});return entry;
}
