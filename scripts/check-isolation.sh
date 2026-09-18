#!/usr/bin/env sh
set -eu

db="${1:-/tmp/family-central-control-isolation.db}"
rm -f "${db}"

(
  cd server
  DATABASE_URL="file:${db}" npx prisma migrate deploy >/dev/null
)

sqlite3 "${db}" <<'SQL'
PRAGMA foreign_keys = ON;
INSERT INTO Household (id, name, timezone, createdAt, updatedAt)
VALUES ('household-a', 'Household A', 'UTC', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
       ('household-b', 'Household B', 'UTC', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO User (id, username, password, name, createdAt, updatedAt)
VALUES ('user-a', 'user-a', 'test-password', 'User A', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
       ('user-b', 'user-b', 'test-password', 'User B', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO Membership (id, userId, householdId, role, createdAt)
VALUES ('membership-a', 'user-a', 'household-a', 'OWNER', CURRENT_TIMESTAMP),
       ('membership-b', 'user-b', 'household-b', 'OWNER', CURRENT_TIMESTAMP);
INSERT INTO Task (id, householdId, title, creatorId, createdAt, updatedAt)
VALUES ('task-a', 'household-a', 'A task', 'user-a', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
       ('task-b', 'household-b', 'B task', 'user-b', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO ItemCategoryPreference (id, householdId, itemName, category)
VALUES ('preference-a', 'household-a', 'flour', 'A category'),
       ('preference-b', 'household-b', 'flour', 'B category');
INSERT INTO ChatChannel (id, householdId, name)
VALUES ('channel-a', 'household-a', 'general'),
       ('channel-b', 'household-b', 'general');
INSERT INTO BudgetCategory (id, householdId, name)
VALUES ('budget-category-a', 'household-a', 'Food'),
       ('budget-category-b', 'household-b', 'Food');
INSERT INTO BudgetTransaction (id, householdId, categoryId, description, amountCents)
VALUES ('budget-transaction-a', 'household-a', 'budget-category-a', 'A expense', 100),
       ('budget-transaction-b', 'household-b', 'budget-category-b', 'B expense', 200);

SQL

task_a_count="$(sqlite3 "${db}" "SELECT COUNT(*) FROM Task WHERE householdId = 'household-a';")"
task_b_visible_to_a="$(sqlite3 "${db}" "SELECT COUNT(*) FROM Task WHERE householdId = 'household-a' AND id = 'task-b';")"
preference_b_visible_to_a="$(sqlite3 "${db}" "SELECT COUNT(*) FROM ItemCategoryPreference WHERE householdId = 'household-a' AND id = 'preference-b';")"
channel_b_visible_to_a="$(sqlite3 "${db}" "SELECT COUNT(*) FROM ChatChannel WHERE householdId = 'household-a' AND id = 'channel-b';")"
budget_b_visible_to_a="$(sqlite3 "${db}" "SELECT COUNT(*) FROM BudgetTransaction WHERE householdId = 'household-a' AND id = 'budget-transaction-b';")"

test "${task_a_count}" -eq 1
test "${task_b_visible_to_a}" -eq 0
test "${preference_b_visible_to_a}" -eq 0
test "${channel_b_visible_to_a}" -eq 0
test "${budget_b_visible_to_a}" -eq 0

printf '%s\n' "Household isolation checks passed."
