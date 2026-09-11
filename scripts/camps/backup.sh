#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
umask 077
backup_stamp=$(date -u +%Y%m%dT%H%M%S)
backup_root=runtime/backups/local
mkdir -p "$backup_root"
chmod 700 "$backup_root"
backup_dir="$backup_root/$backup_stamp"
mkdir -m 700 "$backup_dir"
docker compose --env-file .env.camps exec -T postgres pg_dump -U camps -Fc camps > "$backup_dir/camps.dump"
docker compose --env-file .env.camps exec -T worker tar -C /app/runtime -czf - . > "$backup_dir/artifacts.tar.gz"
docker compose --env-file .env.camps exec -T hermes tar -C /data -czf - . > "$backup_dir/hermes.tar.gz"
tar -tzf "$backup_dir/hermes.tar.gz" > /dev/null
restore_db="camps_restore_${backup_stamp,,}"
trap 'docker compose --env-file .env.camps exec -T postgres dropdb -U camps --if-exists "$restore_db" >/dev/null' EXIT
docker compose --env-file .env.camps exec -T postgres createdb -U camps "$restore_db"
docker compose --env-file .env.camps exec -T postgres pg_restore -U camps --exit-on-error -d "$restore_db" < "$backup_dir/camps.dump"
docker compose --env-file .env.camps exec -T postgres psql -U camps -d "$restore_db" -c 'SELECT count(*) AS restored_camps FROM camps;'
docker compose --env-file .env.camps exec -T postgres dropdb -U camps "$restore_db"
python3 - "$backup_dir/artifacts.tar.gz" <<'PYVERIFY'
import sys, tarfile, hashlib, re, json
with tarfile.open(sys.argv[1]) as archive:
 objects={}; refs=[]
 for item in archive:
  if not item.isfile(): continue
  data=archive.extractfile(item).read()
  name=item.name.rsplit('/',1)[-1]
  if '/objects/' in '/'+item.name and re.fullmatch('[a-f0-9]{64}',name):
   assert hashlib.sha256(data).hexdigest()==name, 'Artifact checksum mismatch'
   objects[name]=True
  elif item.name.endswith('.json'):
   try:
    value=json.loads(data)
    if isinstance(value,dict) and 'object' in value: refs.append(value['object'])
   except ValueError: pass
 assert all(ref in objects for ref in refs), 'Missing artifact object in backup'
 print('Verified artifact archive:',len(objects),'objects,',len(refs),'references')
PYVERIFY
chmod 600 "$backup_dir"/*
python3 - "$backup_root" <<'PY'
from pathlib import Path
from datetime import datetime
import sys,shutil
root=Path(sys.argv[1]);items=sorted([p for p in root.iterdir() if p.is_dir() and len(p.name)==15],reverse=True)
keep=set();days=set();weeks=set()
for p in items:
 day=p.name[:8]
 if day not in days and len(days)<7: days.add(day);keep.add(p)
for p in items:
 week=datetime.strptime(p.name,'%Y%m%dT%H%M%S').strftime('%G-%V')
 if week not in weeks and len(weeks)<4: weeks.add(week);keep.add(p)
for p in items:
 if p not in keep: shutil.rmtree(p)
PY
