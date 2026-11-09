import ast,json,tempfile,unittest,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(Path(__file__).parent))
from diagnostics import call_metrics

def functions(folder,names,env):
 tree=ast.parse((ROOT/'scripts'/folder/'bridge.py').read_text())
 exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in names],type_ignores=[]),'bridge-functions','exec'),env)
 return env
class Controlled(unittest.TestCase):
 def test_native_list_does_not_discover(self):
  from types import SimpleNamespace
  for folder in ['n01','com2']:
   calls=[]
   def upstream(msg):
    calls.append(msg)
    return {'result':{'tools':[{'name':'discover_tools','inputSchema':{}},{'name':'out_of_scope','inputSchema':{}}]}}
   env=functions(folder,['clean','visible_tools'],{'a':SimpleNamespace(condition='lookout'),'allowed':{'discover_tools'},'config':{},'json':json,'upstream':upstream,'LOCAL_TOOLS':[{'name':'read_inbox'}]})
   reply=env['visible_tools'](1)
   self.assertEqual([x['method'] for x in calls],['tools/list'])
   self.assertEqual([x['name'] for x in reply['result']['tools']],['discover_tools','read_inbox'])
 def test_equal_intent_and_no_scheduled_credit(self):
  for folder in ['n01','com2']:
   spec=json.loads((ROOT/'examples'/folder/'scenario.json').read_text())
   self.assertTrue(spec['policy']['identicalTaskRequests'])
   text=(ROOT/'scripts'/folder/'runner.py').read_text()
   self.assertNotIn("if condition=='baseline':return prefix+stage['baseline']",text)
   self.assertNotIn('Scheduled networking check',text)
   self.assertNotIn('Scheduled application communication check',text)
   self.assertIn("'assignedInitiation':stage['kind']=='external'",text)
 def test_event_order_and_fixture_contract(self):
  from datetime import datetime,timedelta
  spec=json.loads((ROOT/'examples/n01/scenario.json').read_text());origin=datetime.fromisoformat(spec['policy']['clockOrigin'].replace('Z','+00:00'))
  for stage_index,event_index in [(2,0),(4,1)]:
   meeting=datetime.fromisoformat(spec['stages'][1]['calendar'][event_index]['time'].replace('Z','+00:00'))
   self.assertGreater(origin+timedelta(minutes=spec['stages'][stage_index]['minute']),meeting)
  fixture=json.loads((ROOT/'examples/com2/fixture.json').read_text())
  for c in fixture['contacts']:self.assertNotIn('draft',c['record']);self.assertIn('message',c['record'])
  text=(ROOT/'scripts/com2/prepare.py').read_text();self.assertIn("'read_toolkit_context'",text);self.assertIn("'read_application_timeline'",text)
 def test_measurements_are_additive_not_extra_calls(self):
  with tempfile.TemporaryDirectory() as td:
   p=Path(td)
   (p/'lookout-trace.jsonl').write_text('\n'.join(json.dumps({'type':'mcp.measurement','data':d}) for d in [dict(method='initialize',tool=None,durationSeconds=.2,responseBytes=100),dict(method='tools/call',tool='read_guide',durationSeconds=.3,responseBytes=400)]))
   m=call_metrics([p]);self.assertEqual(m['mcp_startup_response_bytes'],100);self.assertEqual(m['mcp_discovery_seconds'],.3);self.assertEqual(m['tool_discovery_calls'],0)
if __name__=='__main__':unittest.main()
