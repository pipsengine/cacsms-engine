from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Cacsms Engine Market Classification")


class MarketClassificationRequest(BaseModel):
    symbol: str
    timeframe: str


class MarketClassificationResponse(BaseModel):
    symbol: str
    category: str
    scalping_enabled: bool


@app.post("/classify", response_model=MarketClassificationResponse)
def classify_market(request: MarketClassificationRequest) -> MarketClassificationResponse:
    if request.symbol == "XAUUSD":
        return MarketClassificationResponse(symbol=request.symbol, category="Commodity", scalping_enabled=True)

    if request.symbol in {"US30", "SP500", "NASDAQ100"}:
        return MarketClassificationResponse(symbol=request.symbol, category="Index", scalping_enabled=False)

    return MarketClassificationResponse(symbol=request.symbol, category="Forex", scalping_enabled=False)
