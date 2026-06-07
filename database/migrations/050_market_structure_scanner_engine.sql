-- Card 03 / Market Structure Scanner Engine
-- Production-only structure scores, MTF matrix, BOS, CHOCH, swing points, AI summaries, alerts, and audit.

BEGIN;

CREATE SCHEMA IF NOT EXISTS market;

CREATE TABLE IF NOT EXISTS market.market_structure_scanner_runs (
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

CREATE TABLE IF NOT EXISTS market.asset_market_structure_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.market_structure_scanner_runs(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  asset text NOT NULL,
  asset_class text,
  overall_structure text NOT NULL DEFAULT 'Insufficient Data',
  last_swing_pattern text,
  latest_signal text,
  signal_direction text,
  structure_score numeric,
  alignment_score numeric,
  confidence numeric,
  opportunity_impact text,
  qualification text NOT NULL DEFAULT 'Insufficient Data',
  last_scanned timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.asset_market_structure_timeframe_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.market_structure_scanner_runs(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  asset text NOT NULL,
  timeframe text NOT NULL,
  structure_direction text NOT NULL DEFAULT 'No Data',
  last_swing_status text,
  bos_choch_status text,
  confidence numeric,
  state text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.asset_market_structure_rankings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.market_structure_scanner_runs(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  asset text NOT NULL,
  asset_class text,
  rank integer,
  overall_structure text,
  last_swing_pattern text,
  latest_signal text,
  signal_direction text,
  structure_score numeric,
  alignment_score numeric,
  confidence numeric,
  opportunity_impact text,
  qualification text NOT NULL DEFAULT 'Insufficient Data',
  last_scanned timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.asset_swing_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.market_structure_scanner_runs(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  asset text NOT NULL,
  timeframe text NOT NULL,
  latest_swing_high numeric,
  latest_swing_high_time timestamptz,
  latest_swing_low numeric,
  latest_swing_low_time timestamptz,
  previous_swing_high numeric,
  previous_swing_low numeric,
  current_price numeric,
  distance_to_high numeric,
  distance_to_low numeric,
  structure_context text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.asset_bos_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.market_structure_scanner_runs(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  asset text NOT NULL,
  timeframe text,
  direction text,
  broken_level numeric,
  break_type text,
  confirmation_type text,
  candle_close numeric,
  retest_status text,
  confidence numeric,
  recommended_action text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.asset_choch_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.market_structure_scanner_runs(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  asset text NOT NULL,
  timeframe text,
  previous_structure text,
  new_structure text,
  choch_level numeric,
  confirmation text,
  reversal_probability numeric,
  risk_level text,
  confidence numeric,
  recommended_action text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.asset_structure_shift_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.market_structure_scanner_runs(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  asset text NOT NULL,
  shift_type text,
  previous_structure text,
  new_structure text,
  confidence numeric,
  observed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.market_structure_scanner_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component_key text NOT NULL UNIQUE,
  component_name text NOT NULL,
  weight numeric NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_by text NOT NULL DEFAULT 'system',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.market_structure_ai_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strongest_bullish_structures text,
  strongest_bearish_structures text,
  recent_bos_signals text,
  recent_choch_signals text,
  potential_reversals text,
  false_break_risks text,
  assets_to_monitor text,
  assets_to_avoid text,
  recommended_next_step text,
  summary text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.market_structure_alerts (
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

CREATE TABLE IF NOT EXISTS market.market_structure_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.market_structure_scanner_runs(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  user_name text,
  action text NOT NULL,
  entity_type text NOT NULL DEFAULT 'market_structure_scanner',
  entity_id text,
  before_value jsonb,
  after_value jsonb,
  reason text,
  ip_address text,
  environment text NOT NULL DEFAULT 'production',
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO market.market_structure_scanner_weights (component_key, component_name, weight)
VALUES
  ('swing_structure', 'Swing Structure', 25),
  ('break_confirmation', 'Break Confirmation', 20),
  ('multi_timeframe_alignment', 'Multi-Timeframe Alignment', 15),
  ('trend_confirmation', 'Trend Confirmation', 15),
  ('liquidity_context', 'Liquidity Context', 10),
  ('volatility_adjustment', 'Volatility Adjustment', 10),
  ('recency', 'Recency', 5)
ON CONFLICT (component_key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_market_structure_scores_latest ON market.asset_market_structure_scores(asset, last_scanned DESC);
CREATE INDEX IF NOT EXISTS idx_market_structure_tf_latest ON market.asset_market_structure_timeframe_scores(asset, timeframe, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_structure_rankings_latest ON market.asset_market_structure_rankings(rank, last_scanned DESC);
CREATE INDEX IF NOT EXISTS idx_market_structure_runs_started ON market.market_structure_scanner_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_structure_alerts_time ON market.market_structure_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_structure_audit_time ON market.market_structure_audit_logs(created_at DESC);

INSERT INTO security.permissions (code, resource, action, description)
VALUES
  ('universe_scanner.market_structure.view', 'universe_scanner.market_structure', 'view', 'View Market Structure Scanner'),
  ('universe_scanner.market_structure.run_scan', 'universe_scanner.market_structure', 'run_scan', 'Run market structure scans'),
  ('universe_scanner.market_structure.recalculate', 'universe_scanner.market_structure', 'recalculate', 'Recalculate market structure scores'),
  ('universe_scanner.market_structure.configure_rules', 'universe_scanner.market_structure', 'configure_rules', 'Configure market structure rules'),
  ('universe_scanner.market_structure.create_alert', 'universe_scanner.market_structure', 'create_alert', 'Create market structure alerts'),
  ('universe_scanner.market_structure.export', 'universe_scanner.market_structure', 'export', 'Export market structure report')
ON CONFLICT (code) DO NOTHING;

COMMIT;
