BEGIN;
CREATE SCHEMA IF NOT EXISTS market;

CREATE TABLE IF NOT EXISTS market.asset_risk_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid,
  asset_id uuid,
  asset text NOT NULL,
  asset_class text,
  volatility_risk numeric(7,4),
  liquidity_risk numeric(7,4),
  spread_risk numeric(7,4),
  slippage_risk numeric(7,4),
  news_risk numeric(7,4),
  macro_risk numeric(7,4),
  correlation_risk numeric(7,4),
  portfolio_risk numeric(7,4),
  broker_execution_risk numeric(7,4),
  prop_firm_risk numeric(7,4),
  overall_risk numeric(7,4),
  confidence numeric(7,4),
  qualification text,
  main_risk_driver text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_scanned timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_risk_component_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset text NOT NULL,
  component_key text NOT NULL,
  component_name text NOT NULL,
  risk_score numeric(7,4),
  risk_label text,
  confidence numeric(7,4),
  freshness text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_risk_rankings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid,
  rank integer,
  asset_id uuid,
  asset text NOT NULL,
  asset_class text,
  overall_risk text,
  risk_score numeric(7,4),
  main_risk_driver text,
  volatility_risk text,
  liquidity_risk text,
  spread_risk text,
  slippage_risk text,
  news_risk text,
  portfolio_risk text,
  prop_firm_risk text,
  risk_confidence numeric(7,4),
  qualification text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_scanned timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_critical_risk_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset text NOT NULL,
  critical_risk_type text,
  risk_score numeric(7,4),
  blocking_module text,
  reason text,
  severity text,
  recommended_action text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_news_event_risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset text NOT NULL,
  event_news text,
  currency text,
  impact text,
  risk_window text,
  news_risk_score numeric(7,4),
  volatility_risk text,
  trading_recommendation text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_broker_execution_risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset text NOT NULL,
  broker text,
  server text,
  current_spread numeric(14,6),
  average_spread numeric(14,6),
  spread_deviation numeric(14,6),
  slippage_risk text,
  execution_speed text,
  reject_rate numeric(7,4),
  execution_risk text,
  tradeability text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_correlation_portfolio_risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset text NOT NULL,
  correlation_group text,
  existing_exposure text,
  new_trade_impact text,
  portfolio_risk text,
  correlation_risk text,
  recommended_action text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_prop_firm_risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset text NOT NULL,
  firm text,
  account text,
  rule_type text,
  restriction_status text,
  daily_drawdown_risk text,
  max_drawdown_risk text,
  news_restriction text,
  consistency_risk text,
  compliance_recommendation text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_risk_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset text NOT NULL,
  risk_driver text,
  recommendation text,
  expected_risk_reduction text,
  priority text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.risk_scanner_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component_key text NOT NULL UNIQUE,
  component_name text NOT NULL,
  weight numeric(7,4) NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.risk_scanner_runs (
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

CREATE TABLE IF NOT EXISTS market.risk_scanner_ai_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lowest_risk_assets text,
  highest_risk_assets text,
  blocked_assets text,
  main_risk_drivers text,
  news_event_risks text,
  broker_execution_risks text,
  portfolio_concentration_risks text,
  prop_firm_risks text,
  assets_safe_for_ranking text,
  assets_to_avoid text,
  recommended_next_step text,
  summary text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.risk_scanner_alerts (
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

CREATE TABLE IF NOT EXISTS market.risk_scanner_audit_logs (
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

INSERT INTO market.risk_scanner_weights (component_key, component_name, weight) VALUES
  ('volatility','Volatility Risk',15),
  ('liquidity','Liquidity Risk',15),
  ('spread','Spread Risk',10),
  ('slippage','Slippage Risk',10),
  ('news_event','News / Event Risk',15),
  ('macro','Macro Risk',10),
  ('correlation','Correlation Risk',10),
  ('portfolio','Portfolio Risk',5),
  ('broker_execution','Broker Execution Risk',5),
  ('prop_firm','Prop Firm Risk',5)
ON CONFLICT (component_key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_asset_risk_scores_asset_time ON market.asset_risk_scores (asset, last_scanned DESC);
CREATE INDEX IF NOT EXISTS idx_asset_risk_rankings_rank ON market.asset_risk_rankings (rank, last_scanned DESC);
CREATE INDEX IF NOT EXISTS idx_risk_scanner_alerts_time ON market.risk_scanner_alerts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_scanner_audit_time ON market.risk_scanner_audit_logs (created_at DESC);

COMMIT;
