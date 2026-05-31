# Workflow API Foundation

The dependency-free local API and FastAPI target expose the same initial operational surface.

## REST

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/workflow/current` | Current workflow lifecycle and funnel selections |
| POST | `/api/workflow/start` | Start a workflow run |
| POST | `/api/workflow/pause` | Pause the current run |
| POST | `/api/workflow/resume` | Resume a paused run |
| POST | `/api/workflow/stop` | Stop the current run |
| POST | `/api/workflow/retry-stage` | Retry the active stage |
| GET | `/api/workflow/events` | Workflow event history |
| GET | `/api/assets/universe` | Twenty-asset universe |
| GET | `/api/assets/scores` | Ranked Top 10 asset scores |
| GET | `/api/infrastructure/status` | Fleet status |
| GET | `/api/system/health` | API, database, WebSocket, Redis, and RabbitMQ health |

## WebSocket

Connect to `/ws/workflow`.

Supported events:

```text
workflow.started
workflow.stage.started
workflow.stage.completed
workflow.stage.failed
workflow.stage.blocked
workflow.assets.scanned
workflow.assets.ranked
workflow.top10.selected
workflow.top5.selected
workflow.top3.selected
workflow.trade.executed
workflow.position.updated
workflow.completed
```
