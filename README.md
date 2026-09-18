# Family Central Control

Family Central Control is a self-hosted household hub for tasks, calendar,
groceries, food inventory, and meal planning. Native chat and budgeting are
planned product modules.

The project is being prepared as a downloadable, configurable, all-in-one
application. The primary deployment target is Docker Compose with one
deployment per household. Each deployment must use its own database, uploads,
secrets, backups, and host port or hostname.

## Current status

This repository is in the productization phase. The existing task-board
features are being hardened before the first public-ready release. Do not use
the current branch as a public deployment until the security and isolation
milestones in the [roadmap](docs/ROADMAP.md) are complete.

## Development

The current codebase has separate client and server workspaces:

```bash
npm --prefix server ci
npm --prefix client ci

cd server && npx prisma generate && npm run build
npm --prefix client run build
```

The client development server expects the API at `http://localhost:5000`.
Production serves the built client from the API container.

## Docker deployment

```bash
cp .env.example .env
openssl rand -hex 32
# Put the generated value in .env as JWT_SECRET.
mkdir -p data
docker compose up -d --build
```

Open `http://localhost:5123`, or the port configured by `APP_PORT`. Never reuse
`.env` or `data/` between household deployments.

See [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) for operational details and
[SECURITY.md](SECURITY.md) for reporting security issues.

