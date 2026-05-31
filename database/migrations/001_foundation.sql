BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS workflow;
CREATE SCHEMA IF NOT EXISTS market;
CREATE SCHEMA IF NOT EXISTS trading;
CREATE SCHEMA IF NOT EXISTS risk;
CREATE SCHEMA IF NOT EXISTS strategy;
CREATE SCHEMA IF NOT EXISTS infrastructure;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS security;

CREATE TYPE workflow.run_status AS ENUM ('pending', 'running', 'completed', 'failed', 'blocked', 'retrying', 'escalated', 'skipped');
CREATE TYPE workflow.stage_status AS ENUM ('pending', 'running', 'completed', 'failed', 'blocked', 'retrying', 'escalated', 'skipped');
CREATE TYPE market.asset_tier AS ENUM ('tier_1', 'tier_2');
CREATE TYPE infrastructure.health_status AS ENUM ('pending', 'online', 'degraded', 'offline', 'maintenance');
CREATE TYPE trading.trade_side AS ENUM ('buy', 'sell');

CREATE TABLE auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  password_hash text,
  mfa_enabled boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE auth.identity_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('email', 'google', 'microsoft')),
  provider_subject text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_subject)
);

CREATE TABLE security.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE security.user_roles (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES security.roles(id) ON DELETE CASCADE,
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE security.access_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  resource text NOT NULL,
  action text NOT NULL,
  attribute_rule jsonb NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE market.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL UNIQUE,
  display_name text NOT NULL,
  asset_class text NOT NULL,
  tier market.asset_tier NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE market.price_ticks (
  observed_at timestamptz NOT NULL,
  asset_id uuid NOT NULL REFERENCES market.assets(id),
  bid numeric(20, 8) NOT NULL,
  ask numeric(20, 8) NOT NULL,
  source text NOT NULL,
  PRIMARY KEY (asset_id, observed_at)
);
SELECT create_hypertable('market.price_ticks', by_range('observed_at'), if_not_exists => TRUE);

CREATE TABLE workflow.workflow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_key text NOT NULL UNIQUE,
  status workflow.run_status NOT NULL DEFAULT 'pending',
  trigger_type text NOT NULL DEFAULT 'scheduled',
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE workflow.workflow_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES workflow.workflow_runs(id) ON DELETE CASCADE,
  stage_key text NOT NULL,
  stage_order smallint NOT NULL CHECK (stage_order BETWEEN 1 AND 14),
  name text NOT NULL,
  status workflow.stage_status NOT NULL DEFAULT 'pending',
  attempt smallint NOT NULL DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (run_id, stage_order),
  UNIQUE (run_id, stage_key)
);

CREATE TABLE workflow.workflow_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES workflow.workflow_runs(id) ON DELETE CASCADE,
  stage_id uuid REFERENCES workflow.workflow_stages(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE workflow.workflow_logs (
  recorded_at timestamptz NOT NULL DEFAULT now(),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES workflow.workflow_runs(id) ON DELETE CASCADE,
  stage_id uuid REFERENCES workflow.workflow_stages(id) ON DELETE CASCADE,
  level text NOT NULL CHECK (level IN ('debug', 'info', 'warning', 'error', 'critical')),
  message text NOT NULL,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (recorded_at, id)
);
SELECT create_hypertable('workflow.workflow_logs', by_range('recorded_at'), if_not_exists => TRUE);

CREATE TABLE workflow.workflow_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES workflow.workflow_runs(id) ON DELETE CASCADE,
  stage_id uuid NOT NULL REFERENCES workflow.workflow_stages(id) ON DELETE CASCADE,
  output_type text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE workflow.workflow_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES workflow.workflow_runs(id) ON DELETE CASCADE,
  stage_id uuid REFERENCES workflow.workflow_stages(id) ON DELETE CASCADE,
  error_code text NOT NULL,
  message text NOT NULL,
  stack_trace text,
  recoverable boolean NOT NULL DEFAULT false,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE workflow.workflow_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES workflow.workflow_runs(id) ON DELETE CASCADE,
  actor_type text NOT NULL,
  actor_id text NOT NULL,
  action text NOT NULL,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE market.scan_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES workflow.workflow_runs(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES market.assets(id),
  scan_level smallint NOT NULL CHECK (scan_level IN (20, 10, 5, 3, 2, 1)),
  rank smallint NOT NULL,
  score numeric(7, 4) NOT NULL,
  included boolean NOT NULL DEFAULT true,
  factors jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE strategy.strategies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  version text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE risk.validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES workflow.workflow_runs(id) ON DELETE CASCADE,
  asset_id uuid REFERENCES market.assets(id),
  status text NOT NULL CHECK (status IN ('approved', 'rejected', 'escalated')),
  risk_score numeric(7, 4) NOT NULL,
  limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE infrastructure.machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_key text NOT NULL UNIQUE,
  hostname text NOT NULL,
  region text NOT NULL,
  status infrastructure.health_status NOT NULL DEFAULT 'pending',
  capacity jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_heartbeat_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE infrastructure.terminals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid NOT NULL REFERENCES infrastructure.machines(id) ON DELETE CASCADE,
  terminal_key text NOT NULL UNIQUE,
  mt5_build text,
  bridge_version text,
  status infrastructure.health_status NOT NULL DEFAULT 'pending',
  last_heartbeat_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE trading.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terminal_id uuid NOT NULL REFERENCES infrastructure.terminals(id) ON DELETE RESTRICT,
  broker text NOT NULL,
  account_number text NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  balance numeric(20, 4) NOT NULL DEFAULT 0,
  equity numeric(20, 4) NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (broker, account_number)
);

CREATE TABLE trading.positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES trading.accounts(id),
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

CREATE TABLE infrastructure.heartbeats (
  observed_at timestamptz NOT NULL,
  machine_id uuid NOT NULL REFERENCES infrastructure.machines(id) ON DELETE CASCADE,
  terminal_id uuid REFERENCES infrastructure.terminals(id) ON DELETE CASCADE,
  status infrastructure.health_status NOT NULL,
  latency_ms integer,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (machine_id, observed_at)
);
SELECT create_hypertable('infrastructure.heartbeats', by_range('observed_at'), if_not_exists => TRUE);

CREATE TABLE audit.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id text NOT NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text NOT NULL,
  source_ip inet,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE analytics.performance_snapshots (
  observed_at timestamptz NOT NULL,
  account_id uuid NOT NULL REFERENCES trading.accounts(id),
  balance numeric(20, 4) NOT NULL,
  equity numeric(20, 4) NOT NULL,
  margin numeric(20, 4) NOT NULL DEFAULT 0,
  pnl numeric(20, 4) NOT NULL DEFAULT 0,
  PRIMARY KEY (account_id, observed_at)
);
SELECT create_hypertable('analytics.performance_snapshots', by_range('observed_at'), if_not_exists => TRUE);

CREATE INDEX idx_workflow_runs_status ON workflow.workflow_runs (status, created_at DESC);
CREATE INDEX idx_workflow_stages_run_status ON workflow.workflow_stages (run_id, status);
CREATE INDEX idx_workflow_events_run_time ON workflow.workflow_events (run_id, occurred_at DESC);
CREATE INDEX idx_market_scan_results_run_level_rank ON market.scan_results (run_id, scan_level, rank);
CREATE INDEX idx_infrastructure_terminals_machine ON infrastructure.terminals (machine_id);
CREATE INDEX idx_trading_accounts_terminal ON trading.accounts (terminal_id);
CREATE INDEX idx_audit_events_resource ON audit.events (resource_type, resource_id, occurred_at DESC);

COMMIT;
