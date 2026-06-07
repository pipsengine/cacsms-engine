BEGIN;
CREATE SCHEMA IF NOT EXISTS market;

CREATE TABLE IF NOT EXISTS market.asset_prop_compliance_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid,
  asset_id uuid,
  asset text NOT NULL,
  asset_class text,
  firm text,
  account text,
  daily_drawdown_score numeric(7,4),
  max_drawdown_score numeric(7,4),
  news_restriction_score numeric(7,4),
  consistency_score numeric(7,4),
  instrument_restriction_score numeric(7,4),
  portfolio_exposure_score numeric(7,4),
  compliance_score numeric(7,4),
  trade_eligibility text,
  primary_constraint text,
  confidence numeric(7,4),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_scanned timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_prop_compliance_component_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset text NOT NULL,
  component_key text NOT NULL,
  component_name text NOT NULL,
  score numeric(7,4),
  status text,
  confidence numeric(7,4),
  freshness text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_prop_compliance_rankings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid,
  rank integer,
  asset_id uuid,
  asset text NOT NULL,
  asset_class text,
  firm text,
  account text,
  compliance_score numeric(7,4),
  trade_eligibility text,
  primary_constraint text,
  daily_drawdown_status text,
  max_drawdown_status text,
  news_status text,
  consistency_status text,
  instrument_status text,
  confidence numeric(7,4),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_scanned timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_prop_news_restrictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset text NOT NULL,
  firm text,
  account text,
  event_name text,
  currency text,
  impact text,
  restriction_window text,
  rule_status text,
  trade_action text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_prop_drawdown_risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset text NOT NULL,
  firm text,
  account text,
  daily_loss_used_percent numeric(10,4),
  max_drawdown_used_percent numeric(10,4),
  daily_limit_percent numeric(10,4),
  max_limit_percent numeric(10,4),
  remaining_daily_buffer text,
  remaining_max_buffer text,
  drawdown_status text,
  recommended_action text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_prop_consistency_risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset text NOT NULL,
  firm text,
  account text,
  consistency_rule text,
  largest_trade_share numeric(10,4),
  profit_distribution text,
  status text,
  recommendation text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_prop_instrument_restrictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset text NOT NULL,
  firm text,
  rule_type text,
  allowed boolean,
  restriction_reason text,
  weekend_holding_allowed boolean,
  ea_allowed boolean,
  copy_trading_allowed boolean,
  status text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_prop_blocked_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset text NOT NULL,
  firm text,
  account text,
  block_reason text,
  severity text,
  expires_at timestamptz,
  recommended_action text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_prop_compliance_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset text NOT NULL,
  firm text,
  account text,
  compliance_driver text,
  recommendation text,
  priority text,
  expected_effect text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.prop_compliance_scanner_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component_key text NOT NULL UNIQUE,
  component_name text NOT NULL,
  weight numeric(7,4) NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.prop_compliance_scanner_runs (
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

CREATE TABLE IF NOT EXISTS market.prop_compliance_scanner_ai_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  safest_assets text,
  restricted_assets text,
  blocked_assets text,
  drawdown_risks text,
  news_restrictions text,
  consistency_risks text,
  recommended_next_step text,
  summary text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.prop_compliance_scanner_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  title text NOT NULL,
  severity text NOT NULL DEFAULT 'Info',
  asset text,
  account text,
  status text NOT NULL DEFAULT 'Open',
  created_by text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.prop_compliance_scanner_audit_logs (
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

INSERT INTO market.prop_compliance_scanner_weights (component_key, component_name, weight) VALUES
  ('daily_drawdown','Daily Drawdown',22),
  ('max_drawdown','Max Drawdown',22),
  ('news_restriction','News Restriction',18),
  ('consistency','Consistency Rule',15),
  ('instrument_restriction','Instrument Restriction',13),
  ('portfolio_exposure','Portfolio Exposure',10)
ON CONFLICT (component_key) DO NOTHING;

INSERT INTO security.permissions (code, resource, action, description) VALUES
  ('universe_scanner.prop_compliance.view','universe_scanner.prop_compliance','view','View prop firm compliance scanner'),
  ('universe_scanner.prop_compliance.run_scan','universe_scanner.prop_compliance','run_scan','Run prop firm compliance scan'),
  ('universe_scanner.prop_compliance.recalculate','universe_scanner.prop_compliance','recalculate','Recalculate prop firm compliance'),
  ('universe_scanner.prop_compliance.sync_rules','universe_scanner.prop_compliance','sync_rules','Sync prop firm compliance rules'),
  ('universe_scanner.prop_compliance.configure_rules','universe_scanner.prop_compliance','configure_rules','Configure prop firm compliance rules'),
  ('universe_scanner.prop_compliance.create_alert','universe_scanner.prop_compliance','create_alert','Create prop firm compliance alerts'),
  ('universe_scanner.prop_compliance.export','universe_scanner.prop_compliance','export','Export prop firm compliance report')
ON CONFLICT (code) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_asset_prop_compliance_scores_asset_time ON market.asset_prop_compliance_scores (asset, last_scanned DESC);
CREATE INDEX IF NOT EXISTS idx_asset_prop_compliance_rankings_rank ON market.asset_prop_compliance_rankings (rank, last_scanned DESC);
CREATE INDEX IF NOT EXISTS idx_asset_prop_blocked_time ON market.asset_prop_blocked_assets (observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_prop_compliance_scanner_alerts_time ON market.prop_compliance_scanner_alerts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prop_compliance_scanner_audit_time ON market.prop_compliance_scanner_audit_logs (created_at DESC);

COMMIT;
