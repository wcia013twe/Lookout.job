"""Run one COM1 pair, preserve every attempt, then grade/export terminal trajectories."""
import argparse,json,subprocess,sys
from pathlib import Path
import runner,grade,summary
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"communication"))
from design import condition_order,serial_pair,outcome_groups
p=argparse.ArgumentParser();p.add_argument('--task-dir',type=Path,required=True);p.add_argument('--pair-id',required=True);p.add_argument('--repeat',type=int,default=1);p.add_argument('--pilot',action='store_true');p.add_argument('--langfuse-env',type=Path,required=True);p.add_argument('--receipt-dir',type=Path,required=True);a=p.parse_args()
if a.repeat<1 or not a.pair_id.strip():p.error('Positive repeat and nonempty pair ID required')
runner.configure(a.task_dir);results=[];failed=False
outcome_groups(json.loads((runner.S/'scenario.json').read_text()))
with serial_pair():
 for condition in condition_order(a.repeat):
  before=set(runner.RUNS.glob('*/run.json'))
  try:run=runner.run(condition,a.repeat,a.pair_id,a.pilot)
  except Exception as e:
   failed=True;print(json.dumps({'condition':condition,'executionError':type(e).__name__}),file=sys.stderr)
   new=set(runner.RUNS.glob('*/run.json'))-before
   if len(new)!=1:continue
   run=next(iter(new)).parent
  results.append(run)
# No grading, intervention or hints while either participant is running.
for run in results:
 try:
  spec=json.loads((runner.S/'scenario.json').read_text());result=grade.grade(run,spec)
  target=run/'grade.pending.json';target.write_text(json.dumps(result,indent=2)+'\n');target.chmod(0o600)
  template=run/'review-template.json';template.write_text(json.dumps(grade.template(run,spec),indent=2)+'\n');template.chmod(0o600)
  common=summary.build(run,spec,result,a.pair_id)
  summary_path=run/'eval-summary.pending.json';summary_path.write_text(json.dumps(common,indent=2)+'\n');summary_path.chmod(0o600)
  if json.loads((run/'run.json').read_text())['status']!='completed' or result['metrics'].get('timing_valid')!=1:failed=True
  export=subprocess.run(['node','--env-file='+str(a.langfuse_env.resolve()),str(Path(__file__).with_name('langfuse.mjs')),'--run',str(run),'--grade',str(target),'--scenario',str(runner.S/'scenario.json'),'--receipt-dir',str(a.receipt_dir.resolve())],timeout=300)
  if export.returncode:failed=True;print(json.dumps({'run':run.name,'reportingFailed':True,'participantRetry':False}),file=sys.stderr)
 except Exception as e:
  failed=True
  (run/'grading-invalid.json').write_text(json.dumps({'status':'invalid_evidence','errorType':type(e).__name__,'detail':str(e),'scored':False},indent=2)+'\n')
  print(json.dumps({'run':run.name,'postprocessError':type(e).__name__}),file=sys.stderr)
sys.exit(1 if failed else 0)
