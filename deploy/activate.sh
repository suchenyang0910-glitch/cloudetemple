#!/bin/bash
set -euo pipefail
environment=${1:?staging or production}
release=${2:?release ID}
[[ "$environment" == staging || "$environment" == production ]] || exit 2
[[ "$release" =~ ^[a-f0-9]{7,40}$ ]] || exit 2
if [[ "$environment" == production && "${3:-}" != approved ]]; then echo 'Production requires explicit approval'; exit 2; fi
root=/opt/chuamay/$environment
target=$root/releases/$release
test -f "$target/server/index.mjs"
test -r "/etc/chuamay/$environment.env"
test "$(stat -Lc %a "/etc/chuamay/$environment.env")" = 600
test "$(stat -Lc %U "/etc/chuamay/$environment.env")" = chuamay
bash "$target/deploy/check-secret-permissions.sh"
port=8791; [[ "$environment" == production ]] && port=8790
old=$(readlink -f "$root/current" || true)
rollback() {
  if [[ -n "$old" && "$old" != "$root/current" ]]; then
    ln -s "$old" "$root/rollback-link"; mv -Tf "$root/rollback-link" "$root/current"
    systemctl restart "chuamay-api@$environment"
  else systemctl stop "chuamay-api@$environment" || true; fi
}
trap rollback ERR
cd "$target/server"
docker run --rm --memory 768m --cpus .5 --pids-limit 128 -e npm_config_jobs=1 -v "$target/server:/app" -w /app node:22.22.1-bookworm@sha256:f90672bf4c76dfc077d17be4c115b1ae7731d2e8558b457d86bca42aeb193866 npm ci --omit=dev --no-audit --no-fund
PATH=/opt/chuamay/runtime/bin:$PATH /opt/chuamay/runtime/bin/node --test test.mjs
ln -s "$target" "$root/next-link"; mv -Tf "$root/next-link" "$root/current"
systemctl restart "chuamay-api@$environment"
healthy=false
for attempt in {1..15}; do if curl -fsS "http://127.0.0.1:$port/healthz" >/dev/null; then healthy=true; break; fi; sleep 1; done
$healthy
test -s "$root/current/dist/index.html"
python3 - "$environment" <<'PY'
import sys,urllib.request,base64
from pathlib import Path
staging=sys.argv[1]=='staging'
headers={}
if staging:
    password=Path('/etc/chuamay/staging-access.txt').read_text().strip()
    headers['Authorization']='Basic '+base64.b64encode(('reviewer:'+password).encode()).decode()
with urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:'+('8803' if staging else '8800')+'/',headers=headers),timeout=5) as response:
    assert response.status==200
PY
systemctl enable "chuamay-api@$environment"
trap - ERR
echo "Activated $environment $release"
