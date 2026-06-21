from ai.common.contracts import AdvancedAlgorithmRequest, DecisionRequest, HybridDecisionRequest, MacroIntelligenceRequest, MarketMemoryRequest, MultiTimeframeBiasRequest, TimeframeBiasInput
from ai.services.decision_assistance.main import _evaluate_advanced_algorithm, _evaluate_hybrid, _evaluate_macro, _evaluate_market_memory, _evaluate_multi_timeframe_bias


def test_decision_request_contract():
    request = DecisionRequest(symbol="XAUUSD", trading_mode="Hybrid", confidence_score=86, risk_score=40)

    assert request.symbol == "XAUUSD"
    assert request.trading_mode == "Hybrid"


def test_hybrid_decision_executes_only_above_confidence_gate():
    request = HybridDecisionRequest(
        symbol="XAUUSD",
        trading_mode="Hybrid",
        higher_timeframe_bias="Bullish",
        entry_timeframe_bias="Bullish",
        multi_timeframe_alignment_score=88,
        higher_timeframe_conflict_score=90,
        execution_timeframe_confirmation_score=84,
        risk_reward=2.5,
        liquidity_sweep=True,
        displacement=True,
        fair_value_gap=True,
        order_block_retest=True,
        break_of_structure=True,
        retail_trend_aligned=True,
        support_resistance_confirmation=True,
        pullback_confirmation=True,
        macro_bias_score=85,
        interest_rate_differential_score=80,
        cot_positioning_score=75,
        currency_strength_score=85,
        macro_risk_score=80,
        regime_model_score=82,
        historical_similarity_score=86,
        candle_intelligence_score=84,
        h8_d1_projection_score=82,
        ensemble_prediction_score=88,
        bayesian_confidence_score=86,
        probability_calibration_score=78,
        anomaly_score=92,
        execution_quality_score=84,
        volatility_score=55,
        strategy_health_score=80,
    )

    response = _evaluate_hybrid(request)

    assert response.recommendation == "Execute"
    assert response.direction == "Buy"
    assert response.confidence_score >= 85


def test_hybrid_decision_blocks_low_confidence_setup():
    request = HybridDecisionRequest(symbol="EURUSD", trading_mode="Hybrid", risk_reward=1.5)

    response = _evaluate_hybrid(request)

    assert response.recommendation == "NoTrade"
    assert "Confidence is below the 85% execution gate." in response.no_trade_reasons


def test_macro_intelligence_scores_strong_vs_weak_pair():
    request = MacroIntelligenceRequest(
        base_currency="GBP",
        quote_currency="JPY",
        base_currency_strength=82,
        quote_currency_strength=35,
        interest_rate_differential_score=78,
        cot_positioning_score=66,
        central_bank_bias_score=74,
        macro_risk_score=80,
    )

    response = _evaluate_macro(request)

    assert response.pair == "GBPJPY"
    assert response.recommendation == "MacroAligned"
    assert response.currency_strength_score >= 70


def test_advanced_algorithm_approves_healthy_model_stack():
    request = AdvancedAlgorithmRequest(
        regime_model_score=82,
        rules_model_score=86,
        statistical_model_score=80,
        pattern_classifier_score=84,
        macro_model_score=88,
        bayesian_prior=78,
        evidence_strength=88,
        probability_calibration_score=76,
        walk_forward_validation_score=74,
        anomaly_score=92,
        execution_quality_score=85,
        strategy_decay_score=78,
    )

    response = _evaluate_advanced_algorithm(request)

    assert response.recommendation == "AlgorithmApproved"
    assert response.ensemble_prediction_score >= 65
    assert response.bayesian_confidence_score >= 65


def test_market_memory_scores_history_candles_and_h8_d1_projection():
    request = MarketMemoryRequest(
        historical_similarity_score=84,
        similar_case_win_rate=68,
        candle_body_score=82,
        wick_rejection_score=78,
        close_location_score=86,
        candle_sequence_score=80,
        asian_h8_score=70,
        london_h8_score=88,
        new_york_h8_score=76,
        d1_projection_confidence=82,
    )

    response = _evaluate_market_memory(request)

    assert response.recommendation == "MemoryAligned"
    assert response.market_memory_score >= 75


def test_multi_timeframe_bias_allows_aligned_buy_stack():
    request = MultiTimeframeBiasRequest(
        monthly=TimeframeBiasInput(timeframe="MN", direction="Bullish", strength=72, confidence=70),
        weekly=TimeframeBiasInput(timeframe="W1", direction="Bullish", strength=76, confidence=74),
        daily=TimeframeBiasInput(timeframe="D1", direction="Bullish", strength=84, confidence=82),
        h8=TimeframeBiasInput(timeframe="H8", direction="Bullish", strength=80, confidence=78),
        h4=TimeframeBiasInput(timeframe="H4", direction="Bullish", strength=75, confidence=74),
        h1=TimeframeBiasInput(timeframe="H1", direction="Bullish", strength=72, confidence=70),
        m15=TimeframeBiasInput(timeframe="M15", direction="Bullish", strength=70, confidence=68),
        intended_direction="Buy",
    )

    response = _evaluate_multi_timeframe_bias(request)

    assert response.trade_permission == "Trade Allowed"
    assert response.final_bias.startswith("Bullish")
    assert response.higher_timeframe_conflict_score >= 70
