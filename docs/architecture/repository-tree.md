# Repository Tree

The repository now follows the expanded CACSMS Engine production scaffold:

- `apps/web`: immediate foundation preview plus Next.js app-router migration boundary.
- `apps/api`: dependency-free local validation server plus FastAPI application package.
- `apps/machine-agent`: Windows VPS agent contracts and manager modules.
- `apps/mt5-bridge`: gateway, dispatcher, heartbeat, audit, and token-validation modules.
- `services`: independently deployable trading-intelligence and governance boundaries.
- `packages`: shared UI, types, config, database, workflow, messaging, security, trading, chart, validation, and utility packages.
- `database`: ordered migrations, seeds, and schema reference snapshots.
- `mt5`: MQL5 EA bridge, includes, scripts, and presets.
- `infrastructure`: Docker, Kubernetes, Nginx, monitoring, RabbitMQ, Redis, and Terraform boundaries.
- `docs`: architecture, API, database, workflow, MT5, security, deployment, and operations references.

Existing runnable foundation files remain in place while the target production modules are implemented incrementally.
