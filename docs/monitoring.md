# Monitoring Foundation

The local observability stack includes Prometheus, Grafana, Loki, and OpenTelemetry Collector configuration.

Instrumentation must cover:

- Workflow engine stages, failures, retries, blocks, escalations, and duration
- AI decision and debate latency, confidence, and model availability
- Infrastructure machines and MT5 terminals
- Machine agents and brokers
- PostgreSQL and TimescaleDB
- API traffic, latency, and errors
