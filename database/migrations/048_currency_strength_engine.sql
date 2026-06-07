-- Card 03 / Currency Strength Engine
-- Production-only currency strength, pair ranking, rotation, divergence, heatmap, opportunities, alerts, and audit.

BEGIN;

CREATE SCHEMA IF NOT EXISTS market;

CREATE TABLE IF NOT EXISTS market.currency_strength_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  currency text NOT NULL,
  current_strength numeric,
  previous_strength numeric,
  strength_change numeric,
  momentum numeric,
  trend_direction text,
  volatility numeric,
  confidence numeric,
  strength_label text,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.currency_strength_matrix (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  currency text NOT NULL,
  timeframe text NOT NULL,
  strength_score numeric,
  direction text,
  confidence numeric,
  state text,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.currency_pair_strength_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pair text NOT NULL,
  base_currency text,
  quote_currency text,
  base_strength numeric,
  quote_strength numeric,
  strength_spread numeric,
  direction_bias text,
  trend_alignment text,
  momentum_alignment text,
  volatility_condition text,
  opportunity_score numeric,
  confidence numeric,
  qualification text NOT NULL DEFAULT 'Insufficient Data',
  calculated_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.currency_strength_rotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  currency text NOT NULL,
  previous_rank integer,
  current_rank integer,
  rank_change integer,
  rotation_type text,
  momentum numeric,
  confidence numeric,
  observed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.currency_strength_divergences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pair text NOT NULL,
  currency_strength_bias text,
  price_direction text,
  divergence_type text,
  severity text,
  trading_interpretation text,
  recommended_action text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.currency_strength_heatmap (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  currency text NOT NULL,
  timeframe text NOT NULL,
  strength_score numeric,
  direction text,
  confidence numeric,
  state text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.currency_strength_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pair text NOT NULL,
  direction text,
  strength_spread numeric,
  trend_confirmation text,
  momentum_confirmation text,
  risk_score numeric,
  confidence_score numeric,
  opportunity_score numeric,
  qualification text NOT NULL DEFAULT 'Insufficient Data',
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.currency_strength_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component_key text NOT NULL UNIQUE,
  component_name text NOT NULL,
  weight numeric NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_by text NOT NULL DEFAULT 'system',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.currency_strength_ai_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strongest_currencies text,
  weakest_currencies text,
  best_pair_combinations text,
  currency_rotation text,
  divergence_risks text,
  opportunity_candidates text,
  pairs_to_avoid text,
  scanner_readiness text,
  summary text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.currency_strength_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  title text NOT NULL,
  severity text NOT NULL DEFAULT 'Info',
  currency text,
  pair text,
  status text NOT NULL DEFAULT 'Open',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.currency_strength_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_name text,
  action text NOT NULL,
  entity_type text NOT NULL DEFAULT 'currency_strength',
  entity_id text,
  before_value jsonb,
  after_value jsonb,
  reason text,
  ip_address text,
  environment text NOT NULL DEFAULT 'production',
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO market.currency_strength_weights (component_key, component_name, weight)
VALUES
  ('price_relative_performance', 'Price Relative Performance', 30),
  ('multi_timeframe_momentum', 'Multi-Timeframe Momentum', 20),
  ('trend_alignment', 'Trend Alignment', 15),
  ('volatility_adjustment', 'Volatility Adjustment', 10),
  ('macro_bias', 'Macro Bias', 10),
  ('sentiment_bias', 'Sentiment Bias', 10),
  ('event_risk_adjustment', 'Event Risk Adjustment', 5)
ON CONFLICT (component_key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_currency_strength_scores_latest ON market.currency_strength_scores(currency, calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_currency_pair_strength_latest ON market.currency_pair_strength_scores(pair, calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_currency_strength_heatmap_latest ON market.currency_strength_heatmap(currency, timeframe, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_currency_strength_alerts_time ON market.currency_strength_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_currency_strength_audit_time ON market.currency_strength_audit_logs(created_at DESC);

INSERT INTO security.permissions (code, resource, action, description)
VALUES
  ('universe_scanner.currency_strength.view', 'universe_scanner.currency_strength', 'view', 'View Currency Strength Engine'),
  ('universe_scanner.currency_strength.recalculate', 'universe_scanner.currency_strength', 'recalculate', 'Recalculate currency strength'),
  ('universe_scanner.currency_strength.configure_weights', 'universe_scanner.currency_strength', 'configure_weights', 'Configure currency strength weights'),
  ('universe_scanner.currency_strength.create_alert', 'universe_scanner.currency_strength', 'create_alert', 'Create currency strength alerts'),
  ('universe_scanner.currency_strength.export', 'universe_scanner.currency_strength', 'export', 'Export currency strength report')
ON CONFLICT (code) DO NOTHING;

COMMIT;
