import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
export function verifyHostGates(root,result){
 if(result.ready===false&&result.gates?.some(g=>g.name==='native_clock_alignment'&&g.status==='blocked'))throw Error('Native backend clock differs from simulated stages; no new pair may run');
 if(result.ready!==true||result.participantExecuted!==false||result.model!=='gpt-5.6-terra'||result.reasoning!=='medium'||!Array.isArray(result.gates))throw Error('Actual no-inference host gates required');
 const required=['native_owner_snapshot','context_parity','native_guidance','artifact_write_readback','pipeline_write_readback','restored_initial','scoped_native_discovery','baseline_container_surface','lookout_container_surface'];
 if(JSON.parse(fs.readFileSync(path.join(root,'configuration.json'))).benchmarkTaskId==='JOB03')required.push('shared_test_clock','interruption_recovery');
 if(JSON.parse(fs.readFileSync(path.join(root,'configuration.json'))).hostVersion==='jobs-host-v2')required.push('native_clock_alignment','baseline_inference_transport','lookout_inference_transport');
 const seen=new Set();
 for(const g of result.gates){
  const p=fs.realpathSync(g.path),base=fs.realpathSync(path.join(root,'receipts'))+path.sep;
  if(g.status!=='passed'||seen.has(g.name)||!p.startsWith(base)||fs.lstatSync(g.path).isSymbolicLink()||createHash('sha256').update(fs.readFileSync(p)).digest('hex')!==g.sha256)throw Error('Host gate evidence missing or changed');
  if(g.name==='native_clock_alignment'&&JSON.parse(fs.readFileSync(p)).aligned!==true)throw Error('Native backend clock differs from simulated stages');
  seen.add(g.name);
 }
 if(required.some(n=>!seen.has(n)))throw Error('Actual host gates incomplete');
 return result;
}
