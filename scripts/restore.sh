#!/usr/bin/env sh
set -eu

archive="${1:-}"
data_dir="${2:-data}"

if [ -z "${archive}" ] || [ ! -f "${archive}" ]; then
  printf '%s\n' "Usage: scripts/restore.sh BACKUP_ARCHIVE [DATA_DIR]" >&2
  exit 1
fi

if [ -e "${data_dir}/prod.db" ] || [ -e "${data_dir}/uploads" ]; then
  printf '%s\n' "Refusing to overwrite existing data. Restore into an empty DATA_DIR." >&2
  exit 1
fi

if tar -tzf "${archive}" | awk '
  $0 ~ /^\// || $0 ~ /(^|\/)\.\.(\/|$)/ || ($0 != "prod.db" && $0 != "uploads" && $0 !~ /^uploads\//) { invalid = 1 }
  END { exit invalid }
'; then
  :
else
  printf '%s\n' "Refusing to restore an archive with unsafe or unexpected paths." >&2
  exit 1
fi

mkdir -p "${data_dir}"
tar -xzf "${archive}" -C "${data_dir}"
printf 'Restored backup into: %s\n' "${data_dir}"
