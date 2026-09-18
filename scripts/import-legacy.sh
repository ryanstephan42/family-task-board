#!/usr/bin/env sh
set -eu

legacy_db="${1:-}"
target_db="${2:-data/prod.db}"

if [ -z "${legacy_db}" ] || [ ! -f "${legacy_db}" ] || [ ! -f "${target_db}" ]; then
  printf '%s\n' "Usage: scripts/import-legacy.sh LEGACY_DB TARGET_DB" >&2
  exit 1
fi

for table in User Task Step Event GroceryItem FoodItem; do
  if [ "$(sqlite3 "${legacy_db}" "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = '${table}';")" -ne 1 ]; then
    printf 'Legacy database is missing required table: %s\n' "${table}" >&2
    exit 1
  fi
done

household_id="$(sqlite3 "${target_db}" "SELECT id FROM Household LIMIT 1;")"
if [ -z "${household_id}" ]; then
  printf '%s\n' "Target must be initialized with a household before importing." >&2
  exit 1
fi

if [ "$(sqlite3 "${target_db}" "SELECT COUNT(*) FROM Task UNION ALL SELECT COUNT(*) FROM Event UNION ALL SELECT COUNT(*) FROM GroceryItem UNION ALL SELECT COUNT(*) FROM FoodItem;" | awk '$1 != 0 { count++ } END { print count + 0 }')" -ne 0 ]; then
  printf '%s\n' "Target already contains household data; refusing to merge an import." >&2
  exit 1
fi

sqlite3 "${target_db}" <<SQL
.parameter init
.parameter set :legacy '${legacy_db}'
ATTACH DATABASE :legacy AS legacy;
PRAGMA foreign_keys = ON;
BEGIN IMMEDIATE;

INSERT INTO "User" ("id", "username", "password", "name", "createdAt", "updatedAt")
SELECT l."id", l."username", l."password", l."name", l."createdAt", l."updatedAt"
FROM legacy."User" l
WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id" = l."id");

INSERT INTO "Membership" ("id", "userId", "householdId", "role", "createdAt")
SELECT lower(hex(randomblob(16))), l."id", '${household_id}', 'MEMBER', CURRENT_TIMESTAMP
FROM legacy."User" l
WHERE NOT EXISTS (
  SELECT 1 FROM "Membership" m
  WHERE m."userId" = l."id" AND m."householdId" = '${household_id}'
);

INSERT INTO "Task" ("id", "householdId", "title", "description", "status", "type", "priority", "dueDate", "isRepeating", "repeatFrequency", "creatorId", "assigneeId", "createdAt", "updatedAt")
SELECT "id", '${household_id}', "title", "description", "status", "type", "priority", "dueDate", COALESCE("isRepeating", 0), "repeatFrequency", "creatorId", "assigneeId", "createdAt", "updatedAt"
FROM legacy."Task";

INSERT INTO "Step" ("id", "content", "completed", "taskId")
SELECT "id", "content", "completed", "taskId" FROM legacy."Step";

INSERT INTO "Event" ("id", "householdId", "title", "description", "startTime", "endTime", "location", "isRepeating", "repeatFrequency", "color", "creatorId", "createdAt", "updatedAt")
SELECT "id", '${household_id}', "title", "description", "startTime", "endTime", "location", COALESCE("isRepeating", 0), "repeatFrequency", COALESCE("color", '#0ea5e9'), "creatorId", "createdAt", "updatedAt"
FROM legacy."Event";

INSERT INTO "GroceryItem" ("id", "householdId", "name", "quantity", "details", "category", "completed", "createdAt", "updatedAt")
SELECT "id", '${household_id}', "name", "quantity", "details", "category", "completed", "createdAt", "updatedAt"
FROM legacy."GroceryItem";

INSERT INTO "FoodItem" ("id", "householdId", "name", "quantity", "unit", "category", "location", "purchaseDate", "trackExpiration", "expirationDate", "notes", "barcode", "parLevel", "lowStock", "photoUrl", "createdAt", "updatedAt")
SELECT "id", '${household_id}', "name", "quantity", "unit", "category", "location", "purchaseDate", COALESCE("trackExpiration", 1), "expirationDate", "notes", "barcode", "parLevel", COALESCE("lowStock", 0), "photoUrl", "createdAt", "updatedAt"
FROM legacy."FoodItem";

COMMIT;
DETACH DATABASE legacy;
SQL

for table in User Task Event GroceryItem FoodItem; do
  source_count="$(sqlite3 "${legacy_db}" "SELECT COUNT(*) FROM \"${table}\";")"
  imported_count="$(sqlite3 "${target_db}" "SELECT COUNT(*) FROM \"${table}\";")"
  printf '%s: source=%s target_total=%s\n' "${table}" "${source_count}" "${imported_count}"
done
printf 'Imported legacy records into household %s. Review these counts and the records before opening access.\n' "${household_id}"
