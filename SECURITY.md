# Security policy

## Supported versions

Until the first public-ready release, only the latest commit on the active
development branch is supported.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Report it privately
to the repository maintainers with:

- a description of the impact;
- reproduction steps or a proof of concept;
- affected version or commit;
- any suggested mitigation.

Do not include household databases, uploaded files, passwords, tokens, or other
private family data in a report.

## Deployment requirements

- Use a unique, randomly generated `JWT_SECRET` for every deployment.
- Keep `.env`, `data/`, backups, and uploaded files out of version control.
- Put public deployments behind HTTPS and an authenticated reverse proxy.
- Do not expose the SQLite database or upload directory directly.
- Back up the database and uploads before upgrades or migrations.
- A single deployment is intended for one household during the initial
  productization phase. Do not share one deployment between unrelated
  households until multi-tenant isolation is explicitly released.
- JSON request bodies are limited to 2 MB. Inventory photo uploads are limited
  to 10 MB, restricted to image MIME types, and served only after authenticated
  household ownership checks.
