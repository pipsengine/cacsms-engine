BEGIN;

CREATE SCHEMA IF NOT EXISTS market;

CREATE TABLE IF NOT EXISTS market.macro_data_inputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  input_key text NOT NULL,
  input_name text NOT NULL,
  provider text,
  status text NOT NULL DEFAULT 'UNKNOWN',
  freshness text,
  health numeric(7,4),
  weight numeric(7,4) NOT NULL DEFAULT 1,
  last_updated timestamptz,
  used_in_macro_score boolean NOT NULL DEFAULT true,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.macro_intelligence_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  global_macro_regime text,
  risk_tone text,
  inflation_pressure text,
  growth_momentum text,
  central_bank_bias text,
  yield_direction text,
  usd_macro_bias text,
  gold_macro_bias text,
  oil_macro_bias text,
  equity_macro_bias text,
  recession_risk text,
  macro_confidence numeric(7,4),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  calculated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.currency_macro_bias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  currency text NOT NULL,
  economy text,
  inflation_trend text,
  growth_momentum text,
  central_bank_tone text,
  yield_support text,
  employment_strength text,
  risk_sensitivity text,
  macro_bias text,
  confidence numeric(7,4),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.central_bank_policy_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  central_bank text NOT NULL,
  current_rate numeric(10,4),
  latest_decision text,
  policy_tone text,
  inflation_concern text,
  growth_concern text,
  next_meeting timestamptz,
  rate_path_bias text,
  market_expectation text,
  currency_impact text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.inflation_growth_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name text NOT NULL,
  latest numeric(14,6),
  previous numeric(14,6),
  forecast numeric(14,6),
  deviation numeric(14,6),
  trend_direction text,
  market_impact text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.yield_rate_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name text NOT NULL,
  latest numeric(14,6),
  previous numeric(14,6),
  direction text,
  usd_bias text,
  jpy_bias text,
  gold_impact text,
  equity_impact text,
  carry_trade_condition text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.cross_asset_macro_impacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset text NOT NULL,
  macro_bias text,
  primary_driver text,
  secondary_driver text,
  risk_tone_impact text,
  yield_impact text,
  commodity_impact text,
  trading_suitability text,
  confidence numeric(7,4),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.macro_regime_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regime text NOT NULL,
  trigger text,
  affected_markets text,
  confidence numeric(7,4),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.macro_ai_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  summary text NOT NULL,
  strongest_currencies text,
  weakest_currencies text,
  central_bank_divergence text,
  inflation_risks text,
  growth_risks text,
  yield_rate_impact text,
  cross_asset_implications text,
  trading_caution text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.macro_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  title text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  status text NOT NULL DEFAULT 'OPEN',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.macro_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  source text NOT NULL DEFAULT 'macro_intelligence',
  status text NOT NULL DEFAULT 'RECORDED',
  actor text NOT NULL DEFAULT 'api',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_macro_inputs_time ON market.macro_data_inputs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_macro_scores_time ON market.macro_intelligence_scores (calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_currency_macro_time ON market.currency_macro_bias (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_central_bank_policy_time ON market.central_bank_policy_states (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_inflation_growth_time ON market.inflation_growth_metrics (observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_yield_rate_time ON market.yield_rate_metrics (observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_cross_asset_macro_time ON market.cross_asset_macro_impacts (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_macro_regime_time ON market.macro_regime_history (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_macro_audit_time ON market.macro_audit_logs (created_at DESC);

COMMIT;
