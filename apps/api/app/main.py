from fastapi import FastAPI

from .api.v1.workflow import router as workflow_router

app = FastAPI(title="CACSMS API")
app.include_router(workflow_router, prefix="/api/workflow", tags=["workflow"])
