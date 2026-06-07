-- Card 03 / Momentum Scanner Engine
-- Production-only momentum scores, MTF matrix, acceleration, deceleration, divergence, exhaustion, AI summaries, alerts, and audit.

BEGIN;

CREATE SCHEMA IF NOT EXISTS market;

CREATE TABLE IF NOT EXISTS market.momentum_scanner_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_key text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'Queued',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  duration_ms integer,
  assets_scanned integer NOT NULL DEFAULT 0,
  triggered_by text NOT NULL DEFAULT 'system',
  health text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_momentum_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.momentum_scanner_runs(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  asset text NOT NULL,
  asset_class text,
  overall_momentum text NOT NULL DEFAULT 'Insufficient Data',
  momentum_score numeric,
  momentum_direction text,
  momentum_strength_score numeric,
  acceleration_score numeric,
  deceleration_score numeric,
  alignment_score numeric,
  divergence_score numeric,
  exhaustion_risk numeric,
  confidence numeric,
  opportunity_impact text,
  qualification text NOT NULL DEFAULT 'Insufficient Data',
  last_scanned timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.asset_momentum_timeframe_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.momentum_scanner_runs(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  asset text NOT NULL,
  timeframe text NOT NULL,
  momentum_direction text NOT NULL DEFAULT 'No Data',
  momentum_strength numeric,
  acceleration_state text,
  confidence numeric,
  state text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.asset_momentum_rankings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.momentum_scanner_runs(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  asset text NOT NULL,
  asset_class text,
  rank integer,
  overall_momentum text,
  momentum_score numeric,
  momentum_direction text,
  acceleration text,
  deceleration text,
  divergence_signal text,
  exhaustion_risk text,
  confidence numeric,
  opportunity_impact text,
  qualification text NOT NULL DEFAULT 'Insufficient Data',
  last_scanned timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.asset_momentum_acceleration_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.momentum_scanner_runs(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  asset text NOT NULL,
  direction text,
  previous_momentum numeric,
  current_momentum numeric,
  momentum_change numeric,
  acceleration_score numeric,
  trend_support text,
  structure_support text,
  confidence numeric,
  recommended_action text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.asset_momentum_deceleration_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.momentum_scanner_runs(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  asset text NOT NULL,
  direction text,
  previous_momentum numeric,
  current_momentum numeric,
  momentum_change numeric,
  deceleration_score numeric,
  exhaustion_risk text,
  risk_level text,
  recommended_action text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.asset_momentum_divergence_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.momentum_scanner_runs(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  asset text NOT NULL,
  timeframe text,
  divergence_type text,
  price_pattern text,
  indicator_pattern text,
  signal_strength numeric,
  confirmation_status text,
  risk_level text,
  confidence numeric,
  observed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.asset_momentum_exhaustion_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.momentum_scanner_runs(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  asset text NOT NULL,
  direction text,
  exhaustion_type text,
  exhaustion_score numeric,
  trend_age text,
  divergence_present boolean,
  liquidity_risk text,
  reversal_warning text,
  confidence numeric,
  observed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.momentum_scanner_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component_key text NOT NULL UNIQUE,
  component_name text NOT NULL,
  weight numeric NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_by text NOT NULL DEFAULT 'system',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.momentum_scanner_ai_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strongest_momentum_assets text,
  weakest_momentum_assets text,
  best_acceleration_opportunities text,
  deceleration_risks text,
  divergence_warnings text,
  exhaustion_risks text,
  assets_to_monitor text,
  assets_to_avoid text,
  recommended_next_step text,
  summary text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.momentum_scanner_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  title text NOT NULL,
  severity text NOT NULL DEFAULT 'Info',
  asset text,
  status text NOT NULL DEFAULT 'Open',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.momentum_scanner_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.momentum_scanner_runs(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  user_name text,
  action text NOT NULL,
  entity_type text NOT NULL DEFAULT 'momentum_scanner',
  entity_id text,
  before_value jsonb,
  after_value jsonb,
  reason text,
  ip_address text,
  environment text NOT NULL DEFAULT 'production',
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO market.momentum_scanner_weights (component_key, component_name, weight)
VALUES
  ('rate_of_change', 'Rate of Change', 20),
  ('rsi_momentum', 'RSI Momentum', 15),
  ('macd_momentum', 'MACD Momentum', 15),
  ('candle_displacement', 'Candle Displacement', 15),
  ('impulse_strength', 'Impulse Strength', 10),
  ('multi_timeframe_alignment', 'Multi-Timeframe Alignment', 10),
  ('volume_tick_confirmation', 'Volume / Tick Confirmation', 10),
  ('trend_structure_confirmation', 'Trend / Structure Confirmation', 5)
ON CONFLICT (component_key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_momentum_scores_latest ON market.asset_momentum_scores(asset, last_scanned DESC);
CREATE INDEX IF NOT EXISTS idx_momentum_tf_latest ON market.asset_momentum_timeframe_scores(asset, timeframe, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_momentum_rankings_latest ON market.asset_momentum_rankings(rank, last_scanned DESC);
CREATE INDEX IF NOT EXISTS idx_momentum_acceleration_time ON market.asset_momentum_acceleration_signals(observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_momentum_deceleration_time ON market.asset_momentum_deceleration_signals(observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_momentum_divergence_time ON market.asset_momentum_divergence_signals(observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_momentum_exhaustion_time ON market.asset_momentum_exhaustion_signals(observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_momentum_runs_started ON market.momentum_scanner_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_momentum_alerts_time ON market.momentum_scanner_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_momentum_audit_time ON market.momentum_scanner_audit_logs(created_at DESC);

INSERT INTO security.permissions (code, resource, action, description)
VALUES
  ('universe_scanner.momentum.view', 'universe_scanner.momentum', 'view', 'View Momentum Scanner'),
  ('universe_scanner.momentum.run_scan', 'universe_scanner.momentum', 'run_scan', 'Run momentum scans'),
  ('universe_scanner.momentum.recalculate', 'universe_scanner.momentum', 'recalculate', 'Recalculate momentum scores'),
  ('universe_scanner.momentum.configure_rules', 'universe_scanner.momentum', 'configure_rules', 'Configure momentum rules'),
  ('universe_scanner.momentum.create_alert', 'universe_scanner.momentum', 'create_alert', 'Create momentum alerts'),
  ('universe_scanner.momentum.export', 'universe_scanner.momentum', 'export', 'Export momentum report')
ON CONFLICT (code) DO NOTHING;

COMMIT;
