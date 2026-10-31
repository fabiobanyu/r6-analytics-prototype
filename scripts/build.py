"""Build a standalone local HTML; no external runtime dependencies."""
from pathlib import Path
import json, os
build_root = Path(__file__).resolve().parents[1]
build_data = json.loads(Path(globals().get('snapshot_path',build_root / 'data/snapshot.json')).read_text(encoding='utf-8'))
build_html = (build_root / 'src/template.html').read_text(encoding='utf-8')
for placeholder, filename in [('/*__STYLE__*/','src/style.css'), ('/*__CORE__*/','src/engine.js'), ('/*__APP__*/','src/app.js')]:
    build_html = build_html.replace(placeholder, (build_root / filename).read_text(encoding='utf-8'))
build_html = build_html.replace('__DATA_JSON__', json.dumps(build_data, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c'))
if any(x in build_html for x in ['/*__STYLE__*/','/*__CORE__*/','/*__APP__*/','__DATA_JSON__']):
    raise SystemExit('Unresolved build placeholder')
build_output = Path(globals().get('html_output_path',build_root / 'index.html'))
build_temp = build_output.with_name(build_output.name + '.tmp')
build_temp.write_text(build_html, encoding='utf-8'); os.replace(build_temp, build_output)
print('Built standalone index.html:', len(build_html.encode('utf-8')), 'bytes')
