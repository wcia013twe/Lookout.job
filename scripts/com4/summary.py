"""Adapt a locally revalidated COM4 grade to the shared eval_v1 result contract."""
import argparse,json
from pathlib import Path
import grade

def build(run,spec,result,campaign):
 run=Path(run);m=json.loads((run/'run.json').read_text())
 grade.grade(run,spec) # Validate terminal identity and telemetry without supplying semantic judgments.
 if result.get('evidenceDigest')!=grade.evidence_digest(run) or result.get('scenarioDigest')!=grade.scenario_digest(spec) or result.get('episodeId')!=m['episodeId'] or result.get('graderVersion')!=grade.GRADER_VERSION:raise ValueError('Grade/evidence binding mismatch')
 reviewed=result['status']=='graded'
 if result['status'] not in ['graded','pending_review']:raise ValueError('Unknown grade state')
 if reviewed and (not result.get('reviewer') or any(type(v) is not bool for v in result['quality'].values())):raise ValueError('Independent final review required')
 # Count observable tool invocations once. The MCP transport logs are not added again.
 steps=0
 for sd in run.glob('stage-*'):
  if not (sd/'stage-run.json').exists():continue
  for row in grade.rows(sd/'trace.jsonl'):
   e=row.get('event',{})
   if e.get('type')=='item.completed' and e.get('item',{}).get('type') in ['command_execution','mcp_tool_call','web_search']:steps+=1
 return dict(schemaVersion=1,campaignId=campaign,suiteId='communication',suiteVersion='1',scenarioId='COM4',scenarioVersion=spec['version'],condition=m['condition'],repeat=m['repeat'],episodeId=m['episodeId'],model=m['model'],reasoning=m['reasoning'],harnessVersion='COM4-harness-v1',graderVersion=grade.GRADER_VERSION,evidenceDigest=result['evidenceDigest'],startedAt=m['startedAt'],endedAt=m['startedAt']+m['durationSeconds'],status=m['status'],pilot=m.get('pilot') is True,synthetic=m.get('synthetic') is True,evaluation=dict(reviewed=reviewed,taskSuccess=bool(result['metrics']['quality_pass']) if reviewed else None,quality=result['metrics'].get('quality_fraction') if reviewed else None,activeSeconds=result['metrics']['execution_seconds'],toolCalls=steps,wakesUsed=sum(v for k,v in result['metrics'].items() if k.startswith('stage_') and k.endswith('_reached'))))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--run',type=Path,required=True);p.add_argument('--scenario',type=Path,required=True);p.add_argument('--grade',type=Path,required=True);p.add_argument('--campaign',required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
 if a.output.exists():p.error('Preserve previous summary; use a new output')
 result=build(a.run,json.loads(a.scenario.read_text()),json.loads(a.grade.read_text()),a.campaign)
 a.output.write_text(json.dumps(result,indent=2)+'\n');a.output.chmod(0o600)
 print(json.dumps({'saved':str(a.output),'reviewed':result['evaluation']['reviewed']}))
