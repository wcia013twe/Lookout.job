import sys
from pathlib import Path
from grade import evidence_digest
print(evidence_digest(Path(sys.argv[1])))
