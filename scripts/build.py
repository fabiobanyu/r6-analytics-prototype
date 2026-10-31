"""Build a standalone local HTML; no external runtime dependencies."""
from pathlib import Path
import base64, hashlib, json, os, subprocess, sys
build_root = Path(__file__).resolve().parents[1]
subprocess.run([sys.executable,str(build_root/'scripts/validate_operators.py')],check=True,capture_output=True)
build_data = json.loads(Path(globals().get('snapshot_path',build_root / 'data/snapshot.json')).read_text(encoding='utf-8'))
build_html = (build_root / 'src/template.html').read_text(encoding='utf-8')
for placeholder, filename in [('/*__STYLE__*/','src/style.css'), ('/*__CORE__*/','src/engine.js'), ('/*__APP__*/','src/app.js')]:
    build_html = build_html.replace(placeholder, (build_root / filename).read_text(encoding='utf-8'))
build_html = build_html.replace('__DATA_JSON__', json.dumps(build_data, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c'))
operator_data=json.loads((build_root/'data/operators.json').read_text(encoding='utf-8'))
build_html=build_html.replace('__OPERATOR_JSON__',json.dumps(operator_data,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c'))
icon_manifest=json.loads((build_root/'assets/operator_icons.json').read_text(encoding='utf-8'))
for icon_item in icon_manifest.values():
    if hashlib.sha256((build_root/icon_item['file']).read_bytes()).hexdigest()!=icon_item['sha256']:raise SystemExit('Operator icon checksum mismatch')
embedded_icons={name:'data:image/png;base64,'+base64.b64encode((build_root/item['file']).read_bytes()).decode() for name,item in icon_manifest.items()}
build_html=build_html.replace('__VISUAL_ASSETS_JSON__',json.dumps(embedded_icons,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c'))
for font_placeholder,font_filename in [('__FONT_BODY__','Manrope-Variable.ttf'),('__FONT_HEADING__','Barlow-Condensed-Bold.ttf')]:
    build_html=build_html.replace(font_placeholder,base64.b64encode((build_root/'assets/fonts'/font_filename).read_bytes()).decode())
if any(x in build_html for x in ['/*__STYLE__*/','/*__CORE__*/','/*__APP__*/','__DATA_JSON__','__OPERATOR_JSON__','__VISUAL_ASSETS_JSON__','__FONT_BODY__','__FONT_HEADING__']):
    raise SystemExit('Unresolved build placeholder')
build_output = Path(globals().get('html_output_path',build_root / 'index.html'))
build_temp = build_output.with_name(build_output.name + '.tmp')
build_temp.write_text(build_html, encoding='utf-8'); os.replace(build_temp, build_output)
print('Built standalone index.html:', len(build_html.encode('utf-8')), 'bytes')
