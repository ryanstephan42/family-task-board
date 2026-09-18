#!/usr/bin/env sh
set -eu

root="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
first="$(mktemp)"
second="$(mktemp)"
trap 'rm -f "$first" "$second"' EXIT

(cd "$root" && APP_PORT=5123 DATA_DIR=./data-household-a JWT_SECRET=household-a-secret-that-is-long-enough-123 docker compose config) > "$first"
(cd "$root" && APP_PORT=5124 DATA_DIR=./data-household-b JWT_SECRET=household-b-secret-that-is-long-enough-456 docker compose config) > "$second"

grep -q 'published: "5123"' "$first"
grep -q 'published: "5124"' "$second"
grep -q 'data-household-a' "$first"
grep -q 'data-household-b' "$second"
grep -q 'household-a-secret-that-is-long-enough-123' "$first"
grep -q 'household-b-secret-that-is-long-enough-456' "$second"
if grep -q 'data-household-b' "$first" || grep -q 'data-household-a' "$second"; then
  printf '%s\n' 'Instance storage paths crossed.' >&2
  exit 1
fi

printf '%s\n' 'Two-instance Compose isolation checks passed.'
