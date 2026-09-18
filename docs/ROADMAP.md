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

