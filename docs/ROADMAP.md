# Family Central Control roadmap

## Goal

Turn the existing family task board into a downloadable, configurable,
all-in-one household application that outside households can run safely on
their own infrastructure.

## Product decisions

- Native modules: tasks, calendar, chat, budget, groceries, inventory, and
  meals.
- Primary install: Docker Compose with a guided first-run setup.
- Initial isolation boundary: one separate deployment per household, with its
  own database, uploads, secrets, backups, and network resources.
- Migration: provide a tested importer for the existing family data.
- Default storage: SQLite for a simple single-household deployment.
- Optional integrations: Mealie, Open Food Facts, and cloud receipt parsing
  must never be required for core operation.

## Phases

1. **Containment:** remove family databases, generated artifacts, secrets, and
   host-specific configuration from the distributable source; audit Git
   history and rotate live credentials.
2. **Clean repository:** create `family-central-control` from reviewed source
   in clean history, with project, security, contribution, and ownership
   policies.
3. **Platform foundation:** establish reproducible builds, typed configuration,
   self-contained Compose, CI, image health checks, and release metadata.
4. **Identity and isolation:** add first-run owner setup, invitations, roles,
   secure sessions, household scoping, and authorization regression tests.
5. **Existing modules:** migrate and harden tasks, calendar, grocery,
   inventory, meals, uploads, and optional integrations.
6. **Native chat:** add scoped channels, durable messages, unread state,
   WebSocket updates, moderation, and reconnect behavior.
7. **Native budget:** add accounts, transactions, categories, monthly budgets,
   recurring entries, deterministic totals, and safe CSV import/export.
8. **Operations:** deliver diagnostics, backups, restores, upgrade/rollback
   checks, reverse-proxy guidance, release artifacts, and troubleshooting.
9. **Migration and pilot:** import the family data using reconciliation reports,
   deploy a separate external pilot, verify no crossover, and publish the
   first public-ready release.

## Current execution status

We are actively in Phase 4 of the roadmap: Identity and isolation. The current implementation focus is on making a household-scoped authorization boundary consistent across the API so one deployment cannot leak members, tasks, or uploads to another deployment.

Recent work includes:

- Centralizing the household guard in `server/src/auth.ts`.
- Restricting `/api/users` to only members of the authenticated household.
- Reusing the same household requirement check in task routes instead of repeating the same validation logic per handler.
- Scoping learned category, unit, barcode, and Mealie ingredient-link records to
  the authenticated household.
- Adding the first native chat and budget API foundations, both protected by
  household membership and backed by Prisma migrations.
- Adding a guarded SQLite legacy importer for a fresh initialized deployment,
  with refusal to merge into a populated target.
- Revalidating household membership against the database during authentication,
  so removed memberships invalidate access without waiting for token expiry.
- Matching the token household claim to the exact active membership instead of
  selecting an arbitrary membership when an account has more than one.
- Provisioning a default chat channel and starter budget categories during
  first-run setup.
- Adding an automated disposable-database regression check for cross-household
  visibility across tasks, preferences, and chat channels.
- Extending the regression check to budget categories and transactions.
- Printing source/target reconciliation counts from the guarded legacy importer.
- Validating required legacy source tables before an import transaction begins.
- Adding an authenticated diagnostics endpoint for database and upload-storage
  readiness.
- Adding a backup-before-upgrade helper and documented rollback procedure.
- Adding authenticated, household-scoped budget CSV export for portable
  reporting and future migration workflows.
- Adding strict authenticated budget CSV import that resolves categories only
  inside the active household.
- Adding household-scoped recurring budget definitions with integer-cent
  materialization.
- Wiring recurring budget materialization into the authenticated Budget UI.
- Adding per-user chat read state and household-scoped unread indicators.
- Adding interval-based active-channel updates without requiring a separate
  websocket service in the single-container deployment.

Chat and budget now have household-scoped client workflows for channels,
messages, unread polling, transactions, recurring entries, and CSV
import/export. WebSocket delivery, richer reporting, and release validation
remain future work.

## Public-ready release gate

- A clean machine can deploy and complete browser setup from documentation.
- No family data, credentials, uploads, or private infrastructure are in the
  repository or release image.
- Two deployments on one server share no secrets, storage, sessions, backups,
  or application records.
- Authentication, authorization, migration, backup/restore, upgrade, and
  cross-deployment isolation tests pass.
- The family migration has been tested against disposable copies and
  reconciled before cutover.
