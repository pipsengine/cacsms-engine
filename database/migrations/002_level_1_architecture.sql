BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;

CREATE SCHEMA IF NOT EXISTS analysis;
CREATE SCHEMA IF NOT EXISTS vision;
CREATE SCHEMA IF NOT EXISTS ai;
CREATE SCHEMA IF NOT EXISTS execution;
CREATE SCHEMA IF NOT EXISTS portfolio;
CREATE SCHEMA IF NOT EXISTS learning;
CREATE SCHEMA IF NOT EXISTS monitoring;
CREATE SCHEMA IF NOT EXISTS reporting;

CREATE TABLE security.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  resource text NOT NULL,
  action text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE security.role_permissions (
  role_id uuid NOT NULL REFERENCES security.roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES security.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE market.asset_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES workflow.workflow_runs(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES market.assets(id),
  funnel_stage smallint NOT NULL CHECK (funnel_stage IN (20, 10, 5, 3, 2, 1)),
  rank smallint NOT NULL,
  score numeric(7, 4) NOT NULL,
  factors jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, asset_id, funnel_stage)
);

CREATE TABLE market.market_intelligence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES workflow.workflow_runs(id) ON DELETE CASCADE,
  asset_id uuid REFERENCES market.assets(id),
  source text NOT NULL,
  sentiment numeric(7, 4),
  confidence numeric(7, 4),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE analysis.market_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES workflow.workflow_runs(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES market.assets(id),
  timeframe text NOT NULL,
  bias text NOT NULL CHECK (bias IN ('bullish', 'bearish', 'neutral')),
  confidence numeric(7, 4) NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE vision.vision_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES workflow.workflow_runs(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES market.assets(id),
  image_uri text,
  patterns jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence numeric(7, 4) NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ai.ai_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES workflow.workflow_runs(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES market.assets(id),
  decision text NOT NULL CHECK (decision IN ('buy', 'sell', 'hold', 'reject')),
  approved boolean NOT NULL DEFAULT false,
  confidence numeric(7, 4) NOT NULL,
  rationale jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ai.ai_debates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES workflow.workflow_runs(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES market.assets(id),
  decision_id uuid NOT NULL REFERENCES ai.ai_decisions(id) ON DELETE CASCADE,
  approved boolean NOT NULL DEFAULT false,
  consensus_score numeric(7, 4) NOT NULL,
  transcript jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE strategy.strategies
  ADD COLUMN IF NOT EXISTS validation_status text NOT NULL DEFAULT 'pending'
  CHECK (validation_status IN ('pending', 'approved', 'rejected'));

CREATE TABLE risk.risk_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES workflow.workflow_runs(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES market.assets(id),
  decision_id uuid NOT NULL REFERENCES ai.ai_decisions(id),
  approved boolean NOT NULL DEFAULT false,
  risk_score numeric(7, 4) NOT NULL,
  limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  rationale jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE infrastructure.brokers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  server text NOT NULL,
  status infrastructure.health_status NOT NULL DEFAULT 'pending',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE infrastructure.machine_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid NOT NULL REFERENCES infrastructure.machines(id) ON DELETE CASCADE,
  agent_key text NOT NULL UNIQUE,
  version text NOT NULL,
  certificate_fingerprint text NOT NULL UNIQUE,
  status infrastructure.health_status NOT NULL DEFAULT 'pending',
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_heartbeat_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE infrastructure.mt5_terminals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid NOT NULL REFERENCES infrastructure.machines(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES infrastructure.machine_agents(id) ON DELETE CASCADE,
  terminal_key text NOT NULL UNIQUE,
  installation_path text NOT NULL,
  mt5_build text,
  status infrastructure.health_status NOT NULL DEFAULT 'pending',
  last_heartbeat_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE infrastructure.mt5_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terminal_id uuid NOT NULL REFERENCES infrastructure.mt5_terminals(id) ON DELETE CASCADE,
  broker_id uuid NOT NULL REFERENCES infrastructure.brokers(id),
  account_number text NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  balance numeric(20, 4) NOT NULL DEFAULT 0,
  equity numeric(20, 4) NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (broker_id, account_number)
);

CREATE TABLE infrastructure.ea_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terminal_id uuid NOT NULL REFERENCES infrastructure.mt5_terminals(id) ON DELETE CASCADE,
  account_id uuid REFERENCES infrastructure.mt5_accounts(id) ON DELETE CASCADE,
  ea_version text NOT NULL,
  certificate_fingerprint text NOT NULL UNIQUE,
  status infrastructure.health_status NOT NULL DEFAULT 'pending',
  last_heartbeat_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type text NOT NULL,
  actor_id text NOT NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  previous_hash text,
  record_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION audit.prevent_audit_log_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit.audit_logs is immutable';
END;
$$;

CREATE TRIGGER audit_logs_immutable
BEFORE UPDATE OR DELETE ON audit.audit_logs
FOR EACH ROW EXECUTE FUNCTION audit.prevent_audit_log_mutation();

CREATE TABLE execution.execution_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES workflow.workflow_runs(id) ON DELETE RESTRICT,
  decision_id uuid NOT NULL REFERENCES ai.ai_decisions(id) ON DELETE RESTRICT,
  debate_id uuid NOT NULL REFERENCES ai.ai_debates(id) ON DELETE RESTRICT,
  risk_assessment_id uuid NOT NULL REFERENCES risk.risk_assessments(id) ON DELETE RESTRICT,
  strategy_id uuid NOT NULL REFERENCES strategy.strategies(id) ON DELETE RESTRICT,
  audit_log_id uuid NOT NULL REFERENCES audit.audit_logs(id) ON DELETE RESTRICT,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE execution.execution_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES workflow.workflow_runs(id) ON DELETE RESTRICT,
  token_id uuid NOT NULL REFERENCES execution.execution_tokens(id) ON DELETE RESTRICT,
  account_id uuid NOT NULL REFERENCES infrastructure.mt5_accounts(id) ON DELETE RESTRICT,
  asset_id uuid NOT NULL REFERENCES market.assets(id),
  correlation_id text NOT NULL UNIQUE,
  command text NOT NULL CHECK (command IN ('open', 'modify', 'close', 'partial_close', 'move_sl_tp', 'breakeven', 'trailing_stop')),
  side trading.trade_side,
  volume numeric(16, 4),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'acknowledged', 'filled', 'rejected', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE portfolio.positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES execution.execution_orders(id) ON DELETE RESTRICT,
  account_id uuid NOT NULL REFERENCES infrastructure.mt5_accounts(id) ON DELETE RESTRICT,
  asset_id uuid NOT NULL REFERENCES market.assets(id),
  external_ticket text NOT NULL,
  side trading.trade_side NOT NULL,
  volume numeric(16, 4) NOT NULL,
  entry_price numeric(20, 8) NOT NULL,
  stop_loss numeric(20, 8),
  take_profit numeric(20, 8),
  opened_at timestamptz NOT NULL,
  closed_at timestamptz,
  UNIQUE (account_id, external_ticket)
);

CREATE TABLE execution.trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL REFERENCES portfolio.positions(id) ON DELETE RESTRICT,
  order_id uuid NOT NULL REFERENCES execution.execution_orders(id) ON DELETE RESTRICT,
  external_deal_id text NOT NULL UNIQUE,
  price numeric(20, 8) NOT NULL,
  volume numeric(16, 4) NOT NULL,
  executed_at timestamptz NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE monitoring.system_events (
  observed_at timestamptz NOT NULL DEFAULT now(),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  source_type text NOT NULL,
  source_id text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('debug', 'info', 'warning', 'error', 'critical')),
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (observed_at, id)
);
SELECT create_hypertable('monitoring.system_events', by_range('observed_at'), if_not_exists => TRUE);

CREATE TABLE learning.learning_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES workflow.workflow_runs(id) ON DELETE CASCADE,
  asset_id uuid REFERENCES market.assets(id),
  record_type text NOT NULL,
  outcome jsonb NOT NULL,
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_asset_scores_run_funnel_rank ON market.asset_scores (run_id, funnel_stage, rank);
CREATE INDEX idx_machine_agents_machine ON infrastructure.machine_agents (machine_id);
CREATE INDEX idx_mt5_terminals_agent ON infrastructure.mt5_terminals (agent_id);
CREATE INDEX idx_mt5_accounts_terminal ON infrastructure.mt5_accounts (terminal_id);
CREATE INDEX idx_execution_orders_status ON execution.execution_orders (status, created_at DESC);
CREATE INDEX idx_audit_logs_resource ON audit.audit_logs (resource_type, resource_id, created_at DESC);

COMMIT;
