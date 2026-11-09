#!/usr/bin/env python3
"""Pinned subscription participants; no grading or repair during a JOB02 attempt."""
import argparse,importlib.util,json,secrets,shutil,subprocess,sys,time,uuid,urllib.request
from pathlib import Path
LIB=Path(__file__).resolve().parent;REPO=LIB.parents[1]
def load(name,p):
 spec=importlib.util.spec_from_file_location(name,p);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
sys.path.insert(0,str(REPO/'scripts/n01'))
import runner as runtime
host=load('job02_shared_host',REPO/'scripts/job01/pilot.py');Bridge=load('job02_transport',LIB/'transport.py').Bridge
ROOT=None

def node(action,*args):return subprocess.run(['node',str(LIB/'cli.mjs'),action,'--root',str(ROOT),*map(str,args)],check=True,capture_output=True,text=True,timeout=180)
def snapshot(output):node('snapshot','--output',output)
def prompt(stage,condition):
 spec=json.loads((ROOT/'suite/scenario.json').read_text())
 shared='Prepare the fixed application batch in /inputs/targets.json. Your resume is /inputs/resume.pdf. Fill supported forms accurately and stop before Submit. Do not send messages, submit, approve, create accounts or enter credentials. Workday is a manual handoff. Use the provided bounded browser tools; do not inspect runtime credentials or configuration. '
 shared+=('Lookout is your persistent recruiting workspace. Use Lookout to retrieve relevant context, save drafts and unresolved employer questions, verify action cards and saved outcomes, and resume from current saved user answers. 'if condition=='lookout'else'Files in /workspace/output persist across sessions. Save relevant drafts, questions, answers and next steps there. ')
 if stage['id']=='prepare'and condition=='baseline':shared+='\n'+(ROOT/'candidate/profile.md').read_text()
 if stage['id']=='continue':shared+='This is the configured continuation. Read released user responses and retained state, finish independent preparation, and keep genuine blockers explicit. '
 else:shared+='Questions asked through ask_user are queued until the next session; continue independent work meanwhile. '
 return shared

def configure(root):
 global ROOT
 ROOT=Path(root).resolve();runtime.R=ROOT;runtime.CONFIG=json.loads((ROOT/'suite/scenario.json').read_text());runtime.Bridge=Bridge;runtime.command=host.command;runtime.inputs_prompt=prompt

def capture(session,label):
 account=json.loads((ROOT/'account.private.json').read_text());msg={'jsonrpc':'2.0','id':9001,'method':'tools/call','_hostOnly':account['hostKey'],'params':{'name':'capture','arguments':{'label':label}}}
 # Host-only stdin; credentials and capture capability are not part of participant tool schemas.
 with session.bridge.lock:
  session.bridge.proc.stdin.write(json.dumps(msg)+'\n');session.bridge.proc.stdin.flush();reply=json.loads(session.bridge.proc.stdout.readline())
 if reply.get('error'):raise RuntimeError('Browser final capture failed')
 return reply

def run(pair_id):
 node('check-launch');attempt=ROOT/'pilot-attempt.json'
 with attempt.open('x')as f:json.dump({'pairId':pair_id,'startedAt':time.time()},f)
 spec=json.loads((ROOT/'suite/scenario.json').read_text());host.infrastructure();results=[]
 try:
  for condition in ['baseline','lookout']:
   out=ROOT/'runs'/condition;out.mkdir(mode=0o700);inputs=out/'live-inputs';inputs.mkdir();files=out/'output';files.mkdir()
   runtime.write(inputs/'targets.json',[{k:t[k]for k in ['id','kind','url','title','company']}for t in spec['targets']]);shutil.copyfile(ROOT/'candidate/resume.pdf',inputs/'resume.pdf')
   meta={'taskId':'JOB02','version':spec['version'],'episodeId':'JOB02-'+condition+'-'+uuid.uuid4().hex[:8],'pairId':pair_id,'condition':condition,'pilot':True,'synthetic':False,'startedAt':time.time(),'status':'running','stages':[],'interactions':[],'toolCalls':0,'prescribedInitiations':1 if condition=='lookout'else 2,'simulatedWaitingMinutes':0};session=None
   try:
    snapshot(out/'initial-state.json')
    for index,step in enumerate(spec['stages'],1):
     stage=dict(step,_index=index,_session=step['session'],seconds=spec['stageBudgetSeconds']);sd=out/f'stage-{index}';sd.mkdir();(sd/'browser').mkdir();shutil.copytree(inputs,sd/'inputs')
     if index==2:
      node('respond','--condition',condition,'--run',out);meta['simulatedWaitingMinutes']=spec['wakeDelayMinutes']+spec['userResponseDelayMinutes']
     cfg={'targets':spec['targets'],'resume':str(ROOT/'candidate/resume.pdf'),'output':str(sd/'browser'),'profile':str(out/'browser-profile'),'executablePath':json.loads((ROOT/'runtime.private.json').read_text()).get('browserExecutable'),'synthetic':False}
     (out/'browser-config.private.json').write_text(json.dumps(cfg));runtime.write(out/'active-stage.json',{'stage':index});session=runtime.Session(sd,inputs,files,condition,str(step['session']))
     result=session.turn(sd,stage,False);meta['stages'].append({'id':step['id'],'index':index,**result});runtime.write(out/'run.json',meta)
     if (sd/'browser/form-drift.json').exists():
      meta['sourceDrift']=True;raise RuntimeError('Frozen form drift: pair stopped before another condition')
     capture(session,'final');session.close();session=None
     snapshot(sd/'after-state.json');shutil.copytree(files,sd/'output')
     runtime.write(out/'run.json',meta)
     if result['status']!='completed':meta['status']=result['status'];break
    else:meta['status']='completed'
   except Exception as error:
    if any(out.glob('stage-*/browser/form-drift.json')):meta['sourceDrift']=True
    meta.update(status='harness_failed',errorType=type(error).__name__,error=str(error)[:300])
   finally:
    if session:session.close()
    for sd in sorted(out.glob('stage-*')):
     trace=sd/'lookout-trace.jsonl'
     if trace.exists():
      for line in trace.read_text().splitlines():
       event=json.loads(line)
       if event['type']=='user.interaction':meta['interactions'].append(event['data'])
       if event['type']=='mcp.request'and event['data'].get('method')=='tools/call'and '_hostOnly'not in event['data']:meta['toolCalls']+=1
    receipt=out/'human-response-receipt.json'
    if receipt.exists():
     for record in json.loads(receipt.read_text()).get('records',[]):
      if not any(x.get('targetId')==record['targetId'] for x in meta['interactions']):meta['interactions'].append({'turnId':'card:'+record['sourceKey'],'targetId':record['targetId'],'category':'card_response','evidence':'human-response-receipt.json'})
    meta['cost']=runtime.cost.persist(out,ROOT/'cost-policy.json');meta['endedAt']=time.time();runtime.write(out/'run.json',meta)
   results.append({'condition':condition,'status':meta['status']})
   if meta.get('sourceDrift'):
    runtime.write(ROOT/'pair-stop.json',{'reason':'frozen_form_drift','condition':condition,'attempts':results,'unexecutedConditions':[c for c in ['baseline','lookout'] if c not in [r['condition'] for r in results]]});break
 finally:host.close_infrastructure()
 if not (ROOT/'pair-stop.json').exists():node('handoff');node('confirm')
 print(json.dumps({'attempts':results,'grading':'fresh final grader assignment required'}))

if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--root',type=Path,required=True);p.add_argument('--pair-id',required=True);a=p.parse_args();configure(a.root);run(a.pair_id)
