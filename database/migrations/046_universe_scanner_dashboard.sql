-- Card 03 / 20-Asset Universe Scanner Dashboard
-- Production-only scanner state, scores, readiness, AI summaries, alerts, and audit logs.

BEGIN;

CREATE SCHEMA IF NOT EXISTS market;

CREATE TABLE IF NOT EXISTS market.asset_universe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset text NOT NULL UNIQUE,
  asset_class text NOT NULL,
  broker_symbol text,
  status text NOT NULL DEFAULT 'Inactive',
  active boolean NOT NULL DEFAULT false,
  scanner_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_scan_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_key text UNIQUE NOT NULL,
  status text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  duration_ms integer,
  assets_requested integer NOT NULL DEFAULT 0,
  assets_scanned integer NOT NULL DEFAULT 0,
  triggered_by text NOT NULL DEFAULT 'system',
  readiness_status text,
  readiness_score numeric,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_scan_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.asset_scan_runs(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  asset text NOT NULL,
  asset_class text,
  broker_symbol text,
  status text NOT NULL DEFAULT 'Scanned',
  last_price numeric,
  spread numeric,
  qualification text NOT NULL DEFAULT 'Insufficient Data',
  rejection_reason text,
  blocking_module text,
  severity text,
  last_scanned timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_opportunity_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.asset_scan_runs(id) ON DELETE SET NULL,
  scan_result_id uuid REFERENCES market.asset_scan_results(id) ON DELETE CASCADE,
  asset text NOT NULL,
  direction text,
  trend_score numeric,
  momentum_score numeric,
  volatility_score numeric,
  liquidity_score numeric,
  institutional_score numeric,
  sentiment_score numeric,
  macro_score numeric,
  risk_score numeric,
  compliance_score numeric,
  confidence_score numeric,
  opportunity_score numeric,
  main_reason text,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.qualified_trade_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.asset_scan_runs(id) ON DELETE SET NULL,
  asset text NOT NULL,
  direction text NOT NULL,
  qualification text NOT NULL,
  opportunity_score numeric,
  confidence_score numeric,
  risk_score numeric,
  compliance_score numeric,
  main_reason text,
  prop_safe boolean NOT NULL DEFAULT false,
  institutional_setup boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'Ready',
  created_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.scanner_pipeline_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.asset_scan_runs(id) ON DELETE SET NULL,
  module_key text NOT NULL,
  module_name text NOT NULL,
  status text NOT NULL,
  last_run timestamptz,
  records_processed integer NOT NULL DEFAULT 0,
  duration_ms integer,
  health text NOT NULL DEFAULT 'Warning',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.scanner_health_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.asset_scan_runs(id) ON DELETE SET NULL,
  scanner_status text,
  worker_status text,
  queue_status text,
  last_full_scan timestamptz,
  average_scan_duration_ms integer,
  failed_scan_jobs integer NOT NULL DEFAULT 0,
  retry_count integer NOT NULL DEFAULT 0,
  data_freshness text,
  source_health text,
  dependency_health text,
  health_score numeric,
  observed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.scanner_ai_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.asset_scan_runs(id) ON DELETE SET NULL,
  best_opportunities text,
  weakest_assets text,
  main_market_theme text,
  risk_warnings text,
  scanner_confidence numeric,
  readiness_for_next_card text,
  recommended_next_action text,
  summary text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.scanner_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  title text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  status text NOT NULL DEFAULT 'Open',
  asset text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.scanner_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.asset_scan_runs(id) ON DELETE SET NULL,
  user_name text,
  action text NOT NULL,
  entity_type text NOT NULL DEFAULT 'universe_scanner_dashboard',
  entity_id text,
  before_value jsonb,
  after_value jsonb,
  reason text,
  ip_address text,
  environment text NOT NULL DEFAULT 'production',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asset_scan_runs_started ON market.asset_scan_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_asset_scan_results_asset ON market.asset_scan_results(asset, last_scanned DESC);
CREATE INDEX IF NOT EXISTS idx_asset_scores_asset ON market.asset_opportunity_scores(asset, calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_trade_candidates_score ON market.qualified_trade_candidates(opportunity_score DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scanner_pipeline_module ON market.scanner_pipeline_status(module_key, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_scanner_health_observed ON market.scanner_health_metrics(observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_scanner_audit_time ON market.scanner_audit_logs(created_at DESC);

INSERT INTO security.permissions (code, resource, action, description)
VALUES
  ('universe_scanner.dashboard.view', 'universe_scanner.dashboard', 'view', 'View Universe Scanner dashboard'),
  ('universe_scanner.dashboard.run_scan', 'universe_scanner.dashboard', 'run_scan', 'Run a live universe scan'),
  ('universe_scanner.dashboard.refresh', 'universe_scanner.dashboard', 'refresh', 'Refresh Universe Scanner dashboard'),
  ('universe_scanner.dashboard.export', 'universe_scanner.dashboard', 'export', 'Export Universe Scanner dashboard report'),
  ('universe_scanner.dashboard.create_alert', 'universe_scanner.dashboard', 'create_alert', 'Create Universe Scanner dashboard alerts')
ON CONFLICT (code) DO NOTHING;

COMMIT;
