# Database Foundation

The initial migration targets PostgreSQL with TimescaleDB. It creates the core schemas, workflow orchestration tables, market time series, the machine-terminal-account registry, trading records, RBAC/ABAC security records, audit history, and analytics snapshots.

Run the files in order:

```bash
psql "$DATABASE_URL" -f database/migrations/001_foundation.sql
psql "$DATABASE_URL" -f database/migrations/002_level_1_architecture.sql
psql "$DATABASE_URL" -f database/migrations/003_operational_workflow_foundation.sql
psql "$DATABASE_URL" -f database/seeds/001_asset_universe.sql
psql "$DATABASE_URL" -f database/seeds/002_operational_defaults.sql
```

TimescaleDB and pgvector must be available in the target PostgreSQL installation.
