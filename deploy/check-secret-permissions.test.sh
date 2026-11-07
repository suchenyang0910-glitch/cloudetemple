#!/bin/bash
set -euo pipefail

stat() {
  local path="${*: -1}"
  case "$path" in
    /etc/chuamay) printf '750 root chuamay\n' ;;
    /etc/chuamay/staging.env)
      if [[ "${TEST_MODE:-pass}" == fail ]]; then printf '644 chuamay chuamay\n'; else printf '600 chuamay chuamay\n'; fi ;;
    /etc/chuamay/service.password) printf '600 chuamay chuamay\n' ;;
    /etc/chuamay/staging.htpasswd) printf '640 root messagebus\n' ;;
    /etc/ssl/chuamay) printf '750 caddy caddy\n' ;;
    /etc/ssl/chuamay/origin.pem|/etc/ssl/chuamay/origin.key) printf '600 caddy caddy\n' ;;
    *) return 1 ;;
  esac
}

find() {
  printf '/etc/chuamay/staging.env\0/etc/chuamay/service.password\0'
}

export -f stat find
TEST_MODE=pass bash deploy/check-secret-permissions.sh
if TEST_MODE=fail bash deploy/check-secret-permissions.sh >/tmp/chuamay-permission-gate.out 2>&1; then
  echo 'expected permission gate failure' >&2
  exit 1
fi
grep -Fxq 'permission mismatch: path=/etc/chuamay/staging.env current=644 chuamay chuamay expected=600 chuamay chuamay' /tmp/chuamay-permission-gate.out
if grep -Fq 'fixture-secret' /tmp/chuamay-permission-gate.out; then
  echo 'secret content leaked into gate output' >&2
  exit 1
fi
rm -f /tmp/chuamay-permission-gate.out
