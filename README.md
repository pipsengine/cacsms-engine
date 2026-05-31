# CACSMS Engine

CACSMS Engine is the production foundation for an institutional, AI-powered trading operations platform. The repository is organized as a monorepo with a runnable executive command center, PostgreSQL and TimescaleDB foundation, deterministic workflow orchestration primitives, service boundaries, observability configuration, and architecture documentation.

## Quick Start

```bash
npm run dev
```

Open `http://localhost:4173`.

`npm run dev` starts both the web console and API in the foreground. Press `Ctrl+C` to stop both. If an earlier preview is occupying the local ports, run:

```bash
npm run stop
```

## Validate

```bash
npm run check
npm test
```

See [docs/blueprint-coverage.md](docs/blueprint-coverage.md), [docs/level-1-coverage.md](docs/level-1-coverage.md), and [docs/operational-foundation-coverage.md](docs/operational-foundation-coverage.md) for line-by-line implementation maps.
