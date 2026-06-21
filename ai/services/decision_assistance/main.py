from fastapi import FastAPI

from ai.common.contracts import (
    AdvancedAlgorithmRequest,
    AdvancedAlgorithmResponse,
    DecisionRequest,
    DecisionResponse,
    HybridDecisionRequest,
    HybridDecisionResponse,
    MacroIntelligenceRequest,
    MacroIntelligenceResponse,
    MarketMemoryRequest,
    MarketMemoryResponse,
    MultiTimeframeBiasRequest,
    MultiTimeframeBiasResponse,
    TimeframeBiasInput,
)

app = FastAPI(title="Cacsms Engine Decision Assistance")


@app.post("/decision", response_model=DecisionResponse)
def request_decision(request: DecisionRequest) -> DecisionResponse:
    return DecisionResponse(
        decision="WAIT",
        confidence_score=request.confidence_score,
        reason="Decision assistance service scaffold is ready for model integration.",
    )


@app.post("/decision/hybrid-evaluate", response_model=HybridDecisionResponse)
def evaluate_hybrid_decision(request: HybridDecisionRequest) -> HybridDecisionResponse:
    return _evaluate_hybrid(request)


@app.post("/decision/macro-evaluate", response_model=MacroIntelligenceResponse)
def evaluate_macro_intelligence(request: MacroIntelligenceRequest) -> MacroIntelligenceResponse:
    return _evaluate_macro(request)


@app.post("/decision/advanced-algorithm-evaluate", response_model=AdvancedAlgorithmResponse)
def evaluate_advanced_algorithm(request: AdvancedAlgorithmRequest) -> AdvancedAlgorithmResponse:
    return _evaluate_advanced_algorithm(request)


@app.post("/decision/market-memory-evaluate", response_model=MarketMemoryResponse)
def evaluate_market_memory(request: MarketMemoryRequest) -> MarketMemoryResponse:
    return _evaluate_market_memory(request)


@app.post("/decision/multi-timeframe-bias-evaluate", response_model=MultiTimeframeBiasResponse)
def evaluate_multi_timeframe_bias(request: MultiTimeframeBiasRequest) -> MultiTimeframeBiasResponse:
    return _evaluate_multi_timeframe_bias(request)


def _evaluate_hybrid(request: HybridDecisionRequest) -> HybridDecisionResponse:
    no_trade_reasons: list[str] = []
    evidence: list[str] = []

    valid_modes = {"institutional", "retail", "hybrid"}
    if not request.symbol.strip():
        no_trade_reasons.append("Symbol is required.")

    if request.trading_mode.lower() not in valid_modes:
        no_trade_reasons.append("Trading mode must be Institutional, Retail, or Hybrid.")

    top_down_bias_score = _score_top_down_bias(request, evidence)
    macro_score = _score_macro(request, evidence)
    market_memory_score = _score_market_memory(request, evidence)
    advanced_algorithm_score = _score_advanced_algorithms(request, evidence)
    institutional_score = _score_institutional(request, evidence)
    retail_score = _score_retail(request, evidence)

    if request.trading_mode.lower() == "institutional":
        hybrid_score = round((macro_score * 0.18) + (market_memory_score * 0.12) + (advanced_algorithm_score * 0.20) + (institutional_score * 0.50), 2)
    elif request.trading_mode.lower() == "retail":
        hybrid_score = round((macro_score * 0.12) + (market_memory_score * 0.18) + (advanced_algorithm_score * 0.20) + (retail_score * 0.50), 2)
    else:
        hybrid_score = round((macro_score * 0.18) + (market_memory_score * 0.17) + (advanced_algorithm_score * 0.22) + (institutional_score * 0.28) + (retail_score * 0.15), 2)

    _apply_risk_gates(request, hybrid_score, no_trade_reasons)
    confidence_score = max(0, min(100, hybrid_score))

    if confidence_score < 85:
        no_trade_reasons.append("Confidence is below the 85% execution gate.")

    recommendation = "Execute" if not no_trade_reasons else "NoTrade"
    direction = _resolve_direction(request)
    executable_direction = direction if recommendation == "Execute" else "None"

    return HybridDecisionResponse(
        symbol=request.symbol.strip().upper(),
        trading_mode=_normalize_mode(request.trading_mode),
        recommendation=recommendation,
        direction=executable_direction,
        confidence_score=confidence_score,
        top_down_bias_score=top_down_bias_score,
        macro_score=macro_score,
        advanced_algorithm_score=advanced_algorithm_score,
        market_memory_score=market_memory_score,
        institutional_score=institutional_score,
        retail_score=retail_score,
        hybrid_score=hybrid_score,
        approved_risk_percent=_resolve_risk_percent(request, confidence_score) if recommendation == "Execute" else 0,
        approved_strategy=_resolve_strategy(request),
        liquidity_target=_resolve_liquidity_target(request, direction),
        invalidation_level=_resolve_invalidation(direction),
        expires_in_minutes=15 if recommendation == "Execute" else 0,
        no_trade_reasons=list(dict.fromkeys(no_trade_reasons)),
        evidence=list(dict.fromkeys(evidence)),
    )


def _evaluate_multi_timeframe_bias(request: MultiTimeframeBiasRequest) -> MultiTimeframeBiasResponse:
    frames = [
        (request.monthly, 0.10),
        (request.weekly, 0.15),
        (request.daily, 0.25),
        (request.h8, 0.15),
        (request.h4, 0.15),
        (request.h1, 0.10),
        (request.m15, 0.10),
    ]
    bullish = _weighted_direction(frames, "Bullish")
    bearish = _weighted_direction(frames, "Bearish")
    final_direction = "Bullish" if bullish > bearish else "Bearish" if bearish > bullish else "Neutral"
    alignment = round(max(bullish, bearish), 2)
    intended = _normalize_bias_direction(request.intended_direction)
    htf_conflict = _higher_timeframe_conflict(request, final_direction)
    execution_confirmation = _execution_confirmation(request, final_direction)
    reasons = [
        f"MN={request.monthly.direction}, W1={request.weekly.direction}, D1={request.daily.direction}, H8={request.h8.direction}, H4={request.h4.direction}, H1={request.h1.direction}, M15={request.m15.direction}.",
        "Higher-timeframe stack is sufficiently aligned." if htf_conflict >= 70 else "Higher-timeframe stack has meaningful conflict.",
        "Execution timeframes confirm the final bias." if execution_confirmation >= 60 else "Execution timeframes do not yet confirm the final bias.",
        "No dominant weighted direction was found." if final_direction == "Neutral" else f"{final_direction} is the dominant weighted direction.",
    ]

    if final_direction == "Neutral":
        permission = "No Trade"
    elif final_direction.lower() != intended.lower():
        permission = "Opposite Bias"
    elif htf_conflict < 70:
        permission = "Wait for Alignment"
    elif execution_confirmation < 60:
        permission = "Wait for Entry Confirmation"
    else:
        permission = "Trade Allowed"

    final_bias = "Neutral / mixed timeframe structure" if final_direction == "Neutral" else f"{final_direction} bias across weighted timeframe stack"
    return MultiTimeframeBiasResponse(
        final_bias=final_bias,
        alignment_score=alignment,
        higher_timeframe_conflict_score=htf_conflict,
        execution_timeframe_confirmation_score=execution_confirmation,
        trade_permission=permission,
        reasons=reasons,
    )


def _score_top_down_bias(request: HybridDecisionRequest, evidence: list[str]) -> float:
    alignment = _clamp(request.multi_timeframe_alignment_score)
    conflict_safety = _clamp(request.higher_timeframe_conflict_score)
    execution_confirmation = _clamp(request.execution_timeframe_confirmation_score)
    bias_bonus = 10 if _bias_aligned(request) else 0
    score = round((alignment * 0.50) + (conflict_safety * 0.25) + (execution_confirmation * 0.25) + bias_bonus, 2)

    if alignment >= 70:
        evidence.append("Multi-timeframe stack supports the trade direction.")
    if conflict_safety >= 80:
        evidence.append("Higher-timeframe conflict detector is clear.")
    if execution_confirmation >= 70:
        evidence.append("Execution timeframe confirms the higher-timeframe bias.")

    return max(0, min(100, score))


def _evaluate_market_memory(request: MarketMemoryRequest) -> MarketMemoryResponse:
    reasons: list[str] = []
    historical = round((_clamp(request.historical_similarity_score) * 0.55) + (_clamp(request.similar_case_win_rate) * 0.45), 2)
    candle = round(
        (_clamp(request.candle_body_score) * 0.30)
        + (_clamp(request.wick_rejection_score) * 0.25)
        + (_clamp(request.close_location_score) * 0.25)
        + (_clamp(request.candle_sequence_score) * 0.20),
        2,
    )
    h8_d1 = round(
        (_clamp(request.asian_h8_score) * 0.20)
        + (_clamp(request.london_h8_score) * 0.35)
        + (_clamp(request.new_york_h8_score) * 0.25)
        + (_clamp(request.d1_projection_confidence) * 0.20),
        2,
    )
    memory = round((historical * 0.40) + (candle * 0.35) + (h8_d1 * 0.25), 2)

    _add_threshold_reason(historical, 60, "Historical pattern memory", reasons)
    _add_threshold_reason(candle, 60, "Candle intelligence", reasons)
    _add_threshold_reason(h8_d1, 60, "H8-to-D1 projection", reasons)

    if memory >= 75:
        recommendation = "MemoryAligned"
    elif memory >= 60:
        recommendation = "MemoryNeutral"
    else:
        recommendation = "MemoryBlocked"

    return MarketMemoryResponse(
        historical_pattern_score=historical,
        candle_intelligence_score=candle,
        h8_d1_projection_score=h8_d1,
        market_memory_score=memory,
        recommendation=recommendation,
        reasons=reasons,
    )


def _evaluate_advanced_algorithm(request: AdvancedAlgorithmRequest) -> AdvancedAlgorithmResponse:
    reasons: list[str] = []
    ensemble = round(
        (_clamp(request.rules_model_score) * 0.20)
        + (_clamp(request.statistical_model_score) * 0.20)
        + (_clamp(request.pattern_classifier_score) * 0.20)
        + (_clamp(request.macro_model_score) * 0.20)
        + (_clamp(request.regime_model_score) * 0.20),
        2,
    )
    bayesian = round((_clamp(request.bayesian_prior) * 0.40) + (_clamp(request.evidence_strength) * 0.60), 2)
    advanced = round(
        (_clamp(request.regime_model_score) * 0.15)
        + (ensemble * 0.25)
        + (bayesian * 0.20)
        + (_clamp(request.probability_calibration_score) * 0.15)
        + (_clamp(request.walk_forward_validation_score) * 0.10)
        + (_clamp(request.anomaly_score) * 0.10)
        + (_clamp(request.execution_quality_score) * 0.05),
        2,
    )

    _add_threshold_reason(ensemble, 65, "Ensemble prediction", reasons)
    _add_threshold_reason(bayesian, 65, "Bayesian confidence", reasons)
    _add_threshold_reason(request.probability_calibration_score, 60, "Probability calibration", reasons)
    _add_threshold_reason(request.walk_forward_validation_score, 60, "Walk-forward validation", reasons)
    _add_threshold_reason(request.anomaly_score, 75, "Anomaly safety", reasons)
    _add_threshold_reason(request.execution_quality_score, 70, "Execution quality", reasons)
    _add_threshold_reason(request.strategy_decay_score, 60, "Strategy decay health", reasons)

    if (
        advanced >= 80
        and ensemble >= 65
        and bayesian >= 65
        and request.anomaly_score >= 75
        and request.execution_quality_score >= 70
    ):
        recommendation = "AlgorithmApproved"
    elif advanced >= 65:
        recommendation = "AlgorithmReview"
    else:
        recommendation = "AlgorithmBlocked"

    return AdvancedAlgorithmResponse(
        ensemble_prediction_score=ensemble,
        bayesian_confidence_score=bayesian,
        advanced_algorithm_score=advanced,
        recommendation=recommendation,
        reasons=reasons,
    )


def _evaluate_macro(request: MacroIntelligenceRequest) -> MacroIntelligenceResponse:
    reasons: list[str] = []
    pair = f"{request.base_currency.strip().upper()}{request.quote_currency.strip().upper()}"
    strength_spread = max(-100, min(100, request.base_currency_strength - request.quote_currency_strength))
    currency_strength_score = max(0, min(100, 50 + strength_spread))

    if currency_strength_score >= 70:
        reasons.append("Base currency is meaningfully stronger than quote currency.")
    elif currency_strength_score <= 40:
        reasons.append("Currency strength is against the proposed long pair bias.")
    else:
        reasons.append("Currency strength is neutral or mixed.")

    _add_macro_reason(request.interest_rate_differential_score, "Interest-rate differential", reasons)
    _add_macro_reason(request.cot_positioning_score, "COT positioning", reasons)
    _add_macro_reason(request.central_bank_bias_score, "Central-bank bias", reasons)

    if request.macro_risk_score < 45:
        reasons.append("Macro event risk is too high for autonomous execution.")

    macro_bias_score = round(
        (currency_strength_score * 0.30)
        + (max(0, min(100, request.interest_rate_differential_score)) * 0.25)
        + (max(0, min(100, request.central_bank_bias_score)) * 0.20)
        + (max(0, min(100, request.cot_positioning_score)) * 0.15)
        + (max(0, min(100, request.macro_risk_score)) * 0.10),
        2,
    )

    if macro_bias_score >= 70 and request.macro_risk_score >= 45:
        recommendation = "MacroAligned"
    elif macro_bias_score >= 55 and request.macro_risk_score >= 45:
        recommendation = "MacroNeutral"
    else:
        recommendation = "MacroBlocked"

    return MacroIntelligenceResponse(
        pair=pair,
        macro_bias_score=macro_bias_score,
        currency_strength_score=currency_strength_score,
        interest_rate_differential_score=max(0, min(100, request.interest_rate_differential_score)),
        cot_positioning_score=max(0, min(100, request.cot_positioning_score)),
        central_bank_bias_score=max(0, min(100, request.central_bank_bias_score)),
        macro_risk_score=max(0, min(100, request.macro_risk_score)),
        recommendation=recommendation,
        reasons=reasons,
    )


def _score_macro(request: HybridDecisionRequest, evidence: list[str]) -> float:
    macro_bias = max(0, min(100, request.macro_bias_score))
    rate_differential = max(0, min(100, request.interest_rate_differential_score))
    cot_positioning = max(0, min(100, request.cot_positioning_score))
    currency_strength = max(0, min(100, request.currency_strength_score))
    macro_risk = max(0, min(100, request.macro_risk_score))

    score = round(
        (macro_bias * 0.30)
        + (rate_differential * 0.25)
        + (currency_strength * 0.25)
        + (cot_positioning * 0.10)
        + (macro_risk * 0.10),
        2,
    )

    if macro_bias >= 70:
        evidence.append("Macro bias supports the trade direction.")
    if rate_differential >= 70:
        evidence.append("Interest-rate differential supports the selected pair.")
    if currency_strength >= 70:
        evidence.append("Currency strength matrix confirms strong-vs-weak alignment.")
    if cot_positioning >= 70:
        evidence.append("COT positioning supports the slow-bias context.")

    return max(0, min(100, score))


def _score_market_memory(request: HybridDecisionRequest, evidence: list[str]) -> float:
    history = _clamp(request.historical_similarity_score)
    candle = _clamp(request.candle_intelligence_score)
    h8_d1 = _clamp(request.h8_d1_projection_score)
    score = round((history * 0.40) + (candle * 0.35) + (h8_d1 * 0.25), 2)

    if history >= 70:
        evidence.append("Historical pattern memory supports this setup.")
    if candle >= 70:
        evidence.append("Candle intelligence confirms directional pressure.")
    if h8_d1 >= 70:
        evidence.append("H8-to-D1 projection supports the daily candle direction.")

    return max(0, min(100, score))


def _score_advanced_algorithms(request: HybridDecisionRequest, evidence: list[str]) -> float:
    regime = _clamp(request.regime_model_score)
    market_memory = _score_market_memory(request, evidence)
    ensemble = _clamp(request.ensemble_prediction_score)
    bayesian = _clamp(request.bayesian_confidence_score)
    calibration = _clamp(request.probability_calibration_score)
    anomaly_safety = _clamp(request.anomaly_score)
    execution_quality = _clamp(request.execution_quality_score)

    score = round(
        (regime * 0.12)
        + (market_memory * 0.18)
        + (ensemble * 0.22)
        + (bayesian * 0.20)
        + (calibration * 0.12)
        + (anomaly_safety * 0.10)
        + (execution_quality * 0.08),
        2,
    )

    if ensemble >= 75:
        evidence.append("Ensemble prediction supports the trade.")
    if bayesian >= 75:
        evidence.append("Bayesian confidence update supports the trade.")
    if calibration >= 70:
        evidence.append("Probability calibration is healthy.")
    if anomaly_safety >= 80:
        evidence.append("Anomaly detection is clear.")
    if execution_quality >= 75:
        evidence.append("Execution quality supports autonomous routing.")

    return max(0, min(100, score))


def _score_institutional(request: HybridDecisionRequest, evidence: list[str]) -> float:
    score = 20.0
    score = _add_if(score, request.liquidity_sweep, 18, "Liquidity sweep detected.", evidence)
    score = _add_if(score, request.displacement, 16, "Displacement confirms institutional intent.", evidence)
    score = _add_if(score, request.fair_value_gap, 12, "Fair value gap provides continuation imbalance.", evidence)
    score = _add_if(score, request.order_block_retest, 12, "Order block mitigation is present.", evidence)
    score = _add_if(score, request.break_of_structure, 10, "Break of structure confirms directional shift.", evidence)
    score = _add_if(score, _bias_aligned(request), 8, "Higher timeframe and entry timeframe biases align.", evidence)
    score = _add_if(score, _institutional_session(request.session), 6, "Session liquidity is suitable.", evidence)
    score = _add_if(score, _tradable_regime(request.market_regime), 6, "Market regime supports active execution.", evidence)
    return max(0, min(100, score))


def _score_retail(request: HybridDecisionRequest, evidence: list[str]) -> float:
    score = 18.0
    score = _add_if(score, request.retail_trend_aligned, 18, "Retail trend alignment is present.", evidence)
    score = _add_if(score, request.support_resistance_confirmation, 16, "Support or resistance confirmation is present.", evidence)
    score = _add_if(score, request.pullback_confirmation, 14, "Pullback continuation confirmation is present.", evidence)
    score = _add_if(score, _bias_aligned(request), 12, "Retail and higher timeframe direction are aligned.", evidence)
    score = _add_if(score, request.risk_reward >= 2, 12, "Risk/reward clears the minimum 1:2 threshold.", evidence)
    score = _add_if(score, 35 <= request.volatility_score <= 75, 10, "Volatility is tradable.", evidence)
    return max(0, min(100, score))


def _add_if(score: float, condition: bool, points: float, message: str, evidence: list[str]) -> float:
    if condition:
        evidence.append(message)
        return score + points
    return score


def _add_macro_reason(value: float, label: str, reasons: list[str]) -> None:
    if value >= 70:
        reasons.append(f"{label} supports the pair.")
    elif value < 45:
        reasons.append(f"{label} is weak or conflicts with the pair.")


def _add_threshold_reason(value: float, threshold: float, label: str, reasons: list[str]) -> None:
    reasons.append(f"{label} passed." if value >= threshold else f"{label} is below threshold.")


def _clamp(value: float) -> float:
    return max(0, min(100, value))


def _weighted_direction(frames: list[tuple[TimeframeBiasInput, float]], direction: str) -> float:
    return sum(
        weight * _clamp(frame.strength) * _clamp(frame.confidence) / 100
        for frame, weight in frames
        if frame.direction.lower() == direction.lower()
    )


def _higher_timeframe_conflict(request: MultiTimeframeBiasRequest, final_direction: str) -> float:
    if final_direction == "Neutral":
        return 50
    frames = [request.monthly, request.weekly, request.daily, request.h8, request.h4]
    aligned = sum(1 for frame in frames if frame.direction.lower() == final_direction.lower())
    return round((aligned / len(frames)) * 100, 2)


def _execution_confirmation(request: MultiTimeframeBiasRequest, final_direction: str) -> float:
    if final_direction == "Neutral":
        return 50
    frames = [request.h1, request.m15]
    score = sum(
        (_clamp(frame.strength) + _clamp(frame.confidence)) / 2 if frame.direction.lower() == final_direction.lower() else 0
        for frame in frames
    )
    return round(score / len(frames), 2)


def _normalize_bias_direction(direction: str) -> str:
    if direction.lower() in {"buy", "bullish"}:
        return "Bullish"
    if direction.lower() in {"sell", "bearish"}:
        return "Bearish"
    return "Neutral"


def _apply_risk_gates(request: HybridDecisionRequest, score: float, reasons: list[str]) -> None:
    if request.news_risk:
        reasons.append("High-impact news risk is active.")
    if request.spread_points > _max_spread_for(request.symbol):
        reasons.append("Spread is above the allowed execution limit.")
    if request.slippage_points > 5:
        reasons.append("Slippage is above the allowed execution limit.")
    if request.risk_reward < 2:
        reasons.append("Risk/reward is below 1:2.")
    if request.multi_timeframe_alignment_score < 65:
        reasons.append("Multi-timeframe bias alignment is below threshold.")
    if request.higher_timeframe_conflict_score < 70:
        reasons.append("Higher-timeframe conflict is too high.")
    if request.execution_timeframe_confirmation_score < 60:
        reasons.append("Execution timeframe confirmation is below threshold.")
    if request.macro_risk_score < 45:
        reasons.append("Macro risk score is below the tradable threshold.")
    if request.macro_bias_score < 50:
        reasons.append("Macro bias is not aligned with the trade idea.")
    if request.currency_strength_score < 55:
        reasons.append("Currency strength matrix does not confirm the pair.")
    if request.strategy_health_score < 60:
        reasons.append("Strategy health is below promotion threshold.")
    if request.historical_similarity_score < 55:
        reasons.append("Historical pattern similarity is below threshold.")
    if request.candle_intelligence_score < 60:
        reasons.append("Candle intelligence does not confirm directional pressure.")
    if request.h8_d1_projection_score < 55:
        reasons.append("H8-to-D1 projection does not support the setup.")
    if request.regime_model_score < 55:
        reasons.append("Regime classifier does not support this setup.")
    if request.ensemble_prediction_score < 65:
        reasons.append("Ensemble prediction score is below threshold.")
    if request.bayesian_confidence_score < 65:
        reasons.append("Bayesian confidence is below threshold.")
    if request.probability_calibration_score < 60:
        reasons.append("Probability calibration is below threshold.")
    if request.anomaly_score < 75:
        reasons.append("Anomaly detection flagged unsafe market or execution behavior.")
    if request.execution_quality_score < 70:
        reasons.append("Execution quality is below autonomous routing threshold.")
    if request.account_drawdown_percent >= 6:
        reasons.append("Account drawdown guardrail is active.")
    if request.daily_loss_percent >= 2:
        reasons.append("Daily loss guardrail is active.")
    if request.consecutive_losses >= 3:
        reasons.append("Consecutive loss circuit breaker is active.")
    if request.volatility_score < 25 or request.volatility_score > 85:
        reasons.append("Volatility is outside the tradable band.")
    if score >= 85 and not request.displacement and not request.retail_trend_aligned:
        reasons.append("Execution needs either institutional displacement or retail trend alignment.")


def _resolve_risk_percent(request: HybridDecisionRequest, confidence_score: float) -> float:
    base_risk = max(0.10, min(0.25, request.requested_risk_percent))
    if confidence_score < 90 or request.account_drawdown_percent > 3 or request.consecutive_losses > 0:
        return min(base_risk, 0.10)
    return base_risk


def _resolve_direction(request: HybridDecisionRequest) -> str:
    if request.higher_timeframe_bias.lower() == "bullish" and request.entry_timeframe_bias.lower() == "bullish":
        return "Buy"
    if request.higher_timeframe_bias.lower() == "bearish" and request.entry_timeframe_bias.lower() == "bearish":
        return "Sell"
    return "Wait"


def _resolve_strategy(request: HybridDecisionRequest) -> str:
    if request.liquidity_sweep and request.displacement:
        return "Liquidity Sweep Continuation"
    if request.order_block_retest:
        return "Order Block Mitigation"
    if request.fair_value_gap:
        return "Fair Value Gap Continuation"
    if request.pullback_confirmation:
        return "Pullback Continuation"
    return "A-Grade Confluence"


def _resolve_liquidity_target(request: HybridDecisionRequest, direction: str) -> str:
    if direction == "Buy":
        return f"{request.symbol.upper()} buy-side liquidity"
    if direction == "Sell":
        return f"{request.symbol.upper()} sell-side liquidity"
    return "None"


def _resolve_invalidation(direction: str) -> str:
    if direction == "Buy":
        return "Below sweep low or protected order block."
    if direction == "Sell":
        return "Above sweep high or protected order block."
    return "No executable invalidation."


def _bias_aligned(request: HybridDecisionRequest) -> bool:
    return request.higher_timeframe_bias.lower() != "neutral" and (
        request.higher_timeframe_bias.lower() == request.entry_timeframe_bias.lower()
    )


def _institutional_session(session: str) -> bool:
    return session.lower() in {"london", "new york", "london-new york overlap"}


def _tradable_regime(market_regime: str) -> bool:
    return market_regime.lower() in {"trending", "breakout", "pullback"}


def _max_spread_for(symbol: str) -> float:
    return 35 if symbol.upper() == "XAUUSD" else 20


def _normalize_mode(trading_mode: str) -> str:
    mode = trading_mode.lower()
    if mode == "institutional":
        return "Institutional"
    if mode == "retail":
        return "Retail"
    return "Hybrid"
