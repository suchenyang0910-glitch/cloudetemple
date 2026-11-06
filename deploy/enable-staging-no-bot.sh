#!/bin/bash
# First bootstrap only. Run with the reviewed server archive and its short commit.
set -Eeuo pipefail
id=${1:?commit}; archive=${2:?server archive}
[[ $id =~ ^[a-f0-9]{12}$ ]]
root=/opt/chuamay/staging
old=$(readlink -f "$root/current")
[[ $old == "$root"/releases/* ]]
next=$root/releases/$id
envfile=/etc/chuamay/staging.env
test ! -e "$envfile"
test ! -e "$next"
if systemctl is-active --quiet chuamay-api@staging; then exit 1; fi
mkdir "$next"
cp -a --reflink=auto "$old/." "$next/"
tar -xf "$archive" -C "$next"
(cd "$next/server" && /opt/chuamay/runtime/bin/node --test test.mjs)
umask 077
tmp=$(mktemp /etc/chuamay/staging.env.XXXXXX)
trap 'rm -f "$tmp"' EXIT
{
 printf 'TELEGRAM_ENABLED=0\nPORT=8791\nDB_PATH=/var/lib/chuamay/staging/api.sqlite\nTRUST_LOCAL_PROXY=1\nALLOWED_ORIGINS=https://staging.chuamay.org\nMINIAPP_URL=https://staging.chuamay.org/?telegram=1\nHASH_SECRET='
 openssl rand -hex 32
} > "$tmp"
chown chuamay:chuamay "$tmp"
ln "$tmp" "$envfile"
rollback(){
 systemctl disable --now chuamay-api@staging || true
 ln -s "$old" "$next/rollback-link"; mv -Tf "$next/rollback-link" "$root/current"
}
trap rollback ERR
ln -s "$next" "$next/next-link"; mv -Tf "$next/next-link" "$root/current"
systemctl enable --now chuamay-api@staging
curl -fsS --retry 5 --retry-connrefused http://127.0.0.1:8791/healthz | python3 -c 'import json,sys;assert json.load(sys.stdin)=={"ok":True,"telegram":"disabled"}'
for route in remind webhook; do
 test "$(curl -sS -X POST -o /dev/null -w '%{http_code}' "http://127.0.0.1:8791/telegram/$route")" = 503
done
stat -c '%a %U:%G' "$envfile"
echo 'HEALTH 200 telegram disabled; remind/webhook 503'
