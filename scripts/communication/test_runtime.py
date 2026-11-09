import json,subprocess,tempfile,unittest,sys
from pathlib import Path
from runtime import StageClock,snapshot_with_receipt,clean_error,stop_container_client
class RuntimeTests(unittest.TestCase):
 def test_docker_timeout_unblocks_host_without_claiming_container_stopped(self):
  proc=subprocess.Popen([sys.executable,'-c','import time; time.sleep(60)'],stdout=subprocess.PIPE,text=True)
  def fail(*args,**kwargs):raise subprocess.TimeoutExpired('docker',10)
  try:
   receipt=stop_container_client(proc,'fictional-test-container',fail)
   self.assertFalse(receipt['containerStopped']);self.assertTrue(receipt['hostClientStopped'])
   self.assertEqual(proc.stdout.read(),'');self.assertIn('TimeoutExpired',receipt['errors'])
  finally:
   if proc.poll() is None:proc.kill();proc.wait()
   proc.stdout.close()
 def test_successful_container_stop_recorded_separately(self):
  proc=subprocess.Popen([sys.executable,'-c','import time; time.sleep(60)'])
  try:
   receipt=stop_container_client(proc,'fictional-test-container',lambda *a,**k:subprocess.CompletedProcess(a,0))
   self.assertTrue(receipt['containerStopped']);self.assertTrue(receipt['hostClientStopped'])
  finally:
   if proc.poll() is None:proc.kill();proc.wait()
 def test_normal_clock(self):
  state=[10.,20.];clock=StageClock(lambda:state[0],lambda:state[1],heartbeat=False)
  for _ in range(5):state[0]+=1;state[1]+=1;clock.sample()
  result=clock.finish();self.assertTrue(result['valid']);self.assertEqual(result['monotonicSeconds'],5)
 def test_suspend_or_clock_change_invalidates(self):
  state=[10.,20.];clock=StageClock(lambda:state[0],lambda:state[1],heartbeat=False)
  state[0]+=100;state[1]+=1
  result=clock.finish();self.assertFalse(result['valid']);self.assertIn('wall_monotonic_divergence',result['invalidReasons'])
 def test_scheduler_pause_invalidates_even_equal_clocks(self):
  state=[10.,20.];clock=StageClock(lambda:state[0],lambda:state[1],heartbeat=False)
  state[0]+=30;state[1]+=30;self.assertFalse(clock.finish()['valid'])
 def test_capture_transient_read_retry_receipted(self):
  with tempfile.TemporaryDirectory() as td:
   target=Path(td)/'state.json';calls=[]
   def execute(*args,**kwargs):
    calls.append(1)
    if len(calls)==1:raise subprocess.CalledProcessError(1,['fake'],stderr='Cannot connect to Docker daemon')
    target.write_text('{"tables":{}}')
   snapshot_with_receipt(['fake'],target,execute)
   receipt=json.loads(target.with_name('state.json.capture.json').read_text())
   self.assertTrue(receipt['captured']);self.assertEqual(len(receipt['attempts']),2);self.assertFalse(receipt['participantRetry'])
 def test_capture_schema_error_not_retried(self):
  with tempfile.TemporaryDirectory() as td:
   target=Path(td)/'state.json';calls=[]
   def execute(*args,**kwargs):calls.append(1);raise subprocess.CalledProcessError(1,['fake'],stderr='ERROR: owner mismatch')
   with self.assertRaises(RuntimeError):snapshot_with_receipt(['fake'],target,execute)
   self.assertEqual(len(calls),1)
 def test_error_redaction(self):
  error=subprocess.CalledProcessError(1,['fake'],stderr='ERROR: Bearer jb_agent_secret\nDETAIL: private data\nSTATEMENT: select secret')
  result=clean_error(error);self.assertNotIn('jb_agent_secret',result);self.assertNotIn('private data',result);self.assertNotIn('select secret',result)
if __name__=='__main__':unittest.main()
