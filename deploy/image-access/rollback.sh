#!/bin/bash
set -euo pipefail
bk=$(cd "$(dirname "$0")" && pwd)
root=/opt/chuamay/production
sites=/opt/chuamay/nginx-production/sites
old=$(cat "$bk/previous")
ln -s "$old" "$bk/current.restore"
mv -Tf "$bk/current.restore" "$root/current"
for host in h5 miniapp; do cp -p "$bk/$host.conf" "$sites/$host.conf"; done
rm -f "$sites/00-image-log.conf"
docker exec chuamay-production-nginx nginx -t
docker exec chuamay-production-nginx nginx -s reload
systemctl disable --now chuamay-web-log.service >/dev/null 2>&1 || true
rm -f /etc/systemd/system/chuamay-web-log.service /etc/chuamay/web-rsyslog.conf
# Keep the expiry policy for any logs already collected.
if test -f /etc/logrotate.d/chuamay-web; then sed -i '/postrotate/,/endscript/d' /etc/logrotate.d/chuamay-web; fi
systemctl daemon-reload
curl -fsS http://127.0.0.1:8790/healthz
