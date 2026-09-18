# Docker Deployment Guide

This document explains how to deploy and host the application using Docker and Docker Compose.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) installed on your system.
- [Docker Compose](https://docs.docker.com/compose/install/) installed on your system.

## Project Structure

The project is structured as a monorepo with:
- `client/`: React frontend (Vite)
- `server/`: Node.js backend (Express + Prisma + SQLite)
- `Dockerfile`: Multi-stage build for both client and server.
- `docker-compose.yml`: Orchestration for the application.

## Quick Start

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd family-central-control
   ```

2. **Configure the deployment:**
   ```bash
   cp .env.example .env
   openssl rand -hex 32
   ```
   Paste the generated value after `JWT_SECRET=` in `.env`. Never reuse this
   secret between household deployments.

3. **Prepare the Data Directory:**
   The application uses SQLite and local upload storage. Create a separate data
   directory for this deployment:
   ```bash
   mkdir -p data
   ```

4. **Build and Run:**
   ```bash
   docker compose up -d --build
   ```

5. **Access the App:**
   The app will be available at `http://localhost:5123` (or the `APP_PORT`
   configured in `.env`). A fresh deployment opens the guided setup screen.
   Create the household and owner account there; public registration is
   disabled after setup completes.

## Detailed Configuration

### Dockerfile Breakdown

The `Dockerfile` uses a 3-stage build process:
1. **client-build**: Compiles the React application into static files.
2. **server-build**: Installs dependencies, generates Prisma client, and compiles TypeScript.
3. **Final stage**: Combines the built server and client into a slim Alpine-based image.

### Docker Compose Configuration

```yaml
services:
  app:
    build: .
    ports:
      - "${APP_PORT:-5123}:5000"
    environment:
      DATABASE_URL: file:/app/server/data/prod.db
      JWT_SECRET: "${JWT_SECRET:?Set JWT_SECRET in .env before starting}"
      PORT: "5000"
      NODE_ENV: production
    volumes:
      - ./data:/app/server/data
    restart: unless-stopped
```

### Persistence

The SQLite database is stored in `/app/server/data/prod.db` inside the container. By mapping `./data` from the host to `/app/server/data`, your data will persist even if the container is removed.
Set `DATA_DIR` when hosting multiple household deployments on one server; each
deployment must use a different data directory and host port.

### Database Migrations

The container is configured to automatically run Prisma migrations on startup:
`CMD npx prisma migrate deploy && npm start`

### Backups and restores

Back up the database and uploaded photos together. Keep the backup directory
outside the repository and protect it like production data:

```bash
scripts/backup.sh data backups
```

Restore only into an empty deployment data directory. The restore script refuses
to overwrite an existing database or upload directory and rejects unsafe archive
paths:

```bash
mkdir -p restore-data
scripts/restore.sh backups/family-central-control-YYYYMMDDTHHMMSSZ.tar.gz restore-data
```

After restoring, start the deployment with that directory mounted as `./data`
and verify the application at `/ready` before allowing household access.

### Importing an existing family database

Only import into a freshly initialized target deployment with an empty
household. The importer refuses to merge into a target that already has
tasks, events, groceries, or inventory:

```bash
scripts/import-legacy.sh /path/to/legacy.db data/prod.db
```

Take a backup first, review the imported records, and reconcile counts before
using the deployment. Never run this against the live family database.
The importer prints source and target counts for each supported table to make
that reconciliation explicit. It also validates that the legacy database
contains all required source tables before writing anything.

### Diagnostics

Authenticated household members can check deployment dependencies without
exposing secrets:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:5123/api/diagnostics
```

The endpoint reports database and upload-storage status and returns HTTP 503
when either dependency is unavailable.

## Troubleshooting

- **Logs:** Check container logs with `docker compose logs app`.
- **Permissions:** Ensure the `data/` directory has write permissions for the user running Docker.
- **Port Conflicts:** If port 5123 is already in use, change the host-side mapping in `docker-compose.yml`.

## Updates

To update the application to the latest version with a backup first:

```bash
scripts/upgrade.sh
```

If the new release is unhealthy, stop the app, restore the most recent backup
into an empty data directory, check out the previous known-good release, and
start Compose again:

```bash
docker compose down
mv data data.failed-restore
mkdir data
scripts/restore.sh backups/family-central-control-YYYYMMDDTHHMMSSZ.tar.gz data
git checkout PREVIOUS_KNOWN_GOOD_TAG
docker compose up -d --build
```

Verify `/ready` and `/api/diagnostics` before allowing household access.
