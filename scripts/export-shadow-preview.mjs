import {readFile,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {parseArgs} from 'node:util';
import {writeShadowPreview} from '../backend/runtime/shadow-preview.mjs';

const {values}=parseArgs({options:{trace:{type:'string'},subject:{type:'string'},project:{type:'string'}}});
if(!values.trace||!values.subject||!values.project)throw Error('Usage: node scripts/export-shadow-preview.mjs --trace <bounded-interview-trace.json> --subject subject-<16–64 hex> --project <project-id>');
if((await stat(values.trace)).size>200000)throw Error('Bounded trace required (200 KB maximum)');
const trace=JSON.parse(await readFile(values.trace,'utf8'));
if(trace.mode!=='one_bounded_disposable_fixture'||trace.fixtureSetup?.allIdentitiesAndContentFictional!==true)throw Error('This importer accepts only the bounded fictional interview trace; live data needs an explicitly authorized host integration');
const accessToken=execFileSync('gcloud',['auth','print-access-token','--project',values.project],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:20000}).trim();
const receipt=await writeShadowPreview(values.project,{
  subjectKey:values.subject,runId:trace.runId,trigger:'manual',mode:'fictional',
  recommendation:trace.agentOutput?.text,citations:trace.agentOutput?.citations,author:trace.agentOutput?.author,
  retrievalMs:trace.retrieval?.durationMs,model:trace.agentOutput?.model,
  tokenUsage:trace.agentOutput?.measurement?.tokenUsage,cost:trace.agentOutput?.measurement?.cost,
},accessToken);
console.log(JSON.stringify({project:values.project,...receipt}));
