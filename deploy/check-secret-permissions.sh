#!/bin/bash
set -euo pipefail

failed=0
check_metadata() {
  local path="$1" expected="$2" current
  if ! current=$(stat -Lc '%a %U %G' "$path" 2>/dev/null); then current=missing; fi
  if [[ "$current" != "$expected" ]]; then
    printf 'permission mismatch: path=%s current=%s expected=%s\n' "$path" "$current" "$expected" >&2
    failed=1
  fi
}

check_metadata /etc/chuamay '750 root chuamay'
while IFS= read -r -d '' secret; do
  check_metadata "$secret" '600 chuamay chuamay'
done < <(find /etc/chuamay -maxdepth 1 -type f \( \
  -name '*.env' -o -name '*.env.*' -o -name '*.password' -o \
  -iname '*token*' -o -iname '*access*' -o \
  -name '*.pem' -o -name '*.key' -o -name '*.crt' -o -name '*.cert' \
\) -print0)
check_metadata /etc/chuamay/staging.htpasswd '640 root messagebus'
check_metadata /etc/ssl/chuamay '750 caddy caddy'
check_metadata /etc/ssl/chuamay/origin.pem '600 caddy caddy'
check_metadata /etc/ssl/chuamay/origin.key '600 caddy caddy'
exit "$failed"
