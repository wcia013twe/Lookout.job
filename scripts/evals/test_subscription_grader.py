import importlib.util,json,subprocess,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('subscription_grader',Path(__file__).with_name('subscription_grader.py'));g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
class GraderBoundary(unittest.TestCase):
 def test_no_substitution_or_context_tools(self):
  c=g.cli_command('fictional');self.assertEqual(c[c.index('--model')+1],'gpt-5.6-terra');self.assertIn('model_reasoning_effort="medium"',c)
  self.assertIn('--ignore-user-config',c);self.assertIn('--ignore-rules',c);self.assertNotIn('resume',c);self.assertFalse(any('mcp_servers' in x for x in c))
 def test_evidence_rejects_credentials_and_symlinks(self):
  with tempfile.TemporaryDirectory() as td:
   r=Path(td);(r/'grader.private.json').write_text('{}')
   with self.assertRaises(ValueError):g.manifest(r)
   (r/'grader.private.json').unlink();(r/'link').symlink_to('/tmp')
   with self.assertRaises(ValueError):g.manifest(r)
 def fake_execution(self,observed,elapsed=1):
  with tempfile.TemporaryDirectory() as td:
   r=Path(td);e=r/'evidence';e.mkdir();(e/'state.json').write_text('{}');instructions=r/'instructions.md';instructions.write_text('Apply frozen rubric.')
   home=r/'home';(home/'.codex').mkdir(parents=True);(home/'.codex/auth.json').write_text('{"tokens":{"access_token":"fictional"}}');out=r/'grade'
   def run(cmd,**kwargs):
    text='sha256:fictional' if cmd[1:3]==['image','inspect'] else 'Logged in using ChatGPT' if 'status' in cmd else '[{"Destination":"/evidence","RW":false}]' if cmd[1]=='inspect' else ''
    return subprocess.CompletedProcess(cmd,0,stdout=text,stderr='')
   class Proc:
    returncode=0
    def __init__(self,*args,**kwargs):(out/'output/review.json').write_text('{"quality":{}}')
    def communicate(self,*args,**kwargs):
     if 'timeout' in kwargs:raise AssertionError('Healthy grading must not have a task deadline')
     return ('{"type":"thread.started","thread_id":"fictional-thread"}\n{"type":"turn.completed"}\n',None)
    def poll(self):return 0
   class Clock:
    def finish(self):return {'valid':True,'monotonicSeconds':elapsed,'wallSeconds':elapsed,'invalidReasons':[]}
   args=['grader','--evidence',str(e),'--instructions',str(instructions),'--output',str(out),'--seconds','30','--expected-image-id','sha256:fictional']
   with patch.object(g.sys,'argv',args),patch.object(g.Path,'home',return_value=home),patch.object(g.subprocess,'run',side_effect=run),patch.object(g.subprocess,'Popen',Proc),patch.object(g,'ensure_awake',return_value={}),patch.object(g,'StageClock',Clock),patch.object(g.cost,'capture',return_value={'models':[observed]}):
    result=g.main()
   meta=json.loads((out/'grader-run.json').read_text());self.assertTrue(meta['evidenceUnchanged']);self.assertTrue(meta['containerRemoved']);return result,meta
 def test_correct_model_accepts_separate_json_output(self):
  code,m=self.fake_execution('gpt-5.6-terra');self.assertEqual(code,0);self.assertEqual(m['status'],'completed');self.assertTrue(m['evidenceReadOnly']);self.assertFalse(m['accountWriterTools'])
 def test_healthy_grader_can_complete_after_reference_duration(self):
  code,m=self.fake_execution('gpt-5.6-terra',elapsed=120)
  self.assertEqual(code,0);self.assertEqual(m['status'],'completed');self.assertEqual(m['budgetPolicy'],'reference_only');self.assertIsNone(m['hardDeadlineSeconds']);self.assertTrue(m['referenceBudgetExceeded'])
 def test_wrong_observed_model_is_not_accepted(self):
  code,m=self.fake_execution('gpt-6.1-terra');self.assertEqual(code,1);self.assertEqual(m['status'],'invalid_model_provenance')
if __name__=='__main__':unittest.main()
