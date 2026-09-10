"""R24 唯讀核對：磁碟雜湊、引文、來源臺帳與交付範圍。"""
from pathlib import Path
import hashlib
import json
import re
from urllib.parse import unquote, urlsplit
from datetime import datetime, timezone

site = Path(__file__).resolve().parents[3]
repo = next(p for p in site.parents if (p / 'raw_scripture').is_dir())
qa = site / 'docs/qa/revamp'
def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
def data(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

asset_data = data(site / 'src/data/assets.json')
assets = asset_data['assets']
checks = []
for a in assets:
    paths = {k: site / a[k] for k in ('sourceFile', 'processedFile', 'runtimeFile')}
    hashes = {k: sha(p) for k, p in paths.items()}
    dist = site / 'dist' / Path(a['runtimeFile']).relative_to('public')
    checks.append({'id': a['id'], 'url': a['url'], 'hashes': hashes,
      'distHash': sha(dist), 'sourceMatchesDeclaration': hashes['sourceFile'] == a['sha256'].lower(),
      'processedPublicDistMatch': len({hashes['processedFile'], hashes['runtimeFile'], sha(dist)}) == 1,
      'declaredDerivedHash': a.get('derivedHash'),
      'derivedMatchesDeclaration': a.get('derivedHash', '').lower() == hashes['processedFile']})
source_rows = []
for line in (site / 'docs/research/SOURCES.md').read_text(encoding='utf-8').splitlines():
    if not line.startswith('| S-') or 'raw_scripture/' not in line:
        continue
    path_match = re.search(r'`([^`]*raw_scripture/[^`]+)`', line)
    hash_match = re.search(r'`([0-9A-Fa-f]{64})`', line)
    if path_match and hash_match:
        raw = path_match.group(1)
        path = Path(raw) if Path(raw).is_absolute() else repo / raw
        actual = sha(path)
        source_rows.append({'id':line.split('|')[1].strip(),'path':raw,
          'declared':hash_match.group(1).lower(),'actual':actual,
          'matches':actual == hash_match.group(1).lower()})
original = data(site / 'src/data/scripture-excerpts.json')
regenerated = data(qa / 'r24-excerpts.json')
original.pop('generatedAt', None)
regenerated.pop('generatedAt', None)
dist_files = [{'path':str(p.relative_to(site/'dist')).replace('\\','/'),'bytes':p.stat().st_size,'sha256':sha(p)} for p in sorted((site/'dist').rglob('*')) if p.is_file()]
forbidden = [d['path'] for d in dist_files if re.search(r'(^|/)(raw_data|raw_scripture|source|addition_info)(/|$)|\.blend[0-9]?$', d['path'])]
rituals = data(site/'src/data/rituals.json')['rituals']
evidence = data(site/'src/data/evidence.json')
part_rows = []
for obj in data(site/'src/data/object-details.json')['objects']:
    mapping = next((m for m in data(site/'src/data/asset-parts.json')['mappings'] if m['objectId'] == obj['id']), {})
    for part in obj['parts']:
        match = next((p for p in mapping.get('parts', []) if p['partId'] == part['id']), None)
        part_rows.append({'objectId':obj['id'],'partId':part['id'],'mappingStatus':match['status'] if match else 'missing'})
http_rows = []
for line in (qa/'r24-http-responses.jsonl').read_text(encoding='utf-8').splitlines():
    response = json.loads(line)
    path = unquote(urlsplit(response['url']).path)
    if response['status'] == 200 and '/models/' in path:
        rel = path[path.index('/models/')+1:]
        expected = sha(site/'dist'/rel)
        http_rows.append({**response,'distPath':rel,'distHash':expected,'responseMatchesDist':response['sha256']==expected})
report = {'generatedAt':datetime.now(timezone.utc).isoformat(), 'basis':'685da044',
  'assets': checks, 'assetCount':len(checks),
  'allSourceDeclarationsMatch':all(x['sourceMatchesDeclaration'] for x in checks),
  'allProcessedPublicDistMatch':all(x['processedPublicDistMatch'] for x in checks),
  'allDerivedDeclarationsMatch':all(x['derivedMatchesDeclaration'] for x in checks),
  'sourceLedger':source_rows,'sourceLedgerMismatchCount':sum(not x['matches'] for x in source_rows),
  'excerptsSameIgnoringGeneratedAt':original==regenerated,'excerptCount':len(original['excerpts']),
  'dist':{'files':dist_files,'forbidden':forbidden},
  'ritualInventory':[{'id':r['id'],'name':r['name'],'steps':len(r['steps'])} for r in rituals],
  'runtimeArchaeologySources':[s for s in evidence['sources'] if s['sourceType'] not in ('scripture','engineering')],
  'visiblePartMappings':part_rows,
  'httpSuccessfulModels':http_rows,
  'allSuccessfulModelResponsesMatchDist':all(r['responseMatchesDist'] for r in http_rows),
  'partStatusCounts': {s:sum(p['status']==s for m in data(site/'src/data/asset-parts.json')['mappings'] for p in m['parts']) for s in ['verified','unresolved']}}
(qa/'r24-static-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:report[k] for k in ['assetCount','allSourceDeclarationsMatch','allProcessedPublicDistMatch','allDerivedDeclarationsMatch','sourceLedgerMismatchCount','excerptsSameIgnoringGeneratedAt','excerptCount','partStatusCounts']},ensure_ascii=False))
assert report['allSourceDeclarationsMatch'] and report['allProcessedPublicDistMatch'] and report['allDerivedDeclarationsMatch']
assert report['sourceLedgerMismatchCount'] == 0 and report['excerptsSameIgnoringGeneratedAt']
assert not forbidden and http_rows and report['allSuccessfulModelResponsesMatchDist']
