#!/usr/bin/env python3
"""Probe actual pinned containers/MCP/browser with a fictional read-only form, no inference."""
import argparse,hashlib,http.server,json,subprocess,sys,threading,time,urllib.request
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
import importlib.util
entry=importlib.util.spec_from_file_location('job02_participant_host',Path(__file__).with_name('runner.py'));job=importlib.util.module_from_spec(entry);entry.loader.exec_module(job)

def probe(root,output):
 job.configure(root);root=Path(root).resolve();output=Path(output).resolve()
 job.node('check-freeze')
 if output.exists():raise RuntimeError('Preserve previous preflight; select new output')
 output.mkdir(parents=True,mode=0o700)
 class Form(http.server.BaseHTTPRequestHandler):
  def log_message(self,*args):pass
  def do_GET(self):
   self.send_response(200);self.send_header('Content-Type','text/html');self.end_headers();self.wfile.write(b'<form><label for="name">Full name</label><input id="name" required><button type="submit">Submit</button></form>')
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Form);thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
 report={'synthetic':False,'fixtureForms':True,'inferenceExecuted':False,'participantDomainWrites':False,'conditions':{}};job.host.infrastructure()
 try:
  for condition in ['baseline','lookout']:
   run=output/condition;run.mkdir();stage=run/'stage-1';stage.mkdir();(stage/'browser').mkdir();inputs=run/'live-inputs';inputs.mkdir();out=run/'output';out.mkdir()
   job.runtime.write(run/'active-stage.json',{'stage':1});job.runtime.write(run/'browser-config.private.json',{'targets':[{'id':'clean','kind':'greenhouse','url':f'http://127.0.0.1:{server.server_port}/form'}],'resume':str(root/'candidate/resume.pdf'),'output':str(stage/'browser'),'profile':str(run/'browser-profile'),'synthetic':True,'executablePath':json.loads((root/'runtime.private.json').read_text()).get('browserExecutable')})
   session=None
   try:
    session=job.runtime.Session(stage,inputs,out,condition,'preflight')
    def request(method,params):
     req=urllib.request.Request(session.bridge.url.replace('host.docker.internal','127.0.0.1'),data=json.dumps({'jsonrpc':'2.0','id':1,'method':method,'params':params}).encode(),headers={'Authorization':'Bearer '+session.bridge.key,'Content-Type':'application/json'})
     with urllib.request.urlopen(req,timeout=110)as response:reply=json.load(response)
     if reply.get('error')or reply.get('result',{}).get('isError'):raise RuntimeError('Actual preflight operation failed: '+str(reply)[:250])
     return reply
    # Verify exact writable mount and persistence through an independent fresh container/process, without inference.
    payload='JOB02 persistent storage probe'
    subprocess.run(['docker','exec',session.name,'python3','-c',"from pathlib import Path;Path('/workspace/output/storage-probe.txt').write_text('JOB02 persistent storage probe')"],check=True,capture_output=True,timeout=30)
    subprocess.run(['docker','run','--rm','--read-only','--network','none','--mount',f'type=bind,source={out},target=/workspace/output',job.runtime.IMAGE,'python3','-c',"from pathlib import Path;assert Path('/workspace/output/storage-probe.txt').read_text()=='JOB02 persistent storage probe'"],check=True,capture_output=True,timeout=30)
    if '/workspace/output' not in job.prompt({'id':'prepare'},condition):raise RuntimeError('Participant prompt omits actual persistent path')
    job.runtime.write(stage/'storage-verification.json',{'status':'passed','actualMountWritable':True,'freshContainerReadback':True,'promptNamesPath':'/workspace/output' in job.prompt({'id':'prepare'},condition),'inferenceExecuted':False})
    initial=request('initialize',{'protocolVersion':'2024-11-05','capabilities':{},'clientInfo':{'name':'JOB02-preflight','version':'3'}});job.runtime.write(stage/'actual-initialize.json',initial)
    tools=request('tools/list',{});job.runtime.write(stage/'actual-tools.json',tools)
    names={t['name']for t in tools['result']['tools']}
    if condition=='baseline'and set(job.runtime.CONFIG['allowedTools'])&names:raise RuntimeError('Native tools leaked into baseline')
    if condition=='lookout':
     discovery=request('tools/call',{'name':'discover_tools','arguments':{'workflow':'all'}});job.runtime.write(stage/'actual-discovery.json',discovery)
     data=discovery['result'].get('structuredContent')
     if data is None:data=json.loads(next(x['text']for x in discovery['result']['content']if x['type']=='text'))
     data=data.get('data',data);discovered={x['name']for x in data.get('tools',[])}|names
     if not set(job.runtime.CONFIG['allowedTools'])<=discovered:raise RuntimeError('Actual on-demand schemas missing: '+','.join(sorted(set(job.runtime.CONFIG['allowedTools'])-discovered)))
    opened=request('tools/call',{'name':'browser_open','arguments':{'targetId':'clean'}});job.runtime.write(stage/'browser-open.json',opened)
    result=json.loads(opened['result']['content'][0]['text']);request('tools/call',{'name':'browser_fill','arguments':{'targetId':'clean','fieldId':'name','value':'Fictional preflight candidate','expectedFingerprint':result['fingerprint']}})
    job.capture(session,'final');report['conditions'][condition]={'status':'passed','subscriptionLogin':True,'browserViaActualMcp':True,'nativeToolNames':sorted(names)}
   finally:
    if session:session.close()
  report['status']='passed';job.runtime.write(output/'verification.json',report)
  artifacts={str(p):hashlib.sha256(p.read_bytes()).hexdigest()for p in output.rglob('*')if p.is_file()and p.name in ['verification.json','actual-tools.json','actual-initialize.json','actual-discovery.json','browser-open.json','final.json','final-clean.png','isolation.json','storage-verification.json']}
  for gate in ['browser_parity','native_schemas','storage_orientation']:
   job.runtime.write(output/(gate+'.json'),{'id':'JOB02-'+gate+'-'+str(time.time_ns()),'gate':gate,'status':'passed','synthetic':False,'fixtureForms':True,'freezeHash':hashlib.sha256((root/'freeze.json').read_bytes()).hexdigest(),'artifacts':artifacts,'errorIds':[]})
 except Exception as e:
  report.update(status='failed',errorType=type(e).__name__,error=str(e)[:400]);job.runtime.write(output/'failure.json',report)
  job.node('record-error','--detail',str(output/'failure.json'));raise
 finally:job.host.close_infrastructure();server.shutdown();server.server_close()
 print(json.dumps({'status':'passed','inferenceExecuted':False,'receiptDirectory':str(output)}))
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--root',required=True);p.add_argument('--output',required=True);a=p.parse_args();probe(a.root,a.output)
