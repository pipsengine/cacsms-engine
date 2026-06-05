BEGIN;

CREATE SCHEMA IF NOT EXISTS security;

CREATE TABLE IF NOT EXISTS security.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  resource text NOT NULL,
  action text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.portfolio_intelligence_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid,
  portfolio_health_score numeric(7, 4),
  account_risk_score numeric(7, 4),
  drawdown_risk numeric(7, 4),
  margin_risk numeric(7, 4),
  exposure_risk numeric(7, 4),
  correlation_risk numeric(7, 4),
  strategy_performance_score numeric(7, 4),
  prop_firm_breach_risk numeric(7, 4),
  trade_quality_score numeric(7, 4),
  portfolio_confidence_score numeric(7, 4),
  health_status text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_intelligence_scores_latest
  ON market.portfolio_intelligence_scores (observed_at DESC, account_id);

CREATE TABLE IF NOT EXISTS market.portfolio_intelligence_inputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  input_key text NOT NULL,
  input_label text NOT NULL,
  provider_name text,
  broker_name text,
  account_id uuid,
  account_label text,
  status text NOT NULL DEFAULT 'unavailable',
  freshness_seconds integer,
  health_score numeric(7, 4),
  weight numeric(7, 4) NOT NULL DEFAULT 1,
  last_updated_at timestamptz,
  used_in_portfolio_score boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.portfolio_account_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid,
  broker_name text,
  server_name text,
  risk_score numeric(7, 4),
  health_status text,
  margin_level numeric(20, 4),
  drawdown_percent numeric(9, 4),
  open_trades integer NOT NULL DEFAULT 0,
  observed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.portfolio_exposure_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exposure_type text NOT NULL,
  exposure_key text NOT NULL,
  long_exposure numeric(20, 4) NOT NULL DEFAULT 0,
  short_exposure numeric(20, 4) NOT NULL DEFAULT 0,
  net_exposure numeric(20, 4) NOT NULL DEFAULT 0,
  exposure_percent numeric(9, 4),
  risk_percent numeric(9, 4),
  margin_contribution numeric(20, 4),
  observed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.portfolio_strategy_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_name text NOT NULL,
  trades integer NOT NULL DEFAULT 0,
  win_rate numeric(9, 4),
  profit_factor numeric(12, 4),
  average_r numeric(12, 4),
  expectancy numeric(20, 4),
  drawdown numeric(9, 4),
  net_profit numeric(20, 4),
  risk_contribution numeric(9, 4),
  status text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.portfolio_risk_concentration (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  concentration_type text NOT NULL,
  subject text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  message text NOT NULL,
  recommended_action text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.portfolio_ai_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  summary text NOT NULL,
  confidence_score numeric(7, 4),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.portfolio_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor text NOT NULL DEFAULT 'system',
  permission text,
  action text NOT NULL,
  result text NOT NULL DEFAULT 'accepted',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO security.permissions (code, resource, action, description)
VALUES
  ('market_intelligence.portfolio_intelligence.view', 'market_intelligence.portfolio_intelligence', 'view', 'View portfolio intelligence'),
  ('market_intelligence.portfolio_intelligence.sync_accounts', 'market_intelligence.portfolio_intelligence', 'sync_accounts', 'Sync portfolio accounts'),
  ('market_intelligence.portfolio_intelligence.recalculate', 'market_intelligence.portfolio_intelligence', 'recalculate', 'Recalculate portfolio risk'),
  ('market_intelligence.portfolio_intelligence.configure_accounts', 'market_intelligence.portfolio_intelligence', 'configure_accounts', 'Configure portfolio accounts'),
  ('market_intelligence.portfolio_intelligence.export', 'market_intelligence.portfolio_intelligence', 'export', 'Export portfolio intelligence reports'),
  ('market_intelligence.portfolio_intelligence.create_alert', 'market_intelligence.portfolio_intelligence', 'create_alert', 'Create portfolio intelligence alerts')
ON CONFLICT (code) DO NOTHING;

COMMIT;
