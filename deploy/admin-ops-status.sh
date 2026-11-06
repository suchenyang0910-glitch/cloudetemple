#!/bin/bash
set -euo pipefail
environment=${1:?staging}
[[ "$environment" == staging ]] || exit 2
target=/var/lib/chuamay/staging/admin-ops.json
temp=$(mktemp)
trap 'rm -f "$temp"' EXIT
release=$(basename "$(readlink -f /opt/chuamay/staging/current)")
api=unknown; curl -fsS http://127.0.0.1:8791/healthz >/dev/null && api=ok
backup_result=$(systemctl show chuamay-backup@staging.service --property=Result --value 2>/dev/null || true)
backup_time=$(systemctl show chuamay-backup@staging.service --property=ActiveEnterTimestamp --value 2>/dev/null || true)
certificate=$(openssl x509 -in /etc/ssl/chuamay/origin.pem -noout -enddate 2>/dev/null | cut -d= -f2- || true)
disk=$(df --output=avail -B1 /var/lib/chuamay | tail -1 | tr -d ' ')
python3 - "$temp" "$release" "$api" "$backup_result" "$backup_time" "$certificate" "$disk" <<'PY'
import json,sys
path,release,api,result,backup,cert,disk=sys.argv[1:]
with open(path,'w',encoding='utf-8') as f:
 json.dump({'release':release,'api':api,'backupAt':backup,'backupCheck':'ok' if result=='success' else 'unknown','certificateExpires':cert,'diskFreeBytes':int(disk),'errors':[]},f,separators=(',',':'))
PY
install -o chuamay -g chuamay -m 600 "$temp" "$target"
