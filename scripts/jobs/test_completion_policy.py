"""Healthy turns may outlast the old limit; operation and containment checks remain."""
import io,json,runpy,sys,tempfile,unittest
from pathlib import Path
from unittest.mock import MagicMock,patch
_original_path=sys.path[:]
sys.path.insert(0,str(Path(__file__).parent))
try:import host
finally:sys.path[:]=_original_path
class CompletionPolicyTests(unittest.TestCase):
 def test_long_healthy_turn_completes_without_a_kill_timer(self):
  runtime=host.runtime
  for code,valid,expected in [(0,True,'completed'),(1,True,'execution_failed'),(0,False,'artifact_failed')]:
   with self.subTest(code=code,valid=valid),tempfile.TemporaryDirectory() as td:
    session=runtime.Session.__new__(runtime.Session);session.name='owned-fixture';session.condition='baseline';session.bridge=None;session.thread_id=None;session.auth={'tokens':{}}
    proc=MagicMock();proc.stdout=[];proc.poll.return_value=code;proc.wait.return_value=code
    clock=MagicMock();clock.startWall=100;clock.finish.return_value={'wallSeconds':901,'monotonicSeconds':901,'valid':valid,'invalidReasons':[] if valid else ['host_heartbeat_gap']}
    stage=Path(td)/'stage-1';stage.mkdir()
    with patch.object(runtime,'inputs_prompt',create=True,return_value='fixture'),patch.object(runtime.subprocess,'Popen',return_value=proc),patch.object(runtime.threading,'Timer') as timer,patch.object(runtime,'stop_container_client') as stop,patch.object(runtime.cost,'capture',return_value={'error':'fixture'}),patch.object(runtime,'StageClock',return_value=clock):
     result=session.turn(stage,{'_index':1,'_session':1,'seconds':300,'allowHealthyCompletion':True})
    timer.assert_not_called();stop.assert_not_called();self.assertEqual(result['status'],expected)
    self.assertTrue(result['referenceBudgetExceeded']);self.assertTrue(result['timing']['wallBudgetExceeded']);self.assertEqual(result['environmentTimingConfounded'],not valid)
    self.assertEqual(result['executionSeconds'],901 if valid else None)
 def test_http_wrapper_removes_only_the_participant_deadline(self):
  class Input:
   def __init__(self,value):self.buffer=io.BytesIO(json.dumps(value).encode())
  with tempfile.TemporaryDirectory() as td:
   root=Path(td);(root/'host.private.json').write_text(json.dumps({'url':'http://127.0.0.1:1','key':'fictional'}))
   for message,want in [({'operation':'participant.turn','budgetSeconds':None},None),({'operation':'participant.turn','budgetSeconds':300},350),({'operation':'snapshot'},350)]:
    response=MagicMock();response.__enter__.return_value.read.return_value=b'{}'
    with patch.object(sys,'argv',['client.py',str(root)]),patch.object(sys,'stdin',Input(message)),patch.object(sys,'stdout',io.StringIO()),patch('urllib.request.urlopen',return_value=response) as call:
     runpy.run_path(str(Path(host.__file__).with_name('client.py')),run_name='__main__')
    self.assertEqual(call.call_args.kwargs['timeout'],want)
if __name__=='__main__':unittest.main()
