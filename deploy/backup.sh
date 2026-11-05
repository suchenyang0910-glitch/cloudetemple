#!/bin/bash
# Select/configure a remote backend before enabling the timer. No local-only backup is reported as offsite.
set -euo pipefail
environment=${1:?environment}
[[ "$environment" == staging || "$environment" == production ]] || exit 2
set -a
source "/etc/chuamay/$environment.env"
source "/etc/chuamay/backup-$environment.env"
set +a
temp=$(mktemp -d)
trap 'rm -f "$temp/api.sqlite"; rmdir "$temp"' EXIT
/opt/chuamay/runtime/bin/node "/opt/chuamay/$environment/current/server/backup.mjs" "$temp/api.sqlite"
case "$BACKUP_BACKEND" in
  restic)
    restic backup "$temp/api.sqlite" --tag "chuamay-$environment"
    restic forget --tag "chuamay-$environment" --keep-within 14d --prune
    ;;
  rclone)
    test -n "${RCLONE_REMOTE:?Use an encrypted remote}"
    rclone copyto "$temp/api.sqlite" "$RCLONE_REMOTE/chuamay-$environment/$(date -u +%Y%m%dT%H%M%SZ).sqlite"
    rclone delete "$RCLONE_REMOTE/chuamay-$environment" --min-age 14d
    ;;
  *) echo 'Offsite backup backend not configured'; exit 1;;
esac
