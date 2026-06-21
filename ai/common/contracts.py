from pydantic import BaseModel


class DecisionRequest(BaseModel):
    symbol: str
    trading_mode: str
    confidence_score: float
    risk_score: float


class DecisionResponse(BaseModel):
    decision: str
    confidence_score: float
    reason: str
