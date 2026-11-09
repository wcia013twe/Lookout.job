#!/usr/bin/env node
// Publish only fictional targets through the ordinary scoped writer, before freeze.
import fs from 'node:fs';import {randomUUID} from 'node:crypto';import {account,mcp} from './native.mjs';import {read,write,hash} from './core.mjs';
const [root,source,out]=process.argv.slice(2);if(!root||!source||!out||fs.existsSync(root+'/freeze.json'))throw Error('Seed new owner before freeze only');
const a=account(root),spec=read(source);if(spec.mode!=='controlled_clearing'||spec.targets.some(t=>t.fictional!==true))throw Error('Fictional controlled targets only');
const batch=await mcp(a,'publish_batch',{eventKey:randomUUID(),label:'Fixed application targets',jobs:spec.targets.map(t=>({canonicalUrl:t.url,employer:{company:t.company,title:t.title,employmentType:'FT',location:'Remote'}}))});
const batchId=batch.batch?.id??batch.id;if(!batchId)throw Error('Published batch ID missing');
const saved=await mcp(a,'read_batch',{batchId});
for(const t of spec.targets){const items=(saved.items||[]).filter(x=>(x.job?.canonical_url??x.job?.canonicalUrl??x.canonical_url??x.canonicalUrl)===t.url);const item=items.length===1?items[0]:null;if(!item?.job_id||item.job?.id!==item.job_id||item.job?.employer?.company!==t.company||item.job?.employer?.title!==t.title)throw Error('Exact owned target metadata mapping missing');t.nativeJobId=item.job_id;}
if(new Set(spec.targets.map(t=>t.nativeJobId)).size!==3)throw Error('Unique owned targets required');write(out,spec);write(root+'/owned-targets.private.json',{status:'seeded',owner:a.userId,batchId,scenarioHash:hash(spec),targets:spec.targets.map(({id,url,nativeJobId})=>({id,url,nativeJobId})),batch,saved});console.log(JSON.stringify({status:'seeded',count:3}));
