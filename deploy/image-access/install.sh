#!/bin/bash
set -Eeuo pipefail
id=${1:?release}; [[ $id =~ ^[a-f0-9]{12}$ ]]
cd "$(dirname "$0")"
root=/opt/chuamay/production
sites=/opt/chuamay/nginx-production/sites
ng=chuamay-production-nginx
old=$(readlink -f "$root/current")
test "$old" = "$root/releases/22a76741d1d7"
target=$root/releases/$id
bk=$root/backups/img-$id
for path in "$target" "$bk" "$sites/00-image-log.conf" /etc/chuamay/web-rsyslog.conf /etc/systemd/system/chuamay-web-log.service /etc/logrotate.d/chuamay-web; do test ! -e "$path"; done
curl -fsS http://127.0.0.1:8790/healthz
mkdir -m 700 "$bk"
echo "$old" > "$bk/previous"
cp "$sites/h5.conf" "$sites/miniapp.conf" "$bk/"
install -m 700 rollback.sh "$bk/rollback.sh"
mkdir -p "$target/dist"
cp -a "$old/server" "$old/deploy" "$target/"
tar -xzf frontend.tar.gz -C "$target/dist"
python3 - "$target/dist" <<'PY'
import json,hashlib,pathlib,sys
r=pathlib.Path(sys.argv[1]);m=json.load(open('manifest.json'))
assert sorted(str(p.relative_to(r)) for p in r.rglob('*') if p.is_file())==sorted(f['path'] for f in m['files'])
for f in m['files']:assert hashlib.sha256((r/f['path']).read_bytes()).hexdigest()==f['sha256']
PY
rsyslogd -N1 -f rsyslog.conf
trap 'bash "$bk/rollback.sh"; exit 1' ERR
install -m 644 rsyslog.conf /etc/chuamay/web-rsyslog.conf
install -m 644 chuamay-web-log.service /etc/systemd/system/
install -m 644 logrotate /etc/logrotate.d/chuamay-web
systemctl daemon-reload
systemctl enable --now chuamay-web-log.service
for i in {1..20}; do test ! -S "$sites/.ct-access.sock" || break; sleep .1; done
test -S "$sites/.ct-access.sock"
logrotate -d /etc/logrotate.d/chuamay-web
cp 00-image-log.conf "$sites/"
for host in h5 miniapp; do
  sed "/^  server_name /a\  access_log syslog:server=unix:/etc/nginx/chuamay-sites/.ct-access.sock,tag=ctweb ct_image;" "$bk/$host.conf" > "$sites/$host.conf"
done
docker exec "$ng" nginx -t
ln -s "$target" "$bk/current.new"; mv -Tf "$bk/current.new" "$root/current"
docker exec "$ng" nginx -s reload
sleep 1
for p in 8800 8801; do
 curl -fsS "http://127.0.0.1:$p/release.json" | grep -q "$id"
 curl -fsS -A "CT-LogCheck-$p-$(printf 'x%.0s' {1..90})" -H 'CF-Connecting-IP: 192.0.2.123' "http://127.0.0.1:$p/index.html?omit-this=diagnostic" -o /dev/null
done
sleep .5
python3 - <<'PY'
import json,pathlib
rows=[json.loads(s) for s in pathlib.Path('/var/log/chuamay-web/access.log').read_text().splitlines() if 'CT-LogCheck-' in s]
for port in (8800,8801):
 r=next(x for x in rows if x['ua'].startswith(f'CT-LogCheck-{port}'))
 assert set(r)=={'time','path','status','bytes','seconds','ua','ip'} and len(r['ua'])==80 and r['path']=='/index.html' and r['ip']=='192.0' and r['status']==200
print('Both compact logs verified')
PY
curl -fsS http://127.0.0.1:8790/healthz
trap - ERR
echo "Active $id; rollback: $bk/rollback.sh"
