"""Import a previously captured public operator board; this script does not scrape websites."""
from pathlib import Path
import argparse, datetime, gzip, hashlib, json, os, re

root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--input',type=Path,required=True,help='Previously captured r6tv Salt Lake City Major HTML')
parser.add_argument('--captured-at',required=True,help='Actual capture timestamp, ISO 8601 with timezone')
args=parser.parse_args()
captured=datetime.datetime.fromisoformat(args.captured_at.replace('Z','+00:00'))
if captured.tzinfo is None: parser.error('captured-at requires a timezone')
raw=args.input.read_bytes();html=raw.decode('utf-8')
found=re.search(r'<script[^>]*id="opsData"[^>]*>(.*?)</script>',html,re.S)
if not found or 'Salt Lake City Major' not in html:raise SystemExit('Expected captured event board not found')
operator_data=json.loads(found.group(1));key='standalone/salt-lake-city-major'
if not all(k in operator_data for k in ['ops','sides','opsTeam','sidesTeam']):raise SystemExit('Source board schema changed')
extract=json.dumps(operator_data,ensure_ascii=False,separators=(',',':')).encode()
sha=hashlib.sha256(extract).hexdigest();source_dir=root/'data/operator_sources';source_dir.mkdir(exist_ok=True)
(source_dir/(sha+'.json.gz')).write_bytes(gzip.compress(extract,mtime=0))
rows=[]
for team_name,op_board,side_board in [(None,operator_data['ops'],operator_data['sides'])]+[(name,board,operator_data['sidesTeam'].get(name,{})) for name,board in operator_data['opsTeam'].items()]:
    for compound,events in op_board.items():
        if key not in events:continue
        name,side=compound.rsplit('|',1);counts=events[key]
        side_rounds=side_board.get(side,{}).get(key)
        if side not in ['Attack','Defense'] or len(counts)!=2 or any(type(n) is not int or n<0 for n in counts):raise SystemExit('Invalid operator source counts')
        picks,wins=counts
        if wins>picks or side_rounds is None or picks>side_rounds:raise SystemExit('Invalid operator denominator')
        rows.append({'competitionId':502,'team':team_name,'operator':name,'side':side,'picks':picks,'wins':wins,'sideRounds':side_rounds})
source={'provider':'r6tv','official':False,'url':'https://r6tv.online/event/salt-lake-city-major',
        'descriptionUrl':'https://r6tv.online/how-it-works','capturedAt':captured.astimezone(datetime.timezone.utc).isoformat(),
        'htmlSha256':hashlib.sha256(raw).hexdigest(),'sha256':sha,'file':'operator_sources/'+sha+'.json.gz',
        'extraction':'Exact opsData aggregate board embedded in a previously captured public event page.',
        'updatePolicy':'Static research snapshot. No automated requests to r6tv. Main Ubisoft results continue updating independently.'}
data={'schemaVersion':1,'competitionId':502,'event':'Salt Lake City Major 2026','eventStart':'2026-05-08','eventEnd':'2026-05-17',
      'source':source,'scope':'Only replay-derived operator observations represented by the r6tv board for this event; not all Ubisoft rounds or other events.',
      'unit':'One recorded operator selection in one round; wins are rounds won by that operator’s side, not series wins.',
      'sideRounds':{side:operator_data['sides'][side][key] for side in ['Attack','Defense']},'rows':rows}
data['dataSha256']=hashlib.sha256(json.dumps(rows,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()
temporary=root/'data/operators.json.tmp';temporary.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8');os.replace(temporary,root/'data/operators.json')
print(json.dumps({'rows':len(rows),'operators':len([r for r in rows if r['team'] is None]),'source':source['url'],'sideRounds':data['sideRounds'],'capturedAt':source['capturedAt']},ensure_ascii=False))
