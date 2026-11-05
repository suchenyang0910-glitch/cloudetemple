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
PATH=/opt/chuamay/runtime/bin:$PATH /opt/chuamay/runtime/bin/npm ci --omit=dev --no-audit --no-fund
PATH=/opt/chuamay/runtime/bin:$PATH /opt/chuamay/runtime/bin/node --test test.mjs
ln -s "$target" "$root/next-link"; mv -Tf "$root/next-link" "$root/current"
systemctl restart "chuamay-api@$environment"
healthy=false
for attempt in {1..15}; do if curl -fsS "http://127.0.0.1:$port/healthz" >/dev/null; then healthy=true; break; fi; sleep 1; done
$healthy
test -s "$root/current/dist/index.html"
systemctl enable "chuamay-api@$environment"
trap - ERR
echo "Activated $environment $release"
