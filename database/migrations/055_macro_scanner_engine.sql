BEGIN;

CREATE SCHEMA IF NOT EXISTS market;

CREATE TABLE IF NOT EXISTS market.asset_macro_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid,
  asset_id uuid,
  asset text NOT NULL,
  asset_class text,
  macro_bias text,
  currency_bias text,
  central_bank_bias text,
  interest_rate_bias text,
  inflation_bias text,
  growth_bias text,
  yield_bias text,
  commodity_bias text,
  risk_tone text,
  macro_score numeric(7,4),
  confidence numeric(7,4),
  qualification text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_scanned timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_macro_component_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  score_id uuid,
  asset text NOT NULL,
  component_key text NOT NULL,
  component_name text NOT NULL,
  component_bias text,
  component_score numeric(7,4),
  confidence numeric(7,4),
  freshness text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_macro_rankings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid,
  rank integer,
  asset_id uuid,
  asset text NOT NULL,
  asset_class text,
  macro_bias text,
  currency_bias text,
  central_bank_bias text,
  rate_differential text,
  inflation_impact text,
  growth_impact text,
  yield_impact text,
  risk_tone_impact text,
  commodity_impact text,
  macro_score numeric(7,4),
  confidence numeric(7,4),
  qualification text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_scanned timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_currency_macro_bias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  currency text NOT NULL,
  economy text,
  inflation_trend text,
  growth_momentum text,
  central_bank_tone text,
  rate_direction text,
  yield_support text,
  employment_strength text,
  risk_sensitivity text,
  macro_bias text,
  confidence numeric(7,4),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_central_bank_alignment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  central_bank text NOT NULL,
  currency text,
  current_rate numeric(10,4),
  latest_decision text,
  policy_tone text,
  rate_path_bias text,
  inflation_concern text,
  growth_concern text,
  next_meeting timestamptz,
  currency_impact text,
  confidence numeric(7,4),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_yield_rate_impacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset text NOT NULL,
  base_currency_rate_bias text,
  quote_currency_rate_bias text,
  rate_differential_bias text,
  yield_direction text,
  real_yield_impact text,
  carry_trade_bias text,
  macro_interpretation text,
  confidence numeric(7,4),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_inflation_growth_impacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset text NOT NULL,
  currency_economy text,
  inflation_trend text,
  core_inflation text,
  growth_momentum text,
  pmi_direction text,
  employment_direction text,
  economic_surprise text,
  asset_impact text,
  confidence numeric(7,4),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_commodity_macro_drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset text NOT NULL,
  driver text,
  driver_direction text,
  affected_currency text,
  macro_impact text,
  risk_level text,
  confidence numeric(7,4),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_macro_divergences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset text NOT NULL,
  divergence_type text,
  macro_bias text,
  technical_bias text,
  sentiment_bias text,
  institutional_bias text,
  severity text,
  trading_interpretation text,
  recommended_action text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.macro_scanner_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component_key text NOT NULL UNIQUE,
  component_name text NOT NULL,
  weight numeric(7,4) NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.macro_scanner_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'Queued',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  duration_ms integer,
  assets_scanned integer NOT NULL DEFAULT 0,
  health text,
  triggered_by text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.macro_scanner_ai_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strongest_macro_bullish_assets text,
  strongest_macro_bearish_assets text,
  best_currency_macro_opportunities text,
  central_bank_divergence_opportunities text,
  yield_supported_opportunities text,
  inflation_growth_risks text,
  commodity_macro_themes text,
  macro_conflicts text,
  assets_to_monitor text,
  assets_to_avoid text,
  recommended_next_step text,
  summary text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.macro_scanner_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  title text NOT NULL,
  severity text NOT NULL DEFAULT 'Info',
  asset text,
  status text NOT NULL DEFAULT 'Open',
  created_by text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.macro_scanner_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid,
  user_name text NOT NULL DEFAULT 'api',
  action text NOT NULL,
  entity_type text,
  entity_id text,
  reason text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO market.macro_scanner_weights (component_key, component_name, weight) VALUES
  ('currency_macro_bias','Currency Macro Bias',20),
  ('central_bank_tone','Central Bank Tone',15),
  ('interest_rate_differential','Interest Rate Differential',15),
  ('inflation_trend','Inflation Trend',10),
  ('growth_momentum','Growth Momentum',10),
  ('yield_support','Yield Support',10),
  ('risk_tone','Risk Tone',10),
  ('commodity_driver','Commodity Driver',5),
  ('source_freshness_confidence','Source Freshness / Confidence',5)
ON CONFLICT (component_key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_asset_macro_scores_asset_time ON market.asset_macro_scores (asset, last_scanned DESC);
CREATE INDEX IF NOT EXISTS idx_asset_macro_rankings_rank ON market.asset_macro_rankings (rank, last_scanned DESC);
CREATE INDEX IF NOT EXISTS idx_asset_macro_components_asset ON market.asset_macro_component_scores (asset, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_asset_macro_divergences_asset ON market.asset_macro_divergences (asset, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_macro_scanner_alerts_time ON market.macro_scanner_alerts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_macro_scanner_audit_time ON market.macro_scanner_audit_logs (created_at DESC);

COMMIT;
