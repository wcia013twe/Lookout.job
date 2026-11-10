"""Recovery accounting boundaries; no model, account writes or networking."""
import importlib.util,tempfile,unittest
from pathlib import Path
s=importlib.util.spec_from_file_location('recovery',Path(__file__).with_name('recover.py'));r=importlib.util.module_from_spec(s);s.loader.exec_module(r)
class RecoveryTests(unittest.TestCase):
 def test_killed_usage_stays_unknown_while_observed_usage_is_retained(self):
  prior={'coverage':{'attemptedStages':1,'coveredStages':0},'tokens':None,'observedTokens':None}
  current={'coverage':{'attemptedStages':4,'coveredStages':4},'tokens':{'input_tokens':20},'observedTokens':{'input_tokens':20},'limitations':[]}
  result=r.recovery_cost(current,prior)
  self.assertEqual(result['coverage'],{'status':'partial','attemptedStages':5,'coveredStages':4})
  self.assertIsNone(result['tokens']);self.assertIsNone(result['estimatedTotalUsd']);self.assertEqual(result['observedTokens']['input_tokens'],20)
  self.assertNotIn('recoverySegments',current);self.assertEqual(len(result['recoverySegments']),2)
 def test_changed_retained_owner_state_is_not_accepted(self):
  before={'tables':{'jobs':[{'id':'owned'}]}}
  self.assertTrue(r.same_state(before,{'tables':{'jobs':[{'id':'owned'}]},'capturedAt':'later'}))
  self.assertFalse(r.same_state(before,{'tables':{'jobs':[]}}))
 def test_parent_freeze_binding_rejects_changed_artifacts(self):
  from unittest.mock import Mock
  import json,hashlib
  with tempfile.TemporaryDirectory() as td:
   base=Path(td);parent=base/'original';(parent/'runs').mkdir(parents=True)
   for condition,status in [('baseline','completed'),('lookout','timed_out')]:
    run=parent/'runs'/condition;run.mkdir();(run/'run.json').write_text(json.dumps({'condition':condition,'status':status,'checkpoints':[{'stage':'initial_search'}]}));(run/'saved.txt').write_text('changed');(run/'evidence-hashes.json').write_text(json.dumps({'saved.txt':hashlib.sha256(b'original').hexdigest()}))
   destination=base/'recovery';host=Mock()
   with self.assertRaisesRegex(RuntimeError,'artifact drift'):r.prepare(host,parent,destination)
   self.assertFalse(destination.exists())
if __name__=='__main__':unittest.main()
