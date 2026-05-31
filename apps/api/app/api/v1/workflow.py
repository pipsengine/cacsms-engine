from fastapi import APIRouter

router = APIRouter()


@router.get("/current")
async def current_workflow() -> dict[str, object]:
    return {"workflowId": "WF-2026-0531-0847", "currentStage": 9, "status": "running"}
