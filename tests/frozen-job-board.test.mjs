import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('frozen board provenance, parsing and subset isolation', () => {
 const result = spawnSync('python3', ['-c', String.raw`
import importlib.util,json,tempfile
from pathlib import Path

def module(name,file):
 s=importlib.util.spec_from_file_location(name,file); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); return m
f=module('freeze','scripts/job-board/freeze.py'); x=module('export','scripts/job-board/export.py')
s='| Company | Job Title | Location | Work Model | Date Posted |\n| --- | --- | --- | --- | --- |\n| **[Acme](https://acme.test)** | **[[Junior] Engineer](https://jobright.ai/jobs/info/abc?utm_source=x)** | NY | Remote | Nov 09 |\n| ↳ | **[Other](https://jobright.ai/jobs/info/def)** | NY | Hybrid | Nov 09 |'
j=f.parse_table(s)
assert j[0]['title']=='[Junior] Engineer' and j[1]['company']=='Acme'
assert j[0]['postedDate'] is None and j[0]['listingUrl'].endswith('/abc')
try: f.parse_table(s+'\n'+s.splitlines()[-1]); raise AssertionError('duplicate accepted')
except ValueError: pass
root=Path('fixtures/job-board/jobright-swe-2026-9763907b1b91'); m,j=x.verify(root)
assert len(j)==794 and m['detailCount']==30
assert x.e('<script>')=='&lt;script&gt;'
with tempfile.TemporaryDirectory() as temp:
 out=Path(temp)/'site'; x.export(root,out,[j[0]['id']])
 subset=json.loads((out/'jobs.json').read_text()); assert len(subset)==1
 assert not (out/'source.md').exists() and not (out/'evidence').exists()
 assert j[1]['id'] not in (out/'index.html').read_text()
 assert len(list((out/'jobs').glob('*.html')))==1
 try: x.export(root,out); raise AssertionError('overwrite accepted')
 except ValueError: pass
 tamper=Path(temp)/'tamper'; tamper.mkdir()
 (tamper/'manifest.json').write_text(json.dumps({'schemaVersion':1,'files':{'jobs.json':'wrong'},'jobCount':0}))
 (tamper/'jobs.json').write_text('[]')
 try: x.verify(tamper); raise AssertionError('tampering accepted')
 except ValueError: pass
`], {encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
});
