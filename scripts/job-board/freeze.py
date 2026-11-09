#!/usr/bin/env python3
"""Freeze a public Jobright GitHub table; no account, scoring or product writes."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import html
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import urllib.request
from urllib.parse import urlsplit, urlunsplit

REPOSITORY = 'jobright-ai/2026-Software-Engineer-New-Grad'
SCHEMA = 1

def digest(data):
    return hashlib.sha256(data).hexdigest()

def dump(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode()

def now():
    return datetime.now(timezone.utc).isoformat()

def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Lookout-frozen-board/1.0'})
    with urllib.request.urlopen(req, timeout=30) as response:
        return response.read()

def clean_url(value):
    p = urlsplit(html.unescape(value))
    if p.scheme not in ('http', 'https') or not p.netloc:
        return None
    return urlunsplit((p.scheme, p.netloc, p.path, '', ''))

def link(cell):
    m = re.search(r'\[(.+)\]\(([^)]+)\)', cell)
    return (html.unescape(m[1]), clean_url(m[2])) if m else (cell.strip('* '), None)

def parse_table(source):
    jobs, seen = [], set()
    company, company_url = None, None
    in_table = False
    for number, line in enumerate(source.splitlines(), 1):
        if line.startswith('| Company | Job Title |'):
            in_table = True
            continue
        if not in_table or not line.startswith('|'):
            continue
        cells = [v.strip() for v in re.split(r'(?<!\\)\|', line.strip())[1:-1]]
        if all(re.fullmatch(r'[-: ]+', c) for c in cells):
            continue
        if len(cells) != 5:
            raise ValueError(f'Unexpected table row at line {number}')
        if cells[0] != '↳':
            company, company_url = link(cells[0])
        if not company:
            raise ValueError(f'Missing inherited company at line {number}')
        title, listing_url = link(cells[1])
        if not listing_url or not re.fullmatch(r'https://jobright\.ai/jobs/info/[A-Za-z0-9_-]+', listing_url):
            raise ValueError(f'Unexpected job link at line {number}')
        ident = 'jr-' + listing_url.rsplit('/', 1)[1]
        if ident in seen:
            raise ValueError(f'Duplicate source job ID {ident}')
        seen.add(ident)
        jobs.append(dict(id=ident, company=company, companyUrl=company_url, title=title,
                         location=html.unescape(cells[2]), workModel=cells[3],
                         sourcePostedLabel=cells[4], postedDate=None, listingUrl=listing_url,
                         sourceRow=number, description=None, evidenceStatus='listing_only'))
    if not jobs:
        raise ValueError('No listing rows parsed; refusing empty snapshot')
    return jobs

class Text(HTMLParser):
    def __init__(self):
        super().__init__(); self.parts = []
    def handle_data(self, data):
        self.parts.append(data)

def plain(value):
    parser = Text(); parser.feed(value)
    return '\n'.join(p.strip() for p in parser.parts if p.strip())

def detail(job):
    stamp = now()
    try:
        body = fetch(job['listingUrl'])
        source = body.decode('utf-8')
        match = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', source, re.S)
        result = json.loads(match[1])['props']['pageProps']['dataSource']['jobResult'] if match else None
        if not result or 'jr-' + result.get('jobId', '') != job['id']:
            raise ValueError('Missing or mismatched source job ID')
        ld = re.search(r'<script[^>]+type="application/ld\+json"[^>]*>(.*?)</script>', source, re.S)
        posting = json.loads(ld[1]) if ld else {}
        if not posting.get('description'):
            raise ValueError('Source did not expose a description')
        # Save only public job evidence, not tracking, scores or page/user metadata.
        keys = ('jobId', 'jobTitle', 'jobLocation', 'workModel', 'publishTime', 'employmentType',
                'salaryDesc', 'jobSummary', 'minYearsOfExperience', 'coreResponsibilities',
                'educationSummaries', 'skillSummaries', 'isDeleted', 'qualifications',
                'detailQualifications', 'isWorkAuthRequired', 'isCitizenOnly', 'isClearanceRequired')
        evidence = {'sourceUrl': job['listingUrl'], 'capturedAt': stamp,
                    'responseSha256': digest(body), 'provenance': 'Jobright; employer availability not verified',
                    'job': {k: result[k] for k in keys if k in result},
                    'descriptionText': plain(posting['description']), 'sourceDatePosted': posting.get('datePosted')}
        return job['id'], evidence, None
    except Exception as error:
        return job['id'], None, {'capturedAt': stamp, 'error': str(error), 'retryCount': 0}

def markdown(jobs, manifest):
    def esc(value): return str(value or '').replace('|', '\\|').replace('\n', ' ')
    lines = ['# Frozen new-grad software engineering jobs', '',
             f"Snapshot: `{manifest['snapshotId']}` · captured {manifest['capturedAt']}", '',
             f"Source: [{REPOSITORY}]({manifest['source']['url']}). Frozen research copy; not a current availability claim.", '',
             '| Company | Job Title | Location | Work Model | Date Posted |',
             '| --- | --- | --- | --- | --- |']
    for j in jobs:
        lines.append(f"| {esc(j['company'])} | [{esc(j['title'])}](jobs/{j['id']}.html) | {esc(j['location'])} | {esc(j['workModel'])} | {esc(j['sourcePostedLabel'])} |")
    return ('\n'.join(lines) + '\n').encode()

def freeze(args):
    if not re.fullmatch('[0-9a-f]{40}', args.commit):
        raise ValueError('Use a complete immutable Git commit SHA')
    root = Path(args.output)
    if root.exists():
        raise ValueError('Snapshot destination already exists; never overwrite a freeze')
    source_url = f'https://raw.githubusercontent.com/{REPOSITORY}/{args.commit}/README.md'
    raw = Path(args.source).read_bytes() if args.source else fetch(source_url)
    jobs = parse_table(raw.decode())
    root.mkdir(parents=True)
    (root / 'source.md').write_bytes(raw)
    files = {'source.md': digest(raw)}
    manifest = {'schemaVersion': SCHEMA, 'snapshotId': 'jobright-swe-2026-' + args.commit[:12],
                'capturedAt': now(), 'source': {'repository': REPOSITORY, 'commit': args.commit,
                'path': 'README.md', 'url': source_url}, 'jobCount': len(jobs),
                'detailSelection': {'method': 'first_n_source_order', 'limit': args.details_limit},
                'employerVerification': 'not_performed', 'files': files}
    if args.details_limit:
        (root / 'evidence').mkdir()
        by_id = {j['id']: j for j in jobs}
        with ThreadPoolExecutor(max_workers=4) as pool:
            for ident, evidence, error in pool.map(detail, jobs[:args.details_limit]):
                j = by_id[ident]
                if error:
                    j['evidenceStatus'] = 'capture_failed'; j['captureFailure'] = error
                else:
                    path = f'evidence/{ident}.json'; data = dump(evidence)
                    (root / path).write_bytes(data); files[path] = digest(data)
                    j.update(description=evidence['descriptionText'], evidencePath=path,
                             evidenceStatus='jobright_detail_captured')
    for name, data in [('jobs.json', dump(jobs)), ('README.md', markdown(jobs, manifest))]:
        (root / name).write_bytes(data); files[name] = digest(data)
    manifest['detailCount'] = sum(j['evidenceStatus'] == 'jobright_detail_captured' for j in jobs)
    (root / 'manifest.json').write_bytes(dump(manifest))
    print(json.dumps({'snapshotId': manifest['snapshotId'], 'jobs': len(jobs), 'details': manifest['detailCount']}))

if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--commit', required=True)
    p.add_argument('--output', required=True)
    p.add_argument('--source', help='Already fetched README from the exact commit')
    p.add_argument('--details-limit', type=int, default=60)
    args = p.parse_args()
    if args.details_limit < 0: p.error('details-limit must be nonnegative')
    freeze(args)
