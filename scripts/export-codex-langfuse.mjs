#!/usr/bin/env node
// Read-only import of harness receipts. No agent execution, grading or source mutation.
import {readFile, readdir, mkdir, writeFile, lstat, open, unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {tracingConfig, redact} from '../backend/runtime/trace-policy.mjs';

const VERSION = 'codex-import-1';
const {values} = parseArgs({options: {
  run: {type:'string'}, 'receipt-dir': {type:'string'}, 'include-content': {type:'boolean', default:false},
  'dry-run': {type:'boolean', default:false}, help: {type:'boolean', default:false},
}});
if (values.help || !values.run) {
  console.log('Usage: node --env-file=.env.local scripts/export-codex-langfuse.mjs --run <terminal-run-directory> [--dry-run] [--include-content] [--receipt-dir <directory>]');
  process.exit(values.help ? 0 : 2);
}
const hash = v => createHash('sha256').update(v).digest('hex');
const json = async p => JSON.parse(await readFile(p,'utf8'));
const terminal = new Set(['completed','execution_failed','timed_out','setup_failed','artifact_failed']);
const root = path.resolve(values.run);
const manifest = await json(path.join(root,'run.json'));
if (!terminal.has(manifest.status)) throw Error('Refusing an active or unknown run status');
if (!manifest.episodeId || !manifest.taskId || !['baseline','lookout'].includes(manifest.condition)) throw Error('Unsupported run manifest');
const config = tracingConfig();
if (!values['dry-run'] && !config) throw Error('Set LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY and LANGFUSE_BASE_URL');
const mode = values['include-content'] ? 'redacted-content' : 'structure-only';
const receiptDir = path.resolve(values['receipt-dir'] || '.langfuse-exports');
// Exact historical timestamps require OTLP; do not recreate spans timed at upload.
const ns = sec => { if (!Number.isFinite(sec) || sec <= 0) throw Error('Missing original timestamp'); return (BigInt(Math.round(sec * 1e6)) * 1000n).toString(); };
const attr = (key,value) => ({key,value: typeof value === 'number' ? {doubleValue:value} : typeof value === 'boolean' ? {boolValue:value} : {stringValue:typeof value === 'string' ? value : JSON.stringify(value)}});
const content = value => {
  if (value == null) return null;
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return values['include-content'] ? redact(value) : {captured:false, bytes:Buffer.byteLength(text), sha256:hash(text)};
};
let lock;
if (!values['dry-run']) {
  await mkdir(receiptDir,{recursive:true,mode:0o700});
  lock = path.join(receiptDir, hash([config.baseUrl,config.publicKey,manifest.episodeId,VERSION,mode].join(':'))+'.lock');
  const handle = await open(lock,'wx',0o600).catch(() => { throw Error('Import lock exists. Confirm no importer is running before removing its lock.'); });
  await handle.close();
}
try {
  const stages = (await readdir(root)).filter(n => /^stage-\d+$/.test(n)).sort((a,b)=>Number(a.slice(6))-Number(b.slice(6)));
  const reports = [];
  for (const stage of stages) {
    const dir = path.join(root,stage);
    const meta = await json(path.join(dir,'stage-run.json')).catch(error => { if(error.code === 'ENOENT') return null; throw error; });
    if (!meta) continue; // Setup may fail before a participant is launched.
    if (!terminal.has(meta.status)) throw Error('Stage is not terminal: '+stage);
    const file = path.join(dir,'trace.jsonl');
    const stat = await lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 64 * 1024 * 1024) throw Error('Invalid or oversized trace');
    const raw = await readFile(file,'utf8');
    const rows = raw.split('\n').filter(Boolean).map(line=>JSON.parse(line));
    if (rows.some(r=>!Number.isFinite(r.capturedAt) || !r.event)) throw Error('Expected timestamped runtime-v4 event envelopes');
    const sourceHash = hash(raw+JSON.stringify(meta));
    const traceId = hash([VERSION,mode,manifest.episodeId,stage,sourceHash].join(':')).slice(0,32);
    const sessionId = 'benchmark-'+hash(manifest.episodeId).slice(0,32);
    const base = {
      'langfuse.trace.name':'execute-codex-session',
      'session.id':sessionId,
      'langfuse.environment':'benchmark',
      'langfuse.version':VERSION,
      'langfuse.trace.metadata.taskId':manifest.taskId,
      'langfuse.trace.metadata.condition':manifest.condition,
      'langfuse.trace.metadata.repeat':String(manifest.repeat),
      'langfuse.trace.metadata.pairId':manifest.pairId || '',
      'langfuse.trace.metadata.episodeId':manifest.episodeId,
      'langfuse.trace.metadata.stage':stage,
      'langfuse.trace.metadata.model':manifest.model || 'unknown',
      'langfuse.trace.metadata.reasoning':manifest.reasoning || 'unknown',
      'langfuse.trace.metadata.suiteHash':manifest.suiteHash || 'unknown',
      'langfuse.trace.metadata.pilot':String(manifest.pilot === true),
      'langfuse.trace.metadata.captureMode':mode,
      'langfuse.trace.metadata.timingSource':'orchestrator receipt timestamps',
      'langfuse.trace.metadata.threadId':meta.threadId || 'unknown',
    };
    const spans = [];
    const begin = meta.startedAt;
    const end = begin + meta.durationSeconds;
    ns(begin);ns(end);
    const make = (key,name,type,start,finish,parent,input,output,metadata={},error=false) => {
      const spanId=hash(traceId+':'+key).slice(0,16);
      spans.push({traceId,spanId,...(parent?{parentSpanId:parent}:{}),name,kind:1,
        startTimeUnixNano:ns(start),endTimeUnixNano:ns(Math.max(start,finish)),
        attributes:Object.entries({...base,'langfuse.observation.type':type,
          'langfuse.observation.input':JSON.stringify(input),'langfuse.observation.output':JSON.stringify(output),
          ...Object.fromEntries(Object.entries(metadata).filter(([,v])=>v!==undefined).map(([k,v])=>['langfuse.observation.metadata.'+k,typeof v==='string'?v:JSON.stringify(v)])),
          ...(error?{'langfuse.observation.level':'ERROR','langfuse.observation.status_message':'Execution did not complete'}:{})}).map(([k,v])=>attr(k,v)),
        status:{code:error?2:1}});
      return spanId;
    };
    const prompt=await readFile(path.join(dir,'prompt.txt'),'utf8').catch(error=>{if(error.code==='ENOENT')return '';throw error;});
    const finalMessages=rows.filter(r=>r.event.type==='item.completed' && r.event.item?.type==='agent_message').map(r=>r.event.item.text);
    const parent = make('session','execute-codex-session','agent',begin,end,null,
      {prompt:content(prompt)}, {status:meta.status,response:content(finalMessages)},
      {reportedUsage:meta.usage || null,usageScope:'whole Codex turn/session; not per model invocation',model:manifest.model,reasoning:manifest.reasoning,resumed:meta.resumed,sourceHash,rawReasoning:'not captured by harness'},meta.status!=='completed');
    const starts=new Map();
    const pending=new Map();
    for (const [index,row] of rows.entries()) {
      const e=row.event, item=e.item;
      if(e.type==='item.started' && item?.id) { starts.set(item.id,row.capturedAt); pending.set(item.id,item); }
      if(e.type!=='item.completed' || !item || item.type==='reasoning') continue;
      pending.delete(item.id);
      const type=['command_execution','mcp_tool_call','web_search','file_change'].includes(item.type)?'tool':'event';
      const name=({command_execution:'execute-command',mcp_tool_call:'call-mcp-tool',web_search:'search-web',file_change:'change-files',agent_message:'respond-to-user'})[item.type] || 'record-codex-event';
      const toolName=typeof item.tool==='string' && /^[a-zA-Z0-9_.-]{1,100}$/.test(item.tool)?item.tool:undefined;
      make('item-'+index,name,type,starts.get(item.id)||row.capturedAt,row.capturedAt,parent,
        content(item.arguments ?? item.command ?? item.query ?? null),
        content(item.result ?? item.aggregated_output ?? item.text ?? item.changes ?? item.error ?? null),
        {itemType:item.type,tool:toolName,exitCode:item.exit_code??null,status:item.status??null,startObserved:starts.has(item.id)},
        item.status==='failed' || item.error != null || typeof item.exit_code==='number' && item.exit_code!==0);
    }
    for (const [id,item] of pending) {
      if(!['command_execution','mcp_tool_call','web_search','file_change'].includes(item.type)) continue;
      make('unfinished-'+id,'interrupt-tool','tool',starts.get(id),end,parent,content(item.arguments ?? item.command ?? null),{status:'completion-not-observed'},{itemType:item.type},true);
    }
    const receiptPath=path.join(receiptDir,hash((config?.baseUrl||'')+(config?.publicKey||'')+traceId)+'.json');
    const prior=await json(receiptPath).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
    if(prior?.status==='accepted') { reports.push({stage,traceId,status:'already-accepted'});continue; }
    if(values['dry-run']) { reports.push({stage,traceId,sessionId,observations:spans.length,mode,status:'preview'});continue; }
    const chunks=[];
    let current=[];
    for(const span of spans) {
      if(current.length && (current.length>=80 || Buffer.byteLength(JSON.stringify([...current,span]))>750000)){chunks.push(current);current=[];}
      current.push(span);
    }
    if(current.length)chunks.push(current);
    const receipt={version:VERSION,traceId,sessionId,sourceHash,mode,status:'uploading',acceptedChunks:prior?.acceptedChunks||0,observations:spans.length};
    const save=async()=>writeFile(receiptPath,JSON.stringify(receipt,null,2)+'\n',{mode:0o600});
    await save();
    for(let i=receipt.acceptedChunks;i<chunks.length;i++) {
      const payload={resourceSpans:[{resource:{attributes:[attr('service.name','lookout-benchmark')]},scopeSpans:[{scope:{name:'lookout-codex-import',version:VERSION},spans:chunks[i]}]}]};
      const response=await fetch(config.baseUrl+'/api/public/otel/v1/traces',{method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),
        headers:{'Content-Type':'application/json','x-langfuse-ingestion-version':'4',Authorization:'Basic '+Buffer.from(config.publicKey+':'+config.secretKey).toString('base64')},body:JSON.stringify(payload)});
      if(!response.ok)throw Error('Langfuse ingestion failed with HTTP '+response.status+'; local traces retained');
      const body=await response.json();
      if(Number(body.partialSuccess?.rejectedSpans||0)>0 || body.partialSuccess?.errorMessage)throw Error('Langfuse reported partial ingestion; inspect the import receipt');
      receipt.acceptedChunks=i+1;await save();
    }
    receipt.status='accepted';await save();reports.push({stage,traceId,sessionId,observations:spans.length,status:'accepted'});
  }
  console.log(JSON.stringify({version:VERSION,mode,stages:reports,notice:'Accepted means ingestion acknowledged, not read-back verified. No participant was executed.'},null,2));
} finally { if(lock)await unlink(lock); }
