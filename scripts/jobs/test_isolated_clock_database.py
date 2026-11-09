import json,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
from types import SimpleNamespace
import isolated_clock_database as clock
class ClockFixtureTests(unittest.TestCase):
 def fixture(self,tmp,**changes):
  root=Path(tmp).resolve();m={'kind':'isolated-job-clock-database-v1','root':str(root),'container':'job-clock-db-fixture','containerId':'immutable-id','clockMode':'process_local_ticking_offset'};m.update(changes);(root/'database.json').write_text(json.dumps(m))
  info={'Id':'immutable-id','Config':{'Labels':{clock.LABEL:str(root)}},'HostConfig':{'NetworkMode':'none','PortBindings':{}},'State':{'Running':True}}
  return root,m,info
 def test_wrong_root_refused_before_docker(self):
  with tempfile.TemporaryDirectory() as tmp:
   root,_,_=self.fixture(tmp,root='/unowned')
   with patch.object(clock,'call') as call:
    with self.assertRaises(ValueError):clock.load(root)
    call.assert_not_called()
 def test_unowned_or_exposed_container_refused(self):
  for mutation in ['owner','identity','network','port']:
   with tempfile.TemporaryDirectory() as tmp:
    root,m,info=self.fixture(tmp)
    if mutation=='owner':info['Config']['Labels']={}
    elif mutation=='identity':info['Id']='different'
    elif mutation=='network':info['HostConfig']['NetworkMode']='host'
    else:info['HostConfig']['PortBindings']={'5432/tcp':[{}]}
    with patch.object(clock,'call',return_value=SimpleNamespace(stdout=json.dumps([info]))):
     with self.assertRaises(ValueError):clock.load(root)
 def test_clock_rewind_preserves_state(self):
  with tempfile.TemporaryDirectory() as tmp:
   root,m,info=self.fixture(tmp);(root/'clock').mkdir();p=root/'clock/time.rc';p.write_text('+123.000000\n');(root/'clock-state.json').write_text(json.dumps({'lastBusinessTarget':'2026-11-18T14:00:00+00:00'}))
   with patch.object(clock,'load',return_value=(root,m,info)),patch.object(clock,'sql') as sql:
    with self.assertRaises(ValueError):clock.advance(root,'2026-11-17T14:00:00Z')
    sql.assert_not_called();self.assertEqual(p.read_text(),'+123.000000\n')
 def test_offset_update_requires_native_readback(self):
  with tempfile.TemporaryDirectory() as tmp:
   root,m,info=self.fixture(tmp);(root/'clock').mkdir();(root/'clock/time.rc').write_text('+0\n');(root/'clock-state.json').write_text(json.dumps({'lastBusinessTarget':'2026-11-16T14:00:00+00:00'}))
   with patch.object(clock,'load',return_value=(root,m,info)),patch.object(clock.time,'time',return_value=1794837600),patch.object(clock,'sql',return_value=json.dumps({'now':'2026-11-18T14:00:00.2+00:00'})):
    value=clock.advance(root,'2026-11-18T14:00:00Z');self.assertIn('now',value);self.assertTrue(list(root.glob('clock-receipt-*.json')));self.assertTrue((root/'clock/time.rc').read_text().startswith('+'))
 def test_prepare_never_reuses_existing_root(self):
  with tempfile.TemporaryDirectory() as tmp,patch.object(clock,'call') as call:
   with self.assertRaises(ValueError):clock.prepare(tmp)
   call.assert_not_called()
if __name__=='__main__':unittest.main()
