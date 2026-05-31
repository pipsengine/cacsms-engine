from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, WebSocket

app = FastAPI(title="CACSMS API", version="0.1.0")

workflow: dict[str, Any] = {
    "workflowId": "WF-2026-0531-0847",
    "currentStage": 9,
    "status": "running",
    "selectedAssets": ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD", "USDCHF", "NZDUSD", "NAS100", "US30", "EURJPY", "GBPJPY", "AUDJPY", "CADJPY", "EURGBP", "EURAUD", "EURCAD", "SPX500", "GER40", "USOIL"],
    "top10Assets": ["XAUUSD", "EURUSD", "GBPUSD", "NAS100", "US30", "USDJPY", "AUDUSD", "USDCAD", "EURJPY", "GBPJPY"],
    "top5Assets": ["XAUUSD", "EURUSD", "GBPUSD", "NAS100", "US30"],
    "top3Assets": ["XAUUSD", "EURUSD", "GBPUSD"],
    "executionCandidates": ["XAUUSD", "EURUSD"],
    "finalTrades": [],
    "errorCount": 0,
    "retryCount": 0,
}


@app.get("/health")
@app.get("/api/system/health")
async def health() -> dict[str, Any]:
    return {"service": "cacsms-api", "status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}


@app.get("/api/workflow/current")
async def current_workflow() -> dict[str, Any]:
    return workflow


@app.post("/api/workflow/{action}")
async def workflow_action(action: str) -> dict[str, Any]:
    transitions = {"start": "running", "pause": "blocked", "resume": "running", "stop": "stopped", "retry-stage": "retrying"}
    if action not in transitions:
        return {"accepted": False, "error": "unknown_action"}
    workflow["status"] = transitions[action]
    if action == "retry-stage":
        workflow["retryCount"] += 1
    return {"accepted": True, "workflow": workflow}


@app.get("/api/workflow/events")
async def workflow_events() -> dict[str, list[Any]]:
    return {"events": []}


@app.get("/api/assets/universe")
async def asset_universe() -> dict[str, Any]:
    return {"count": len(workflow["selectedAssets"]), "assets": workflow["selectedAssets"]}


@app.get("/api/assets/scores")
async def asset_scores() -> dict[str, Any]:
    return {"scores": [{"symbol": symbol, "score": score} for symbol, score in [("XAUUSD", 95), ("EURUSD", 89), ("GBPUSD", 86), ("NAS100", 82), ("US30", 80), ("USDJPY", 77), ("AUDUSD", 74), ("USDCAD", 72), ("EURJPY", 70), ("GBPJPY", 69)]]}


@app.get("/api/infrastructure/status")
async def infrastructure_status() -> dict[str, Any]:
    return {"status": "healthy", "machines": 1248, "mt5Terminals": 5672, "accounts": 18420, "averageLatencyMs": 42}


@app.websocket("/ws/workflow")
async def workflow_socket(websocket: WebSocket) -> None:
    await websocket.accept()
    await websocket.send_json({"type": "workflow.connected", "workflow": workflow})
    await websocket.close()
