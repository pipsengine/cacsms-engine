# CACSMS Engine

CACSMS Engine is the production foundation for an institutional, AI-powered trading operations platform. The repository is organized as a monorepo with a runnable executive command center, PostgreSQL and TimescaleDB foundation, deterministic workflow orchestration primitives, service boundaries, observability configuration, and architecture documentation.

## Quick Start (Docker Desktop)

Start Docker Desktop, then from the repository root:

```bash
npm run docker:up
```

Open **http://localhost:4173** (web) and **http://localhost:8080/api/system/health** (API).

Stop the stack:

```bash
npm run docker:down
```

See [infrastructure/docker/README.md](infrastructure/docker/README.md) for logs, MT5 WebRequest URLs, and optional observability.

## Local development (optional)

```bash
npm run dev
```

Use this only when not running the Docker stack. Press `Ctrl+C` to stop, or run `npm run stop` if ports 4173/8080 are still occupied.

## Validate

```bash
npm run check
npm test
```

See [docs/blueprint-coverage.md](docs/blueprint-coverage.md), [docs/level-1-coverage.md](docs/level-1-coverage.md), and [docs/operational-foundation-coverage.md](docs/operational-foundation-coverage.md) for line-by-line implementation maps.
