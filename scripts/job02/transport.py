"""Case arguments for the shared benchmark transport."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"evals"))
from workspace_transport import WorkspaceBridge

class Bridge(WorkspaceBridge):
 def __init__(self,run,root,condition):
  super().__init__([sys.executable,str(Path(__file__).with_name("bridge.py")),"--root",str(root),"--capture",str(run/"lookout-trace.jsonl"),"--condition",condition,'--run',str(run.parent)],graceful_close=True)
