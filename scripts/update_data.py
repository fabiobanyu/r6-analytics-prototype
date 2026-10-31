"""Public Ubisoft results only. Procedural by project rule; Python standard library."""
from pathlib import Path
import argparse, concurrent.futures, datetime, gzip, hashlib, json, os, re, runpy, subprocess, sys, time, urllib.request

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--watch', action='store_true', help='Poll every six hours while this process runs')
parser.add_argument('--offline', action='store_true', help='Rebuild exclusively from previously downloaded cache')
parser.add_argument('--force', action='store_true', help='Refresh cached index pages immediately')
parser.add_argument('--detail-limit', type=int, default=80, help='Maximum new detailed match pages per cycle')
args = parser.parse_args()
if args.detail_limit < 0 or args.detail_limit > 500:
    parser.error('detail-limit must be between 0 and 500')
base = 'https://www.ubisoft.com/en-us/esports/rainbow-six/siege/'
data_dir = root / 'data'
(data_dir / 'raw').mkdir(parents=True, exist_ok=True)
cache_path = data_dir / 'cache_index.json'
cache = json.loads(cache_path.read_text(encoding='utf-8')) if cache_path.exists() else {}
lock_path = data_dir / '.update.lock'
# OS lock is released even after a crash; a second updater must not overwrite a cycle.
lock_file = lock_path.open('a+b')
try:
    if os.name == 'nt':
        import msvcrt
        lock_file.seek(0); lock_file.write(b'0'); lock_file.flush(); lock_file.seek(0)
        msvcrt.locking(lock_file.fileno(), msvcrt.LK_NBLCK, 1)
    else:
        import fcntl
        fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
except OSError:
    raise SystemExit('Another updater is already running. Close it before starting a second one.')

while True:
    now = datetime.datetime.now(datetime.timezone.utc)
    stamp = now.isoformat().replace('+00:00', 'Z')
    errors, pages, sources, competitions, teams, matches, notices = [], {}, {}, {}, {}, {}, []
    jobs = ['competition/502']  # Stable official seed; current season is discovered from its navigation.
    current_season = None
    try:
        for stage in range(4):
            jobs = sorted(set(jobs))
            print('Stage', stage, ':', len(jobs), 'official pages', flush=True)
            pending = []
            with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
                for route in jobs:
                    entry = cache.get(route)
                    ttl = 7 * 86400 if route.startswith('match/') else 6 * 3600
                    fresh = entry and (now.timestamp() - entry['retrievedUnix'] < ttl)
                    if entry and (args.offline or (fresh and not (args.force and not route.startswith('match/')))):
                        try:
                            payload = json.loads(gzip.decompress((data_dir / entry['file']).read_bytes()))
                            if hashlib.sha256(json.dumps(payload, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest() != entry['sha256']:
                                raise ValueError('cache digest mismatch')
                            pages[route] = payload; sources[route] = entry
                            continue
                        except Exception as exc:
                            notices.append({'route': route, 'error': 'cache ' + type(exc).__name__})
                    if args.offline:
                        errors.append({'route': route, 'error': 'not present in verified local cache'}); continue
                    request = urllib.request.Request(base + route, headers={'User-Agent': 'Mozilla/5.0 (R6AnalyticsPrototype; public results research; bounded polling)'})
                    pending.append((route, request, pool.submit(urllib.request.urlopen, request, timeout=35)))
                for route, request, future in pending:
                    response = None
                    for attempt in range(3):
                        try:
                            response = future.result() if attempt == 0 else urllib.request.urlopen(request, timeout=35)
                            raw = response.read(); http_status = response.status; response.close()
                            if http_status != 200: raise ValueError('unexpected HTTP status')
                            text = raw.decode('utf-8')
                            found = re.search(r'<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)</script>', text, re.S)
                            if not found: raise ValueError('official page schema changed: no NEXT_DATA')
                            props = json.loads(found.group(1))['props']['pageProps']
                            payload = {'pageData': props['pageData'], 'seasons': props.get('layoutData', {}).get('seasons', [])}
                            if not isinstance(payload['pageData'], dict) or not payload['pageData']:
                                raise ValueError('empty official pageData')
                            encoded = json.dumps(payload, ensure_ascii=False, separators=(',', ':')).encode()
                            digest = hashlib.sha256(encoded).hexdigest()
                            rel = 'raw/' + digest + '.json.gz'
                            (data_dir / rel).write_bytes(gzip.compress(encoded, mtime=0))
                            retrieved = datetime.datetime.now(datetime.timezone.utc)
                            entry = {'url': base + route, 'route': route, 'httpStatus': http_status,
                                     'retrievedAt': retrieved.isoformat().replace('+00:00', 'Z'), 'retrievedUnix': retrieved.timestamp(),
                                     'sha256': digest, 'htmlSha256': hashlib.sha256(raw).hexdigest(), 'file': rel,
                                     'extraction': 'pageProps.pageData and layoutData.seasons from public __NEXT_DATA__; UTF-8'}
                            pages[route] = payload; sources[route] = entry; cache[route] = entry
                            break
                        except Exception as exc:
                            if attempt == 2: errors.append({'route': route, 'error': type(exc).__name__ + ': ' + str(exc)[:180]})
                            else: time.sleep(2 ** attempt)
            if stage < 3 and errors:
                raise ValueError('Index/discovery failed; previous published snapshot retained')
            next_jobs = []
            for route in jobs:
                if route not in pages: continue
                payload = pages[route]; page = payload['pageData']
                for team in page.get('teams', []) or []:
                    if isinstance(team, dict) and team.get('id') and team.get('name'):
                        teams[str(team['id'])] = {'id': team['id'], 'name': team['name'], 'country': team.get('countryCode'), 'source': route}
                if stage == 0:
                    season_options = [s for s in payload['seasons'] if s.get('current')]
                    if len(season_options) != 1: raise ValueError('Cannot identify one current official season')
                    current_season = season_options[0]
                    for region in current_season['regions']:
                        next_jobs += ['championship/' + str(c['id']) + '/' + str(current_season['id']) for c in region.get('championships', [])]
                        next_jobs += ['competition/' + str(c['id']) for c in region.get('eventCompetitions', [])]
                    if (data_dir / 'snapshot.json').exists():
                        previous = json.loads((data_dir / 'snapshot.json').read_text(encoding='utf-8'))
                        if previous['meta']['season']['id'] == current_season['id']:
                            # Keep previously discovered stages discoverable as the default stage advances.
                            next_jobs += ['competition/' + str(cid) for cid in previous['competitions']]
                if stage == 1 and route.startswith('championship/'):
                    # The official default championship page covers its currently selected stage.
                    own = page['championship']['id']
                    candidates = [c for c in page['championship']['competitions'] if c.get('championshipId') == own and not c.get('isExternal')]
                    for comp in candidates:
                        next_jobs.append('competition/' + str(comp['id']))
                if stage in (1, 2) and page.get('competition'):
                    comp = page['competition']; cid = comp['id']
                    competitions[str(cid)] = {'id': cid, 'name': comp['name'], 'startDate': comp.get('startDate'),
                        'endDate': comp.get('endDate'), 'seasonYear': comp.get('season', {}).get('year'), 'source': 'competition/' + str(cid)}
                    if stage == 1:
                        next_jobs += ['competition/' + str(cid) + '/' + str(p['id']) for p in page.get('phases', []) if not p.get('externalLink')]
                    elif page.get('phases') and not page.get('phaseDetails'):
                        # Stage 2 also handles newly discovered regional competitions and their phases below.
                        next_jobs += ['competition/' + str(cid) + '/' + str(p['id']) for p in page['phases'] if not p.get('externalLink')]
                # Iterative tree walk: collect source match objects, never aggregate leaderboard rows as matches.
                stack = [page]
                while stack:
                    obj = stack.pop()
                    if isinstance(obj, dict):
                        if all(k in obj for k in ('id', 'status', 'matchFormatNumberOfGames', 'teams', 'date', 'games')):
                            mid = str(obj['id'])
                            record = dict(obj)
                            record['_source'] = route
                            record['_competitionId'] = (page.get('competition') or obj.get('competition') or {}).get('id')
                            if route.startswith('match/') or mid not in matches or len(record.get('games') or []) > len(matches[mid].get('games') or []):
                                matches[mid] = record
                        else:
                            stack.extend(obj.values())
                    elif isinstance(obj, list): stack.extend(obj)
            # Newly discovered regional phases need one extra pass before detailed-match downloads.
            if stage == 2 and next_jobs:
                for route in sorted(set(next_jobs)):
                    if route in pages: continue
                    entry = cache.get(route)
                    try:
                        fresh = entry and now.timestamp() - entry['retrievedUnix'] < 6 * 3600
                        if entry and (args.offline or (fresh and not args.force)):
                            encoded = gzip.decompress((data_dir / entry['file']).read_bytes())
                            if hashlib.sha256(encoded).hexdigest() != entry['sha256']: raise ValueError('cache digest mismatch')
                            payload = json.loads(encoded)
                        elif not args.offline:
                            request = urllib.request.Request(base + route, headers={'User-Agent': 'Mozilla/5.0 (R6AnalyticsPrototype; public results research)'})
                            for attempt in range(3):
                                try:
                                    with urllib.request.urlopen(request, timeout=35) as r:
                                        raw = r.read(); http_status = r.status
                                    found = re.search(r'<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)</script>', raw.decode('utf-8'), re.S)
                                    props = json.loads(found.group(1))['props']['pageProps']
                                    payload = {'pageData': props['pageData'], 'seasons': props.get('layoutData', {}).get('seasons', [])}
                                    encoded = json.dumps(payload, ensure_ascii=False, separators=(',', ':')).encode()
                                    digest = hashlib.sha256(encoded).hexdigest(); rel = 'raw/' + digest + '.json.gz'
                                    (data_dir / rel).write_bytes(gzip.compress(encoded, mtime=0))
                                    rt = datetime.datetime.now(datetime.timezone.utc)
                                    entry = {'url': base + route, 'route': route, 'httpStatus': http_status, 'retrievedAt': rt.isoformat().replace('+00:00', 'Z'),
                                        'retrievedUnix': rt.timestamp(), 'sha256': digest, 'htmlSha256': hashlib.sha256(raw).hexdigest(), 'file': rel,
                                        'extraction': 'pageProps.pageData and layoutData.seasons from public __NEXT_DATA__; UTF-8'}
                                    cache[route] = entry
                                    break
                                except Exception:
                                    if attempt == 2: raise
                                    time.sleep(2 ** attempt)
                        else: raise ValueError('phase not cached')
                        pages[route] = payload; sources[route] = entry; page = payload['pageData']
                        for team in page.get('teams', []) or []:
                            if isinstance(team, dict) and team.get('id') and team.get('name'):
                                teams[str(team['id'])] = {'id': team['id'], 'name': team['name'], 'country': team.get('countryCode'), 'source': route}
                        stack = [page]
                        while stack:
                            obj = stack.pop()
                            if isinstance(obj, dict):
                                if all(k in obj for k in ('id', 'status', 'matchFormatNumberOfGames', 'teams', 'date', 'games')):
                                    record = dict(obj); record['_source'] = route
                                    record['_competitionId'] = (page.get('competition') or obj.get('competition') or {}).get('id')
                                    matches.setdefault(str(obj['id']), record)
                                else: stack.extend(obj.values())
                            elif isinstance(obj, list): stack.extend(obj)
                    except Exception as exc: errors.append({'route': route, 'error': type(exc).__name__ + ': ' + str(exc)[:160]})
                if errors: raise ValueError('Regional phase download failed; previous snapshot retained')
            if stage == 2:
                # Prioritize recent completed series. All cached details remain in use, new downloads bounded.
                ordered = sorted(matches.values(), key=lambda m: (m.get('date') or '', m['id']), reverse=True)
                complete_ids = [m['id'] for m in ordered if m.get('status') == 3]
                known = ['match/' + str(mid) for mid in complete_ids if 'match/' + str(mid) in cache]
                new = ['match/' + str(mid) for mid in complete_ids if 'match/' + str(mid) not in cache][:args.detail_limit]
                next_jobs = known + ([] if args.offline else new)
            jobs = next_jobs

        normalized, game_rows, round_rows, player_rows, ban_rows, warnings = [], [], [], [], [], []
        for mid, match in sorted(matches.items(), key=lambda pair: (pair[1].get('date') or '', int(pair[0]))):
            ts = match.get('teams') or []
            if len(ts) != 2 or any(not t.get('id') for t in ts) or ts[0]['id'] == ts[1]['id']:
                warnings.append({'matchId': int(mid), 'reason': 'Unresolved/TBD teams; excluded'}); continue
            if not match.get('date'):
                warnings.append({'matchId': int(mid), 'reason': 'No scheduled timestamp; excluded'}); continue
            winners = [t['id'] for t in ts if t.get('result') == 1]
            finished = match.get('status') == 3
            winner = winners[0] if finished and len(winners) == 1 else None
            detailed = match['_source'].startswith('match/')
            record = {'id': int(mid), 'date': match['date'], 'status': match['status'], 'completed': finished,
                'competitionId': match['_competitionId'], 'phase': match.get('phaseName'), 'bestOf': match.get('matchFormatNumberOfGames'),
                'teamA': ts[0]['id'], 'teamB': ts[1]['id'], 'scoreA': ts[0].get('score') if finished else None,
                'scoreB': ts[1].get('score') if finished else None, 'winnerId': winner,
                'forfeit': bool(match.get('isWonByForfeit')), 'isTimeTBD': bool(match.get('isTimeTBD')),
                'detailed': detailed, 'source': match['_source'], 'gameIds': []}
            if finished and winner is None: warnings.append({'matchId': int(mid), 'reason': 'No unique source winner; excluded from Elo'})
            for game in match.get('games') or []:
                # Scheduled/cancelled 0:0 maps are not played games.
                if game.get('status') != 3: continue
                gts = game.get('teams') or []
                if len(gts) != 2: continue
                gid = game['id']; record['gameIds'].append(gid)
                mp = game.get('map') or {}
                game_rows.append({'id': gid, 'matchId': int(mid), 'mapId': mp.get('id'), 'map': mp.get('name'),
                    'teamA': gts[0]['id'], 'teamB': gts[1]['id'], 'scoreA': gts[0].get('score'), 'scoreB': gts[1].get('score'),
                    'winnerId': next((t['id'] for t in gts if t.get('result') == 1), None), 'source': match['_source']})
                if not detailed: continue
                for rd in game.get('rounds') or []:
                    round_rows.append({'id': rd['id'], 'gameId': gid, 'matchId': int(mid), 'index': rd.get('index'),
                        'winnerId': rd.get('winnerId'), 'attackerId': rd.get('attackerId'), 'defenderId': rd.get('defenderId'),
                        'overtime': rd.get('isOvertime'), 'winMethodCode': rd.get('winMethod'), 'source': match['_source']})
                for gt in gts:
                    for player in gt.get('players') or []:
                        stats = player.get('stats') or {}
                        player_rows.append({'gameId': gid, 'matchId': int(mid), 'teamId': gt['id'], 'playerId': player.get('id'),
                            'name': player.get('name'), 'kills': (stats.get('kills') or {}).get('count'),
                            'deaths': (stats.get('deaths') or {}).get('count'), 'kost': stats.get('kost'), 'eps': stats.get('eps'),
                            'roundsPlayed': (stats.get('roundsStats') or {}).get('roundsPlayed'), 'source': match['_source']})
                    for ban in gt.get('operatorBans') or []:
                        ban_rows.append({'gameId': gid, 'matchId': int(mid), 'teamId': gt['id'], 'operatorId': ban.get('id'),
                            'operator': ban.get('name'), 'attacker': ban.get('isAttacker'), 'roundIndex': ban.get('roundIndex'), 'source': match['_source']})
            normalized.append(record)
        if len(normalized) < 20: raise ValueError('Suspiciously small snapshot: fewer than 20 real series')
        ids = [m['id'] for m in normalized]
        if len(ids) != len(set(ids)): raise ValueError('Duplicate match IDs')
        if any(str(m[t]) not in teams for m in normalized for t in ('teamA', 'teamB')): raise ValueError('Unknown team master IDs')
        for rows, keys in [(game_rows, ['id']), (round_rows, ['id']), (player_rows, ['gameId','teamId','playerId']), (ban_rows, ['gameId','teamId','operatorId','roundIndex'])]:
            unique = [tuple(r.get(k) for k in keys) for r in rows]
            if len(unique) != len(set(unique)): raise ValueError('Duplicate normalized row keys: ' + ','.join(keys))
        # Detect accidental loss of previously published complete records. Source corrections need review.
        old = json.loads((data_dir / 'snapshot.json').read_text(encoding='utf-8')) if (data_dir / 'snapshot.json').exists() else None
        if old and old['meta']['season']['id'] == current_season['id']:
            old_ids = {m['id'] for m in old['matches'] if m['completed']}
            if not old_ids.issubset(set(ids)): raise ValueError('Previously completed series disappeared; retained previous snapshot for review')
        dataset = {'schemaVersion': 1, 'meta': {'generatedAt': stamp, 'source': 'Ubisoft R6 Esports public official pages',
            'sourceBase': base, 'season': {k: current_season[k] for k in ('id','name','year')},
            'scope': 'Current-season global events and the default/current regional stages exposed by official championship pages; not the entire season or all esports.',
            'detailPolicy': 'Latest completed series first; at most ' + str(args.detail_limit) + ' new detailed pages per successful update. Missing statistics remain null/absent.',
            'pollHours': 6, 'offlineRebuild': args.offline, 'latestCompletedMatch': max((m['date'] for m in normalized if m['completed']), default=None),
            'warnings': warnings, 'downloadErrors': errors, 'cacheNotices': notices},
            'competitions': competitions, 'teams': teams, 'matches': normalized, 'games': game_rows, 'rounds': round_rows,
            'players': player_rows, 'bans': ban_rows, 'sources': list(sources.values())}
        dataset['meta']['dataSha256'] = hashlib.sha256(json.dumps({k:dataset[k] for k in ('competitions','teams','matches','games','rounds','players','bans')}, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        # Publish a self-contained JS snapshot last, with atomic replace: file:// needs no fetch/server.
        encoded = json.dumps(dataset, ensure_ascii=False, separators=(',', ':'))
        candidate = data_dir / 'snapshot.candidate.json'
        candidate.write_text(encoded,encoding='utf-8')
        subprocess.run([sys.executable,str(root/'scripts/validate_data.py'),'--snapshot',str(candidate),'--quiet'],check=True)
        staged_html = root / 'index.html.candidate'
        runpy.run_path(str(root/'scripts/build.py'),init_globals={'snapshot_path':candidate,'html_output_path':staged_html})
        for filename, body in [('snapshot.json', encoded), ('latest.js', 'window.R6_LATEST=' + encoded.replace('<', '\\u003c') + ';window.dispatchEvent(new Event("r6-update"));')]:
            temporary = data_dir / (filename + '.tmp'); temporary.write_text(body, encoding='utf-8'); os.replace(temporary, data_dir / filename)
        status = {'ok': True, 'checkedAt': stamp, 'message': 'Verified official snapshot published', 'errors': errors,
                  'matches': len(normalized), 'detailed': sum(m['detailed'] for m in normalized), 'offline': args.offline}
        os.replace(staged_html,root/'index.html')
        runpy.run_path(str(root/'scripts/export_data.py'))
        candidate.unlink(missing_ok=True)
    except Exception as exc:
        status = {'ok': False, 'checkedAt': stamp, 'message': type(exc).__name__ + ': ' + str(exc), 'errors': errors,
                  'previousSnapshotRetained': True}
    cache_tmp = cache_path.with_suffix('.tmp'); cache_tmp.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding='utf-8'); os.replace(cache_tmp, cache_path)
    for filename, body in [('update_status.json', json.dumps(status, ensure_ascii=False, indent=2)),
                           ('status.js', 'window.R6_STATUS=' + json.dumps(status, ensure_ascii=False).replace('<', '\\u003c') + ';window.dispatchEvent(new Event("r6-status"));')]:
        temporary = data_dir / (filename + '.tmp'); temporary.write_text(body, encoding='utf-8'); os.replace(temporary, data_dir / filename)
    print(json.dumps(status, ensure_ascii=False), flush=True)
    if not args.watch: raise SystemExit(0 if status['ok'] else 1)
    print('Next automatic check in six hours. Keep this process and internet access available. Ctrl+C stops.', flush=True)
    time.sleep(6 * 3600)
