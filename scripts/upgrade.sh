#!/usr/bin/env sh
set -eu

backup_dir="${1:-backups}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"

./scripts/backup.sh data "${backup_dir}"
git pull --ff-only
docker compose up -d --build

printf 'Upgrade completed at %s. Verify /ready and /api/diagnostics before opening access.\n' "${timestamp}"
