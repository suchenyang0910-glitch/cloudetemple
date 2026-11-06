#!/bin/bash
set -euo pipefail

test "$(stat -Lc '%a %U %G' /etc/chuamay)" = '750 root chuamay'
while IFS= read -r -d '' secret; do
  test "$(stat -Lc '%a %U %G' "$secret")" = '600 chuamay chuamay'
done < <(find /etc/chuamay -maxdepth 1 -type f \( \
  -name '*.env' -o -name '*.env.*' -o -name '*.password' -o \
  -iname '*token*' -o -iname '*access*' -o \
  -name '*.pem' -o -name '*.key' -o -name '*.crt' -o -name '*.cert' \
\) -print0)
test "$(stat -Lc '%a %U %G' /etc/chuamay/staging.htpasswd)" = '640 root messagebus'
test "$(stat -Lc '%a %U %G' /etc/ssl/chuamay)" = '750 caddy caddy'
test "$(stat -Lc '%a %U %G' /etc/ssl/chuamay/origin.pem)" = '600 caddy caddy'
test "$(stat -Lc '%a %U %G' /etc/ssl/chuamay/origin.key)" = '600 caddy caddy'
