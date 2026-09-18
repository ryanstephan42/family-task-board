#!/usr/bin/env sh
set -eu

DATA_DIR="${1:-data}"
BACKUP_DIR="${2:-backups}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
archive="${BACKUP_DIR}/family-central-control-${timestamp}.tar.gz"

if [ ! -f "${DATA_DIR}/prod.db" ]; then
  printf '%s\n' "Database not found at ${DATA_DIR}/prod.db" >&2
  exit 1
fi

mkdir -p "${BACKUP_DIR}"
tar -czf "${archive}" -C "${DATA_DIR}" prod.db uploads
printf 'Created backup: %s\n' "${archive}"
