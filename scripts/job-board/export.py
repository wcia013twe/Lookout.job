#!/usr/bin/env python3
"""Verify a frozen board and export only participant-visible static files."""
import argparse
import hashlib
import html
import json
from pathlib import Path
import re
import shutil

CSS = '''body{margin:0;background:#fff;color:#1f2328;font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{max-width:1180px;margin:auto;padding:40px 24px}h1{font-size:30px;line-height:1.25;margin:0 0 20px}h2{font-size:22px;margin-top:32px}p{max-width:75ch}a{color:#0969da;text-underline-offset:3px}a:hover{text-decoration-thickness:2px}a:focus-visible{outline:3px solid #0969da;outline-offset:3px}.table-wrap{overflow-x:auto;border:1px solid #d1d9e0;border-radius:6px}table{border-collapse:collapse;width:100%;font-size:14px}th,td{text-align:left;padding:10px 14px;border-bottom:1px solid #d1d9e0;vertical-align:top}th{background:#f6f8fa}tr:nth-child(even){background:#f6f8fa}tr:last-child td{border-bottom:0}th:first-child{min-width:150px}th:nth-child(2){min-width:230px}.meta{color:#59636e;font-size:14px}.description{white-space:pre-wrap;max-width:75ch}code{overflow-wrap:anywhere}::selection{background:#b6e3ff}@media(max-width:600px){main{padding:24px 16px}h1{font-size:26px}}'''

def sha(data): return hashlib.sha256(data).hexdigest()
def e(value): return html.escape(str(value or ''), quote=True)
def page(title, content):
    return f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{e(title)}</title><style>{CSS}</style></head><body><main>{content}</main></body></html>\n'

def verify(root):
    manifest = json.loads((root / 'manifest.json').read_text())
    if manifest.get('schemaVersion') != 1: raise ValueError('Unsupported schema')
    for name, expected in manifest['files'].items():
        target = (root / name).resolve()
        if not target.is_relative_to(root.resolve()): raise ValueError('Unsafe manifest path')
        if sha(target.read_bytes()) != expected: raise ValueError(f'Hash mismatch: {name}')
    jobs = json.loads((root / 'jobs.json').read_text())
    if len(jobs) != manifest['jobCount']: raise ValueError('Count mismatch')
    ids = [j['id'] for j in jobs]
    if len(ids) != len(set(ids)): raise ValueError('Duplicate IDs')
    if any(not re.fullmatch(r'jr-[A-Za-z0-9_-]+', ident) for ident in ids): raise ValueError('Unsafe ID')
    for j in jobs:
        if j.get('evidencePath'):
            if j['evidencePath'] not in manifest['files']: raise ValueError('Unhashed evidence')
            evidence = json.loads((root / j['evidencePath']).read_text())
            if evidence.get('descriptionText') != j.get('description'): raise ValueError('Description mismatch')
    return manifest, jobs

def export(root, destination, ids=None):
    manifest, jobs = verify(root)
    if destination.exists(): raise ValueError('Export destination exists; use a fresh directory')
    if ids is not None:
        known = {j['id'] for j in jobs}
        if not ids or not set(ids) <= known: raise ValueError('Empty or unknown subset')
        jobs = [j for j in jobs if j['id'] in set(ids)]
    destination.mkdir(parents=True)
    (destination / 'jobs').mkdir()
    title = 'Frozen new-grad software engineering jobs'
    intro = f'<h1>{title}</h1><p>Fixed research copy of the Jobright new-grad board. Listings and captured descriptions reflect the snapshot, not current availability.</p><p class="meta">Snapshot <code>{e(manifest["snapshotId"])}</code><br>Captured {e(manifest["capturedAt"])} · {len(jobs)} listings</p>'
    rows = []
    for j in jobs:
        rows.append(f'<tr><td>{e(j["company"])}</td><td><a href="jobs/{e(j["id"])}.html">{e(j["title"])}</a></td><td>{e(j["location"])}</td><td>{e(j["workModel"])}</td><td>{e(j["sourcePostedLabel"])}</td></tr>')
        description = j.get('description')
        detail = f'<p><a href="../index.html">Back to jobs</a></p><h1>{e(j["title"])}</h1><p>{e(j["company"])} · {e(j["location"])} · {e(j["workModel"])}</p><p class="meta">Job ID: <code>{e(j["id"])}</code><br>Source date label: {e(j["sourcePostedLabel"])} (year not inferred)<br>Evidence: {e(j["evidenceStatus"])}</p>'
        detail += '<h2>Captured job information</h2><div class="description">' + e(description or 'No job description was captured. This listing alone does not establish qualifications, eligibility, or availability.') + '</div>'
        detail += f'<p class="meta">Jobright source evidence; employer availability has not been verified.</p><p><a href="{e(j["listingUrl"])}" rel="noreferrer">Original Jobright listing (live; may change)</a></p>'
        (destination / 'jobs' / (j['id'] + '.html')).write_text(page(j['title'], detail))
    table = '<div class="table-wrap" tabindex="0" role="region" aria-label="Frozen job listings"><table><thead><tr>' + ''.join(f'<th scope="col">{name}</th>' for name in ['Company', 'Job Title', 'Location', 'Work Model', 'Date Posted']) + '</tr></thead><tbody>' + ''.join(rows) + '</tbody></table></div>'
    footer = f'<p><a href="jobs.json">Download listings JSON</a> · <a href="manifest.json">Snapshot provenance</a></p><p class="meta">Source: <a href="https://github.com/{e(manifest["source"]["repository"])}/blob/{e(manifest["source"]["commit"])}/README.md">Jobright new-grad board at frozen commit</a>. No candidate profiles, grading labels, or participant results are included.</p>'
    (destination / 'index.html').write_text(page(title, intro + table + footer))
    job_bytes = (json.dumps(jobs, ensure_ascii=False, indent=2) + '\n').encode()
    (destination / 'jobs.json').write_bytes(job_bytes)
    # Subset manifests never carry future IDs, full-board hashes or full-board files.
    public_manifest = {k: manifest[k] for k in ['schemaVersion', 'snapshotId', 'capturedAt', 'source', 'employerVerification']}
    public_manifest.update(jobCount=len(jobs), sourceManifestSha256=sha((root / 'manifest.json').read_bytes()),
                           files={'jobs.json': sha(job_bytes)}, subset=ids is not None)
    (destination / 'manifest.json').write_text(json.dumps(public_manifest, indent=2) + '\n')
    (destination / '.nojekyll').touch()
    print(json.dumps({'exported': len(jobs), 'destination': str(destination)}))

if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--snapshot', required=True, type=Path)
    p.add_argument('--output', type=Path)
    p.add_argument('--ids', type=Path, help='JSON array of stage-visible IDs; no future jobs exported')
    args = p.parse_args()
    if args.output: export(args.snapshot, args.output, json.loads(args.ids.read_text()) if args.ids else None)
    else:
        m, j = verify(args.snapshot); print(json.dumps({'verified': m['snapshotId'], 'jobs': len(j)}))
