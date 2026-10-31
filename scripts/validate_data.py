"""Validate normalized records against downloaded official source extracts, not invented fixtures."""
from pathlib import Path
import argparse, datetime, gzip, hashlib, json

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--snapshot', type=Path, default=root / 'data/snapshot.json')
parser.add_argument('--quiet', action='store_true')
args = parser.parse_args()
d = json.loads(args.snapshot.read_text(encoding='utf-8'))
errors, notes, originals, team_originals = [], [], {}, {}
source_routes = set()
for source in d['sources']:
    route = source['route']; source_routes.add(route)
    try:
        raw = gzip.decompress((root / 'data' / source['file']).read_bytes())
        if hashlib.sha256(raw).hexdigest() != source['sha256']: errors.append('Source SHA mismatch: ' + route)
        if source['httpStatus'] != 200: errors.append('Source HTTP not 200: ' + route)
        if source['url'] != d['meta']['sourceBase'] + route: errors.append('Unexpected source URL: ' + route)
        payload = json.loads(raw); page = payload['pageData']
        for t in page.get('teams', []) or []:
            if isinstance(t, dict) and t.get('id'): team_originals[(route, t['id'])] = t
        stack = [page]
        while stack:
            obj = stack.pop()
            if isinstance(obj, dict):
                if all(k in obj for k in ('id','status','matchFormatNumberOfGames','teams','date','games')):
                    originals[(route,obj['id'])] = obj
                else: stack.extend(obj.values())
            elif isinstance(obj,list): stack.extend(obj)
    except Exception as exc: errors.append('Cannot verify source ' + route + ': ' + type(exc).__name__)

for key, team in d['teams'].items():
    raw = team_originals.get((team['source'],team['id']))
    if not raw or raw['name'] != team['name']: errors.append('Team not traceable: ' + key)

match_ids = set()
original_games, original_rounds, original_players, original_bans = {}, {}, {}, {}
for m in d['matches']:
    mid = m['id']; route = m['source']
    if mid in match_ids: errors.append('Duplicate match: ' + str(mid))
    match_ids.add(mid)
    raw = originals.get((route,mid))
    if raw is None:
        errors.append('Match not found in cited source: ' + str(mid)); continue
    ts = raw.get('teams') or []
    if len(ts) != 2 or [t['id'] for t in ts] != [m['teamA'],m['teamB']]: errors.append('Team IDs mismatch: ' + str(mid))
    if m['teamA'] == m['teamB'] or any(str(m[t]) not in d['teams'] for t in ['teamA','teamB']): errors.append('Invalid team master: ' + str(mid))
    if raw['date'] != m['date'] or raw['status'] != m['status'] or (raw['status']==3) != m['completed']: errors.append('Date/status mismatch: ' + str(mid))
    parsed_date = datetime.datetime.fromisoformat(m['date'].replace('Z','+00:00'))
    if m['completed'] and parsed_date > datetime.datetime.fromisoformat(d['meta']['generatedAt'].replace('Z','+00:00')):
        errors.append('Future match labeled completed: ' + str(mid))
    winners = [t['id'] for t in ts if t.get('result')==1]
    expected_winner = winners[0] if m['completed'] and len(winners)==1 else None
    if expected_winner != m['winnerId']: errors.append('Winner label differs from official source: ' + str(mid))
    if not m['completed'] and any(m[k] is not None for k in ['scoreA','scoreB','winnerId']): errors.append('Upcoming outcome populated: ' + str(mid))
    if m['completed']:
        if [m['scoreA'],m['scoreB']] != [ts[0].get('score'),ts[1].get('score')]: errors.append('Series score differs from source: ' + str(mid))
        if m['forfeit']: notes.append({'matchId':mid,'note':'Official forfeit; preserve source scores/result; excluded from Elo'})
        elif m['winnerId'] is not None:
            winner_by_score = m['teamA'] if m['scoreA']>m['scoreB'] else m['teamB'] if m['scoreB']>m['scoreA'] else None
            if winner_by_score != m['winnerId']: errors.append('Non-forfeit score/winner mismatch: ' + str(mid))
    expected_ids = [g['id'] for g in raw.get('games') or [] if g.get('status')==3 and len(g.get('teams') or [])==2]
    if m['gameIds'] != expected_ids: errors.append('Played-map coverage differs from source: ' + str(mid))
    for g in raw.get('games') or []:
        if g['id'] not in expected_ids: continue
        original_games[(route,g['id'])] = g
        if m['detailed']:
            for rd in g.get('rounds') or []: original_rounds[(route,rd['id'])] = rd
            for gt in g.get('teams') or []:
                for p in gt.get('players') or []: original_players[(route,g['id'],gt['id'],p['id'])] = p
                for b in gt.get('operatorBans') or []: original_bans[(route,g['id'],gt['id'],b['id'],b.get('roundIndex'))] = b

games_by_id = {}
for g in d['games']:
    raw = original_games.get((g['source'],g['id']))
    if g['id'] in games_by_id: errors.append('Duplicate game ID')
    games_by_id[g['id']] = g
    if not raw: errors.append('Game not in source: ' + str(g['id'])); continue
    if g['matchId'] not in match_ids: errors.append('Orphan game')
    expected = [(raw.get('map') or {}).get('id'),(raw.get('map') or {}).get('name'),raw['teams'][0]['id'],raw['teams'][1]['id'],raw['teams'][0].get('score'),raw['teams'][1].get('score')]
    if [g[k] for k in ['mapId','map','teamA','teamB','scoreA','scoreB']] != expected: errors.append('Game values differ from source: ' + str(g['id']))

seen_rounds = set()
for r in d['rounds']:
    raw = original_rounds.get((r['source'],r['id']))
    if r['id'] in seen_rounds: errors.append('Duplicate round ID')
    seen_rounds.add(r['id'])
    if not raw: errors.append('Round not in source'); continue
    if [r[k] for k in ['index','winnerId','attackerId','defenderId','overtime','winMethodCode']] != [raw.get(k) for k in ['index','winnerId','attackerId','defenderId','isOvertime','winMethod']]: errors.append('Round values differ from source')
    game = games_by_id.get(r['gameId'])
    if not game or r['winnerId'] not in [game['teamA'],game['teamB']] or {r['attackerId'],r['defenderId']} != {game['teamA'],game['teamB']}: errors.append('Round team references invalid')

seen_players = set()
for p in d['players']:
    key = (p['source'],p['gameId'],p['teamId'],p['playerId'])
    if key in seen_players: errors.append('Duplicate player-game-team row')
    seen_players.add(key); raw = original_players.get(key)
    if not raw: errors.append('Player row not in source'); continue
    stats = raw.get('stats') or {}
    expected = [raw.get('name'),(stats.get('kills') or {}).get('count'),(stats.get('deaths') or {}).get('count'),stats.get('kost'),stats.get('eps'),(stats.get('roundsStats') or {}).get('roundsPlayed')]
    if [p[k] for k in ['name','kills','deaths','kost','eps','roundsPlayed']] != expected: errors.append('Player values differ from source')
    if p['kost'] is not None and not 0 <= p['kost'] <= 1: errors.append('KOST outside [0,1]')
    if any(p[k] is not None and (not isinstance(p[k],int) or p[k]<0) for k in ['kills','deaths','roundsPlayed']): errors.append('Invalid player count')

seen_bans = set()
for b in d['bans']:
    key = (b['source'],b['gameId'],b['teamId'],b['operatorId'],b['roundIndex'])
    if key in seen_bans: errors.append('Duplicate ban row')
    seen_bans.add(key); raw = original_bans.get(key)
    if not raw or [b['operator'],b['attacker']] != [raw.get('name'),raw.get('isAttacker')]: errors.append('Ban values differ from source')
if len(d['games']) != len(original_games) or len(d['rounds']) != len(original_rounds) or len(d['players']) != len(original_players) or len(d['bans']) != len(original_bans): errors.append('Normalized row coverage differs from cited source')
digest = hashlib.sha256(json.dumps({k:d[k] for k in ('competitions','teams','matches','games','rounds','players','bans')},sort_keys=True,ensure_ascii=False).encode()).hexdigest()
if digest != d['meta']['dataSha256']: errors.append('Dataset content digest mismatch')
report = {'ok':not errors,'validatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'snapshotGeneratedAt':d['meta']['generatedAt'],
          'counts':{k:len(d[k]) for k in ['matches','games','rounds','players','bans','sources']},'errors':errors,'notes':notes,
          'missingMapNames':sum(g['map'] is None for g in d['games']),'excludedSourceSlots':len(d['meta']['warnings']),
          'meaning':'Every published normalized result/statistic checked against its downloaded official source extract; no synthetic data generation.'}
if not args.quiet:
    (root/'outputs').mkdir(exist_ok=True)
    (root/'outputs/validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False,indent=2))
elif errors: print(json.dumps({'validationErrors':errors},ensure_ascii=False))
raise SystemExit(0 if report['ok'] else 1)
