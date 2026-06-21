# Backend Structure

The backend follows Clean Architecture with DDD boundaries and database-agnostic persistence abstractions.

```text
backend/
  Cacsms.Engine.slnx
  src/
    Cacsms.Engine.Domain/
      Abstractions/        Entity, aggregate, repository, unit-of-work contracts
      Trading/             Trading universe and trading-style rules
      Workflow/            Workflow status, modules, stage aggregate
    Cacsms.Engine.Application/
      Abstractions/        AI, MT5, workflow service contracts
      Realtime/            SignalR publishing abstraction
      Trading/             Trading universe service contract
      Workflow/            Workflow DTOs
    Cacsms.Engine.Infrastructure/
      DependencyInjection/ Service registrations
      Persistence/         Current in-memory repository/unit of work
      Services/            AI, MT5, workflow, trading universe adapters
    Cacsms.Engine.Api/
      Endpoints/           Minimal API endpoint modules
      Hubs/                SignalR hubs and publishers
    Cacsms.Engine.Worker/
      Jobs/                Background scanning and monitoring jobs
    Cacsms.Engine.Mt5Bridge/
      Bridge/              MT5 EA bridge message routing
```

## Rules

- Domain does not reference infrastructure, API, workers, databases, or external services.
- Application owns contracts and use-case DTOs.
- Infrastructure implements contracts and remains replaceable.
- Persistence is database-agnostic until the database is selected.
- MT5 never communicates directly with the database.
- Real-time events flow through SignalR abstractions.
- Python AI services remain independent and communicate through APIs.
