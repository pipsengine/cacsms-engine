BEGIN;

CREATE SCHEMA IF NOT EXISTS market;

CREATE TABLE IF NOT EXISTS market.market_environment_inputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  input_key text NOT NULL,
  input_name text NOT NULL,
  source text,
  status text NOT NULL DEFAULT 'UNKNOWN',
  freshness text,
  health numeric(7,4),
  weight numeric(7,4) NOT NULL DEFAULT 1,
  last_updated timestamptz,
  used_in_score boolean NOT NULL DEFAULT true,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.market_environment_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regime text,
  risk_tone text,
  volatility_regime text,
  liquidity_condition text,
  trend_strength numeric(7,4),
  range_probability numeric(7,4),
  news_sensitivity text,
  session_bias text,
  market_stress_level text,
  trading_suitability text,
  environment_score numeric(7,4),
  confidence numeric(7,4),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  calculated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.market_regime_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regime text NOT NULL,
  risk_tone text,
  environment_score numeric(7,4),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.instrument_environment_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument text NOT NULL,
  asset_class text,
  regime text,
  trend_strength numeric(7,4),
  volatility text,
  liquidity text,
  spread_condition text,
  news_risk text,
  session_bias text,
  environment_score numeric(7,4),
  trading_suitability text,
  confidence numeric(7,4),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.volatility_regime_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument text,
  atr numeric(14,6),
  average_daily_range numeric(14,6),
  realized_volatility numeric(14,6),
  implied_volatility numeric(14,6),
  volatility_rank numeric(7,4),
  volatility_percentile numeric(7,4),
  expansion_signal text,
  status text NOT NULL DEFAULT 'UNKNOWN',
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.risk_tone_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_tone text NOT NULL DEFAULT 'Unclear',
  equity_bias text,
  gold_bias text,
  jpy_bias text,
  chf_bias text,
  usd_bias text,
  oil_bias text,
  crypto_bias text,
  bond_yield_bias text,
  news_sentiment text,
  economic_surprise text,
  confidence numeric(7,4),
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.session_environment_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_name text NOT NULL,
  session_volatility text,
  session_direction text,
  session_liquidity text,
  session_spread_behaviour text,
  breakout_risk text,
  reversal_risk text,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.market_environment_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  title text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  status text NOT NULL DEFAULT 'OPEN',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.market_environment_ai_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  summary text NOT NULL,
  best_instruments text,
  worst_instruments text,
  trading_style_suitability text,
  news_event_risk text,
  volatility_warning text,
  liquidity_warning text,
  prop_firm_caution text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.market_environment_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  source text NOT NULL DEFAULT 'market_environment',
  status text NOT NULL DEFAULT 'RECORDED',
  actor text NOT NULL DEFAULT 'api',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_market_environment_inputs_time ON market.market_environment_inputs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_environment_scores_time ON market.market_environment_scores (calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_instrument_environment_time ON market.instrument_environment_states (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_volatility_regime_time ON market.volatility_regime_metrics (observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_tone_time ON market.risk_tone_metrics (observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_environment_time ON market.session_environment_metrics (observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_environment_audit_time ON market.market_environment_audit_logs (created_at DESC);

COMMIT;
