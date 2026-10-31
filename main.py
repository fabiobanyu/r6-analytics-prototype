"""Open the local HTML prototype or maintain its real official dataset."""
from pathlib import Path
import argparse, subprocess, sys, webbrowser
root = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description=__doc__)
group = parser.add_mutually_exclusive_group()
group.add_argument('--update',action='store_true')
group.add_argument('--watch',action='store_true')
group.add_argument('--check',action='store_true')
args = parser.parse_args()
if args.check:
    raise SystemExit(subprocess.call([sys.executable,str(root/'scripts/validate_data.py')]))
elif args.update or args.watch:
    raise SystemExit(subprocess.call([sys.executable,str(root/'scripts/update_data.py')]+(['--watch'] if args.watch else [])))
elif (root/'index.html').exists():
    webbrowser.open((root/'index.html').as_uri())
else:
    raise SystemExit('index.html is missing. Run python scripts/build.py first.')
