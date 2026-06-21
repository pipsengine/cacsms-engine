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


class HybridDecisionRequest(BaseModel):
    symbol: str
    trading_mode: str = "Hybrid"
    timeframe: str = "M15"
    session: str = "London"
    market_regime: str = "Trending"
    higher_timeframe_bias: str = "Neutral"
    entry_timeframe_bias: str = "Neutral"
    multi_timeframe_alignment_score: float = 50
    higher_timeframe_conflict_score: float = 100
    execution_timeframe_confirmation_score: float = 50
    spread_points: float = 0
    slippage_points: float = 0
    risk_reward: float = 0
    news_risk: bool = False
    liquidity_sweep: bool = False
    displacement: bool = False
    fair_value_gap: bool = False
    order_block_retest: bool = False
    break_of_structure: bool = False
    retail_trend_aligned: bool = False
    support_resistance_confirmation: bool = False
    pullback_confirmation: bool = False
    macro_bias_score: float = 50
    interest_rate_differential_score: float = 50
    cot_positioning_score: float = 50
    currency_strength_score: float = 50
    macro_risk_score: float = 50
    regime_model_score: float = 50
    historical_similarity_score: float = 50
    candle_intelligence_score: float = 50
    h8_d1_projection_score: float = 50
    ensemble_prediction_score: float = 50
    bayesian_confidence_score: float = 50
    probability_calibration_score: float = 50
    anomaly_score: float = 100
    execution_quality_score: float = 50
    volatility_score: float = 50
    strategy_health_score: float = 50
    account_drawdown_percent: float = 0
    daily_loss_percent: float = 0
    consecutive_losses: int = 0
    requested_risk_percent: float = 0.25


class HybridDecisionResponse(BaseModel):
    symbol: str
    trading_mode: str
    recommendation: str
    direction: str
    confidence_score: float
    top_down_bias_score: float
    macro_score: float
    advanced_algorithm_score: float
    market_memory_score: float
    institutional_score: float
    retail_score: float
    hybrid_score: float
    approved_risk_percent: float
    approved_strategy: str
    liquidity_target: str
    invalidation_level: str
    expires_in_minutes: int
    no_trade_reasons: list[str]
    evidence: list[str]


class MacroIntelligenceRequest(BaseModel):
    base_currency: str
    quote_currency: str
    base_currency_strength: float
    quote_currency_strength: float
    interest_rate_differential_score: float
    cot_positioning_score: float
    central_bank_bias_score: float
    macro_risk_score: float


class MacroIntelligenceResponse(BaseModel):
    pair: str
    macro_bias_score: float
    currency_strength_score: float
    interest_rate_differential_score: float
    cot_positioning_score: float
    central_bank_bias_score: float
    macro_risk_score: float
    recommendation: str
    reasons: list[str]


class AdvancedAlgorithmRequest(BaseModel):
    regime_model_score: float
    rules_model_score: float
    statistical_model_score: float
    pattern_classifier_score: float
    macro_model_score: float
    bayesian_prior: float
    evidence_strength: float
    probability_calibration_score: float
    walk_forward_validation_score: float
    anomaly_score: float
    execution_quality_score: float
    strategy_decay_score: float


class AdvancedAlgorithmResponse(BaseModel):
    ensemble_prediction_score: float
    bayesian_confidence_score: float
    advanced_algorithm_score: float
    recommendation: str
    reasons: list[str]


class MarketMemoryRequest(BaseModel):
    historical_similarity_score: float
    similar_case_win_rate: float
    candle_body_score: float
    wick_rejection_score: float
    close_location_score: float
    candle_sequence_score: float
    asian_h8_score: float
    london_h8_score: float
    new_york_h8_score: float
    d1_projection_confidence: float


class MarketMemoryResponse(BaseModel):
    historical_pattern_score: float
    candle_intelligence_score: float
    h8_d1_projection_score: float
    market_memory_score: float
    recommendation: str
    reasons: list[str]


class TimeframeBiasInput(BaseModel):
    timeframe: str
    direction: str
    strength: float
    confidence: float


class MultiTimeframeBiasRequest(BaseModel):
    monthly: TimeframeBiasInput
    weekly: TimeframeBiasInput
    daily: TimeframeBiasInput
    h8: TimeframeBiasInput
    h4: TimeframeBiasInput
    h1: TimeframeBiasInput
    m15: TimeframeBiasInput
    intended_direction: str = "Buy"


class MultiTimeframeBiasResponse(BaseModel):
    final_bias: str
    alignment_score: float
    higher_timeframe_conflict_score: float
    execution_timeframe_confirmation_score: float
    trade_permission: str
    reasons: list[str]
