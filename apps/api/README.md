# API

The production API target is FastAPI with PostgreSQL/TimescaleDB, Redis, RabbitMQ, WebSockets, gRPC, and OpenTelemetry. `src/main.py` is the Python service entry point. `src/server.mjs` remains as a dependency-free local health stub for foundation validation.

Run the production-oriented development server after installing requirements:

```bash
uvicorn src.main:app --app-dir apps/api --reload --port 8080
```
