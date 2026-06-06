# Docker (Docker Desktop)

Run the full application stack from the **repository root** — no `npm run dev` / `npm run stop` required.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) running
- Copy `.env.example` to `.env` at the repo root (optional API keys; database defaults work locally)

### If image pull fails (`lookup registry-1.docker.io: no such host`)

Docker Desktop DNS may be misconfigured. Add public DNS to `%USERPROFILE%\.docker\daemon.json`:

```json
"dns": ["8.8.8.8", "1.1.1.1"]
```

Then **restart Docker Desktop** (tray icon → Quit, reopen). Retry `npm run docker:up`.

## Start

```bash
npm run docker:up
```

Or:

```bash
docker compose up -d --build
```

| Service | URL |
|---------|-----|
| Web console | http://localhost:4173 |
| API health | http://localhost:8080/api/system/health |
| PostgreSQL | localhost:5432 |
| RabbitMQ UI | http://localhost:15672 |

On first start, `db-migrate` applies pending SQL migrations, then **api** and **web** start automatically.

## Stop

```bash
npm run docker:down
```

## Logs

```bash
npm run docker:logs
```

## Observability (optional)

Prometheus, Grafana, Loki, and OpenTelemetry run only with the `observability` profile:

```bash
docker compose --profile observability up -d
```

## MT5 bridge on Windows

When the API runs in Docker, add this URL in MT5 **Tools → Options → Expert Advisors → Allow WebRequest**:

```
http://host.docker.internal:8080
```

## Local Node fallback

`npm run dev` remains available for quick debugging without Docker. Do not run both at once on ports **4173** and **8080**.
