# Docker Deployment Guide

This document explains how to deploy and host the Family Task Board using Docker and Docker Compose.

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
   cd family-task-board
   ```

2. **Prepare the Data Directory:**
   The application uses SQLite for the database. Ensure the `data` directory exists in the root:
   ```bash
   mkdir -p data
   ```

3. **Configure Environment Variables:**
   The `docker-compose.yml` file contains default environment variables. You can modify them directly or create a `.env` file in the root.

   Key variables:
   - `JWT_SECRET`: A secure random string for signing tokens.
   - `PORT`: Internal port the server runs on (default: 5000).
   - `DATABASE_URL`: Path to the SQLite database file.

4. **External Network (Important):**
   The current `docker-compose.yml` expects an external network named `budget_budget-network`. If you don't have this network, you can:
   
   A. Create it:
      ```bash
      docker network create budget_budget-network
      ```
   B. Or, modify `docker-compose.yml` to use a standard bridge network (see below).

5. **Build and Run:**
   ```bash
   docker-compose up -d --build
   ```

6. **Access the App:**
   The app will be available at `http://localhost:5123` (or the port specified in your `docker-compose.yml`).

## Detailed Configuration

### Standalone Docker Compose (Recommended for simple setups)

If you don't need the external network, you can simplify the `docker-compose.yml` like this:

```yaml
services:
  app:
    build: .
    container_name: family-task-board
    ports:
      - "5123:5000"
    environment:
      - DATABASE_URL=file:/app/server/data/prod.db
      - JWT_SECRET=change-this-to-a-secure-secret
      - PORT=5000
      - NODE_ENV=production
    volumes:
      - ./data:/app/server/data
    restart: always
```

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
    container_name: family-task-board
    ports:
      - "5123:5000" # Map host port 5123 to container port 5000
    environment:
      - DATABASE_URL=file:/app/server/data/prod.db
      - JWT_SECRET=your-secret-here
      - PORT=5000
      - NODE_ENV=production
    volumes:
      - ./data:/app/server/data # Persist SQLite database
    restart: always
```

### Persistence

The SQLite database is stored in `/app/server/data/prod.db` inside the container. By mapping `./data` from the host to `/app/server/data`, your data will persist even if the container is removed.

### Database Migrations

The container is configured to automatically run Prisma migrations on startup:
`CMD npx prisma migrate deploy && npm start`

## Troubleshooting

- **Logs:** Check container logs with `docker logs family-task-board`.
- **Permissions:** Ensure the `data/` directory has write permissions for the user running Docker.
- **Port Conflicts:** If port 5123 is already in use, change the host-side mapping in `docker-compose.yml`.

## Updates

To update the application to the latest version:

```bash
git pull
docker-compose up -d --build
```
