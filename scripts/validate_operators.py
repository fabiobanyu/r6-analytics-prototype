"""Verify operator statistics against the saved source board, including team/side denominators."""
from pathlib import Path
import gzip,hashlib,json
root=Path(__file__).resolve().parents[1]
d=json.loads((root/'data/operators.json').read_text(encoding='utf-8'));source=d['source']
if d['competitionId']!=502 or source['official'] is not False or source['url']!='https://r6tv.online/event/salt-lake-city-major':raise SystemExit('Operator source/event attribution mismatch')
raw=gzip.decompress((root/'data'/source['file']).read_bytes())
if hashlib.sha256(raw).hexdigest()!=source['sha256']:raise SystemExit('Operator source checksum mismatch')
board=json.loads(raw);key='standalone/salt-lake-city-major';seen=set();expected_count=0
for team,ops in [(None,board['ops'])]+list(board['opsTeam'].items()):
    expected_count+=sum(key in values for values in ops.values())
for row in d['rows']:
    if row['competitionId']!=d['competitionId']:raise SystemExit('Operator cohort event mismatch')
    team=row['team'];identity=(team,row['operator'],row['side'])
    if identity in seen:raise SystemExit('Duplicate operator cohort')
    seen.add(identity)
    ops=board['ops'] if team is None else board['opsTeam'][team]
    sides=board['sides'] if team is None else board['sidesTeam'][team]
    values=ops[row['operator']+'|'+row['side']][key]
    if values!=[row['picks'],row['wins']] or row['sideRounds']!=sides[row['side']][key]:raise SystemExit('Operator values differ from captured source')
    if not 0<=row['wins']<=row['picks']<=row['sideRounds']:raise SystemExit('Invalid operator counts')
if expected_count!=len(d['rows']):raise SystemExit('Source cohort coverage mismatch')
for side in ['Attack','Defense']:
    rows=[r for r in d['rows'] if r['team'] is None and r['side']==side]
    if sum(r['picks'] for r in rows)!=5*d['sideRounds'][side]:raise SystemExit('Incomplete five-operator selection totals')
    for row in rows:
        teams=[r for r in d['rows'] if r['team'] is not None and r['operator']==row['operator'] and r['side']==side]
        if sum(r['picks'] for r in teams)!=row['picks'] or sum(r['wins'] for r in teams)!=row['wins']:raise SystemExit('Team aggregates differ from overall source board')
digest=hashlib.sha256(json.dumps(d['rows'],ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()
if digest!=d['dataSha256']:raise SystemExit('Operator dataset digest mismatch')
print(json.dumps({'ok':True,'rows':len(d['rows']),'source':source['url'],'sideRounds':d['sideRounds'],'staticSnapshot':True},ensure_ascii=False))
