-- Card 03 / Liquidity Scanner Engine
-- Production-only liquidity scores, zones, sweeps, voids, stop clusters, broker risk, AI summaries, alerts, and audit.

BEGIN;

CREATE SCHEMA IF NOT EXISTS market;

CREATE TABLE IF NOT EXISTS market.liquidity_scanner_runs (
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

CREATE TABLE IF NOT EXISTS market.asset_liquidity_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.liquidity_scanner_runs(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  asset text NOT NULL,
  asset_class text,
  nearest_buy_side_liquidity numeric,
  nearest_sell_side_liquidity numeric,
  liquidity_bias text NOT NULL DEFAULT 'Insufficient Data',
  buy_side_liquidity_score numeric,
  sell_side_liquidity_score numeric,
  equal_high_liquidity_score numeric,
  equal_low_liquidity_score numeric,
  liquidity_sweep_score numeric,
  liquidity_void_score numeric,
  stop_cluster_score numeric,
  broker_liquidity_score numeric,
  spread_risk_score numeric,
  execution_liquidity_score numeric,
  liquidity_score numeric,
  sweep_risk text,
  void_risk text,
  stop_cluster_risk text,
  execution_risk text,
  confidence numeric,
  qualification text NOT NULL DEFAULT 'Insufficient Data',
  last_scanned timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.asset_liquidity_timeframe_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.liquidity_scanner_runs(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  asset text NOT NULL,
  timeframe text NOT NULL,
  buy_side_status text,
  sell_side_status text,
  sweep_status text,
  liquidity_state text NOT NULL DEFAULT 'No Data',
  confidence numeric,
  observed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.asset_liquidity_rankings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.liquidity_scanner_runs(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  asset text NOT NULL,
  asset_class text,
  rank integer,
  nearest_buy_side_liquidity numeric,
  nearest_sell_side_liquidity numeric,
  liquidity_bias text,
  liquidity_score numeric,
  sweep_risk text,
  void_risk text,
  stop_cluster_risk text,
  broker_liquidity text,
  spread_risk text,
  execution_risk text,
  confidence numeric,
  qualification text NOT NULL DEFAULT 'Insufficient Data',
  last_scanned timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.asset_buy_side_liquidity_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.liquidity_scanner_runs(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  asset text NOT NULL,
  timeframe text,
  current_price numeric,
  liquidity_level numeric,
  liquidity_type text,
  distance numeric,
  strength text,
  sweep_probability numeric,
  trend_context text,
  recommended_action text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.asset_sell_side_liquidity_zones (LIKE market.asset_buy_side_liquidity_zones INCLUDING ALL);

CREATE TABLE IF NOT EXISTS market.asset_liquidity_sweeps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.liquidity_scanner_runs(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  asset text NOT NULL,
  timeframe text,
  sweep_type text,
  swept_level numeric,
  sweep_time timestamptz,
  confirmation text,
  reversal_probability numeric,
  continuation_probability numeric,
  confidence numeric,
  risk_level text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.asset_liquidity_voids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.liquidity_scanner_runs(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  asset text NOT NULL,
  timeframe text,
  void_type text,
  price_zone text,
  gap_size numeric,
  fill_probability numeric,
  direction text,
  status text,
  confidence numeric,
  observed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.asset_fair_value_gaps (LIKE market.asset_liquidity_voids INCLUDING ALL);

CREATE TABLE IF NOT EXISTS market.asset_stop_clusters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.liquidity_scanner_runs(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  asset text NOT NULL,
  cluster_location text,
  price_level numeric,
  cluster_type text,
  distance_from_price numeric,
  sweep_risk text,
  risk_level text,
  recommended_action text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.asset_liquidity_broker_risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.liquidity_scanner_runs(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  asset text NOT NULL,
  broker text,
  server text,
  current_spread numeric,
  average_spread numeric,
  spread_widening_percent numeric,
  broker_liquidity_score numeric,
  execution_quality text,
  slippage_risk text,
  tradeability text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.liquidity_scanner_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component_key text NOT NULL UNIQUE,
  component_name text NOT NULL,
  weight numeric NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_by text NOT NULL DEFAULT 'system',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.liquidity_scanner_ai_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  most_attractive_liquidity_targets text,
  recent_liquidity_sweeps text,
  potential_stop_hunt_setups text,
  liquidity_voids_likely_to_fill text,
  poor_broker_liquidity_assets text,
  high_spread_risk_assets text,
  best_liquidity_opportunities text,
  assets_to_avoid text,
  recommended_next_step text,
  summary text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.liquidity_scanner_alerts (
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

CREATE TABLE IF NOT EXISTS market.liquidity_scanner_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.liquidity_scanner_runs(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  user_name text,
  action text NOT NULL,
  entity_type text NOT NULL DEFAULT 'liquidity_scanner',
  entity_id text,
  before_value jsonb,
  after_value jsonb,
  reason text,
  ip_address text,
  environment text NOT NULL DEFAULT 'production',
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO market.liquidity_scanner_weights (component_key, component_name, weight)
VALUES
  ('swing_liquidity_zones', 'Swing Liquidity Zones', 20),
  ('equal_high_low_detection', 'Equal High / Equal Low Detection', 15),
  ('liquidity_sweep_detection', 'Liquidity Sweep Detection', 15),
  ('liquidity_void_inefficiency', 'Liquidity Void / Inefficiency', 10),
  ('stop_cluster_proximity', 'Stop Cluster Proximity', 10),
  ('broker_liquidity', 'Broker Liquidity', 10),
  ('spread_risk', 'Spread Risk', 10),
  ('execution_quality', 'Execution Quality', 5),
  ('news_event_adjustment', 'News/Event Adjustment', 5)
ON CONFLICT (component_key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_liquidity_scores_latest ON market.asset_liquidity_scores(asset, last_scanned DESC);
CREATE INDEX IF NOT EXISTS idx_liquidity_tf_latest ON market.asset_liquidity_timeframe_scores(asset, timeframe, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_liquidity_rankings_latest ON market.asset_liquidity_rankings(rank, last_scanned DESC);
CREATE INDEX IF NOT EXISTS idx_buy_side_liquidity_time ON market.asset_buy_side_liquidity_zones(observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_sell_side_liquidity_time ON market.asset_sell_side_liquidity_zones(observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_liquidity_sweeps_time ON market.asset_liquidity_sweeps(observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_liquidity_voids_time ON market.asset_liquidity_voids(observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_stop_clusters_time ON market.asset_stop_clusters(observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_liquidity_broker_risks_time ON market.asset_liquidity_broker_risks(observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_liquidity_runs_started ON market.liquidity_scanner_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_liquidity_alerts_time ON market.liquidity_scanner_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_liquidity_audit_time ON market.liquidity_scanner_audit_logs(created_at DESC);

INSERT INTO security.permissions (code, resource, action, description)
VALUES
  ('universe_scanner.liquidity.view', 'universe_scanner.liquidity', 'view', 'View Liquidity Scanner'),
  ('universe_scanner.liquidity.run_scan', 'universe_scanner.liquidity', 'run_scan', 'Run liquidity scans'),
  ('universe_scanner.liquidity.recalculate', 'universe_scanner.liquidity', 'recalculate', 'Recalculate liquidity scores'),
  ('universe_scanner.liquidity.configure_rules', 'universe_scanner.liquidity', 'configure_rules', 'Configure liquidity rules'),
  ('universe_scanner.liquidity.create_alert', 'universe_scanner.liquidity', 'create_alert', 'Create liquidity alerts'),
  ('universe_scanner.liquidity.export', 'universe_scanner.liquidity', 'export', 'Export liquidity report')
ON CONFLICT (code) DO NOTHING;

COMMIT;
