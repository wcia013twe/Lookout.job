import json,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
import clock_control
class ClockControlTests(unittest.TestCase):
 def test_restore_rejects_any_participant_attempt_before_backend_access(self):
  for name in ['runs','host-runs']:
   with tempfile.TemporaryDirectory() as tmp:
    root=Path(tmp);(root/name).mkdir()
    with patch.object(clock_control.backend,'inspect') as inspect:
     with self.assertRaises(ValueError):clock_control.restore_preflight(root,root,'2026-11-09T14:00:00Z')
     inspect.assert_not_called()
 def test_restore_rejects_other_pilot_binding(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);(root/'pilot-binding.json').write_text(json.dumps({'pilotRoot':str(root/'other')}))
   with patch.object(clock_control.backend,'inspect',return_value=(root,{})),patch.object(clock_control,'observe') as observe:
    with self.assertRaises(ValueError):clock_control.restore_preflight(root,root/'new','2026-11-09T14:00:00Z')
    observe.assert_not_called();self.assertFalse((root/'clock-state.json').exists())
 def test_observation_rejects_sql_javascript_mismatch(self):
  with patch.object(clock_control.backend,'inspect',return_value=(Path('/fictional'),{'services':{'api':{'name':'owned-test'}}})),patch.object(clock_control.database,'sql',return_value='{"now":"2026-11-09T14:00:00Z"}'),patch.object(clock_control.database,'call') as call:
   call.return_value.stdout='{"status":405,"now":"2026-11-10T14:00:00Z"}'
   with self.assertRaises(ValueError):clock_control.observe('/fictional')
 def test_move_rejects_stale_native_date(self):
  with patch.object(clock_control.database,'advance'),patch.object(clock_control,'observe',return_value={'javascriptNow':'2026-11-10T14:00:00Z'}):
   with self.assertRaises(ValueError):clock_control.move('/fictional','2026-11-09T14:00:00Z')
if __name__=='__main__':unittest.main()
