"""Export the real normalized snapshot as UTF-8 CSV files, preserving zero and missing values."""
from pathlib import Path
import csv, io, json, os, re
export_root=Path(__file__).resolve().parents[1]
export_dataset=json.loads(Path(globals().get('snapshot_path',export_root/'data/snapshot.json')).read_text(encoding='utf-8'))
for export_table in ['matches','games','rounds','players','bans']:
    export_rows=export_dataset[export_table]
    export_stream=io.StringIO(newline='')
    if export_rows:
        export_columns=list(export_rows[0])
        export_writer=csv.writer(export_stream)
        export_writer.writerow(export_columns)
        for export_row in export_rows:
            export_values=[]
            for export_key in export_columns:
                export_value=export_row[export_key]
                if export_value is None: export_value=''
                elif isinstance(export_value,(dict,list,bool)): export_value=json.dumps(export_value,ensure_ascii=False,separators=(',',':'))
                else: export_value=str(export_value)
                if re.match(r'^\s*[=+@-]',export_value): export_value="'"+export_value
                export_values.append(export_value)
            export_writer.writerow(export_values)
    export_target=export_root/'data'/(export_table+'.csv')
    export_temp=export_target.with_suffix('.csv.tmp')
    export_temp.write_text(export_stream.getvalue(),encoding='utf-8-sig',newline='')
    os.replace(export_temp,export_target)
