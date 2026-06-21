from fastapi import FastAPI

from ai.common.contracts import DecisionRequest, DecisionResponse

app = FastAPI(title="Cacsms Engine Decision Assistance")


@app.post("/decision", response_model=DecisionResponse)
def request_decision(request: DecisionRequest) -> DecisionResponse:
    return DecisionResponse(
        decision="WAIT",
        confidence_score=request.confidence_score,
        reason="Decision assistance service scaffold is ready for model integration.",
    )
