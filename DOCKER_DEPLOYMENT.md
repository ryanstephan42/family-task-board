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
   configured in `.env`).

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

### Database Migrations

The container is configured to automatically run Prisma migrations on startup:
`CMD npx prisma migrate deploy && npm start`

## Troubleshooting

- **Logs:** Check container logs with `docker compose logs app`.
- **Permissions:** Ensure the `data/` directory has write permissions for the user running Docker.
- **Port Conflicts:** If port 5123 is already in use, change the host-side mapping in `docker-compose.yml`.

## Updates

To update the application to the latest version:

```bash
git pull
docker compose up -d --build
```
