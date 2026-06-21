from ai.common.contracts import DecisionRequest


def test_decision_request_contract():
    request = DecisionRequest(symbol="XAUUSD", trading_mode="Hybrid", confidence_score=86, risk_score=40)

    assert request.symbol == "XAUUSD"
    assert request.trading_mode == "Hybrid"
