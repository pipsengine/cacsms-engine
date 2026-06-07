-- Card 03 / Institutional Scanner Engine
-- Production-only institutional scanner scores, COT alignment, SMC, order blocks, FVGs, liquidity confirmations, AI summaries, alerts, and audit.

BEGIN;

CREATE SCHEMA IF NOT EXISTS market;

CREATE TABLE IF NOT EXISTS market.institutional_scanner_runs (
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

CREATE TABLE IF NOT EXISTS market.asset_institutional_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.institutional_scanner_runs(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  asset text NOT NULL,
  asset_class text,
  institutional_bias text NOT NULL DEFAULT 'Insufficient Data',
  cot_bias text,
  smart_money_bias text,
  accumulation_distribution text,
  liquidity_confirmation text,
  order_block_signal text,
  fvg_signal text,
  cot_alignment_score numeric,
  smart_money_bias_score numeric,
  accumulation_score numeric,
  distribution_score numeric,
  order_block_score numeric,
  fair_value_gap_score numeric,
  liquidity_sweep_confirmation_score numeric,
  market_structure_confirmation_score numeric,
  institutional_score numeric,
  confidence numeric,
  qualification text NOT NULL DEFAULT 'Insufficient Data',
  last_scanned timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.asset_institutional_timeframe_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.institutional_scanner_runs(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  asset text NOT NULL,
  timeframe text NOT NULL,
  institutional_bias text NOT NULL DEFAULT 'No Data',
  smc_signal text,
  liquidity_confirmation text,
  confidence numeric,
  observed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.asset_institutional_rankings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.institutional_scanner_runs(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  asset text NOT NULL,
  asset_class text,
  rank integer,
  institutional_bias text,
  cot_bias text,
  smart_money_bias text,
  accumulation_distribution text,
  liquidity_confirmation text,
  order_block_signal text,
  fvg_signal text,
  institutional_score numeric,
  confidence numeric,
  qualification text NOT NULL DEFAULT 'Insufficient Data',
  last_scanned timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.asset_cot_alignment_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.institutional_scanner_runs(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  asset text NOT NULL,
  cot_market text,
  commercial_net numeric,
  large_spec_net numeric,
  small_spec_net numeric,
  open_interest numeric,
  weekly_change numeric,
  cot_bias text,
  cot_alignment text,
  extreme_positioning text,
  last_report_date date,
  observed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.asset_accumulation_distribution_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.institutional_scanner_runs(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  asset text NOT NULL,
  timeframe text,
  state text,
  evidence text,
  structure_context text,
  volume_tick_context text,
  liquidity_context text,
  confidence numeric,
  recommended_action text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.asset_smart_money_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.institutional_scanner_runs(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  asset text NOT NULL,
  smc_signal text,
  direction text,
  timeframe text,
  price_zone text,
  strength text,
  confirmation text,
  invalidation_level numeric,
  status text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.asset_institutional_liquidity_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.institutional_scanner_runs(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  asset text NOT NULL,
  sweep_type text,
  swept_level numeric,
  sweep_time timestamptz,
  structure_reaction text,
  institutional_confirmation text,
  reversal_probability numeric,
  continuation_probability numeric,
  confidence numeric,
  observed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.asset_order_block_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.institutional_scanner_runs(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  asset text NOT NULL,
  signal_type text,
  direction text,
  timeframe text,
  price_zone text,
  created_at_signal timestamptz,
  mitigation_status text,
  strength text,
  confidence numeric,
  observed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.asset_fair_value_gap_signals (LIKE market.asset_order_block_signals INCLUDING ALL);

CREATE TABLE IF NOT EXISTS market.institutional_scanner_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component_key text NOT NULL UNIQUE,
  component_name text NOT NULL,
  weight numeric NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_by text NOT NULL DEFAULT 'system',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.institutional_scanner_ai_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strongest_institutional_buy_assets text,
  strongest_institutional_sell_assets text,
  cot_aligned_opportunities text,
  cot_divergent_warnings text,
  accumulation_zones text,
  distribution_zones text,
  smart_money_setups text,
  liquidity_sweep_confirmations text,
  institutional_opportunities_to_monitor text,
  assets_to_avoid text,
  recommended_next_step text,
  summary text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.institutional_scanner_alerts (
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

CREATE TABLE IF NOT EXISTS market.institutional_scanner_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.institutional_scanner_runs(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  user_name text,
  action text NOT NULL,
  entity_type text NOT NULL DEFAULT 'institutional_scanner',
  entity_id text,
  before_value jsonb,
  after_value jsonb,
  reason text,
  ip_address text,
  environment text NOT NULL DEFAULT 'production',
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO market.institutional_scanner_weights (component_key, component_name, weight)
VALUES
  ('cot_alignment', 'COT Alignment', 20),
  ('smart_money_bias', 'Smart Money Bias', 20),
  ('liquidity_sweep_confirmation', 'Liquidity Sweep Confirmation', 15),
  ('market_structure_confirmation', 'Market Structure Confirmation', 15),
  ('accumulation_distribution', 'Accumulation / Distribution', 10),
  ('order_blocks_fvg', 'Order Blocks / FVG', 10),
  ('macro_confirmation', 'Macro Confirmation', 5),
  ('sentiment_confirmation', 'Sentiment Confirmation', 5)
ON CONFLICT (component_key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_institutional_scanner_scores_latest ON market.asset_institutional_scores(asset, last_scanned DESC);
CREATE INDEX IF NOT EXISTS idx_institutional_scanner_tf_latest ON market.asset_institutional_timeframe_scores(asset, timeframe, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_institutional_scanner_rankings_latest ON market.asset_institutional_rankings(rank, last_scanned DESC);
CREATE INDEX IF NOT EXISTS idx_institutional_cot_alignment_time ON market.asset_cot_alignment_scores(observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_institutional_accdist_time ON market.asset_accumulation_distribution_signals(observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_institutional_smc_time ON market.asset_smart_money_signals(observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_institutional_liq_conf_time ON market.asset_institutional_liquidity_confirmations(observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_institutional_order_blocks_time ON market.asset_order_block_signals(observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_institutional_fvg_time ON market.asset_fair_value_gap_signals(observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_institutional_scanner_runs_started ON market.institutional_scanner_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_institutional_scanner_alerts_time ON market.institutional_scanner_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_institutional_scanner_audit_time ON market.institutional_scanner_audit_logs(created_at DESC);

INSERT INTO security.permissions (code, resource, action, description)
VALUES
  ('universe_scanner.institutional.view', 'universe_scanner.institutional', 'view', 'View Institutional Scanner'),
  ('universe_scanner.institutional.run_scan', 'universe_scanner.institutional', 'run_scan', 'Run institutional scans'),
  ('universe_scanner.institutional.recalculate', 'universe_scanner.institutional', 'recalculate', 'Recalculate institutional scores'),
  ('universe_scanner.institutional.configure_rules', 'universe_scanner.institutional', 'configure_rules', 'Configure institutional rules'),
  ('universe_scanner.institutional.create_alert', 'universe_scanner.institutional', 'create_alert', 'Create institutional alerts'),
  ('universe_scanner.institutional.export', 'universe_scanner.institutional', 'export', 'Export institutional report')
ON CONFLICT (code) DO NOTHING;

COMMIT;
