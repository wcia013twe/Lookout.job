"""Shared host timing and read-only capture reliability; never retries participants."""
import json,os,platform,re,shutil,subprocess,threading,time
from pathlib import Path
_awake=None

def ensure_awake():
 global _awake
 if platform.system()!='Darwin':return {'method':'not_required_by_host','platform':platform.system()}
 if _awake is None or _awake.poll() is not None:
  tool=shutil.which('caffeinate')
  if not tool:raise RuntimeError('Host awake guard unavailable')
  _awake=subprocess.Popen([tool,'-i','-s','-w',str(os.getpid())],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 return {'method':'caffeinate-idle-system','pid':_awake.pid,'limitations':'Does not override lid closure or forced sleep'}

class StageClock:
 def __init__(self,wall=time.time,mono=time.monotonic,heartbeat=True):
  self.wall=wall;self.mono=mono;self.startWall=wall();self.startMono=mono();self.last=(self.startWall,self.startMono);self.maxGap=0.;self.stop=threading.Event();self.thread=None;self.result=None
  if heartbeat:
   self.thread=threading.Thread(target=self._watch,daemon=True);self.thread.start()
 def sample(self):
  w,m=self.wall(),self.mono();self.maxGap=max(self.maxGap,w-self.last[0],m-self.last[1]);self.last=(w,m)
 def _watch(self):
  while not self.stop.wait(1):self.sample()
 def finish(self):
  if self.result is not None:return self.result
  self.stop.set()
  if self.thread:self.thread.join(timeout=2)
  self.sample();wall=self.last[0]-self.startWall;mono=self.last[1]-self.startMono
  reasons=[]
  if abs(wall-mono)>2:reasons.append('wall_monotonic_divergence')
  if self.maxGap>10:reasons.append('host_heartbeat_gap')
  self.result={'version':1,'wallSeconds':wall,'monotonicSeconds':mono,'maxHeartbeatGapSeconds':self.maxGap,'valid':not reasons,'invalidReasons':reasons}
  return self.result

def clean_error(error):
 raw=getattr(error,'stderr',None) or str(error)
 if isinstance(raw,bytes):raw=raw.decode(errors='replace')
 raw=re.sub(r'jb_agent_[A-Za-z0-9_-]+','[REDACTED]',raw)
 raw=re.sub(r'(?i)(bearer|password|token|secret)([=: ]+)[^\s,;]+',r'\1\2[REDACTED]',raw)
 # Retain diagnostic text, not SQL/data statements emitted by a failing database client.
 lines=[x for x in raw.splitlines() if not re.search(r'(?i)^\s*(DETAIL:|CONTEXT:|STATEMENT:|LINE \d+:|select |insert |update |delete )',x)]
 return '\n'.join(lines)[:3000]

def snapshot_with_receipt(command,target,execute=subprocess.run):
 target=Path(target);receipt=target.with_name(target.name+'.capture.json');attempts=[]
 for attempt in range(1,3):
  started=time.time()
  try:
   execute(command,check=True,capture_output=True,text=True,timeout=90)
   value=json.loads(target.read_text())
   if not isinstance(value,dict) or not isinstance(value.get('tables'),dict):raise ValueError('Snapshot structure incomplete')
   attempts.append({'attempt':attempt,'ok':True,'elapsedSeconds':time.time()-started})
   receipt.write_text(json.dumps({'readOnly':True,'participantRetry':False,'attempts':attempts,'captured':True},indent=2)+'\n');receipt.chmod(0o600)
   return
  except (subprocess.SubprocessError,OSError,ValueError) as error:
   attempts.append({'attempt':attempt,'ok':False,'elapsedSeconds':time.time()-started,'errorType':type(error).__name__,'detail':clean_error(error)})
   receipt.write_text(json.dumps({'readOnly':True,'participantRetry':False,'attempts':attempts,'captured':False},indent=2)+'\n');receipt.chmod(0o600)
   # Retry only transient transport/process failures, not invalid or foreign snapshot content.
   transient=isinstance(error,subprocess.TimeoutExpired) or bool(re.search(r'(?i)connection|connect to.*docker|daemon|timed? out|timeout|server closed|unexpected EOF|temporar|input/output|broken pipe',clean_error(error)))
   if not transient or attempt==2:raise RuntimeError('State capture failed; see '+receipt.name) from error
