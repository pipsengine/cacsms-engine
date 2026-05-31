BEGIN;

ALTER TYPE workflow.run_status ADD VALUE IF NOT EXISTS 'stopped';
ALTER TYPE workflow.stage_status ADD VALUE IF NOT EXISTS 'stopped';

ALTER TABLE market.assets
  ADD COLUMN IF NOT EXISTS priority smallint NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS default_timeframes text[] NOT NULL DEFAULT ARRAY['M15', 'H1', 'H4'],
  ADD COLUMN IF NOT EXISTS risk_category text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS spread_category text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS session_preference text NOT NULL DEFAULT 'all';

CREATE TABLE IF NOT EXISTS auth.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL UNIQUE,
  protected boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth.user_roles (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES auth.roles(id) ON DELETE RESTRICT,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS auth.role_permissions (
  role_id uuid NOT NULL REFERENCES auth.roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES auth.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE FUNCTION auth.protect_super_administrator_role()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.code = 'super_administrator' THEN
    RAISE EXCEPTION 'Super Administrator role cannot be modified or deleted';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_super_administrator_role
BEFORE UPDATE OR DELETE ON auth.roles
FOR EACH ROW EXECUTE FUNCTION auth.protect_super_administrator_role();

ALTER TABLE auth.users
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz;

CREATE FUNCTION auth.protect_super_administrator_user()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM auth.user_roles ur
    JOIN auth.roles r ON r.id = ur.role_id
    WHERE ur.user_id = OLD.id AND r.code = 'super_administrator'
  ) THEN
    IF TG_OP = 'DELETE' OR NEW.disabled_at IS NOT NULL OR NEW.locked_at IS NOT NULL OR NEW.status <> OLD.status THEN
      RAISE EXCEPTION 'Super Administrator cannot be deleted, disabled, or locked';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_super_administrator_user
BEFORE UPDATE OR DELETE ON auth.users
FOR EACH ROW EXECUTE FUNCTION auth.protect_super_administrator_user();

ALTER TABLE workflow.workflow_runs
  ADD COLUMN IF NOT EXISTS workflow_id text,
  ADD COLUMN IF NOT EXISTS current_stage smallint,
  ADD COLUMN IF NOT EXISTS duration_ms bigint,
  ADD COLUMN IF NOT EXISTS selected_assets jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS top_10_assets jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS top_5_assets jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS top_3_assets jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS execution_candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS final_trades jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS error_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0;

UPDATE workflow.workflow_runs SET workflow_id = run_key WHERE workflow_id IS NULL;
ALTER TABLE workflow.workflow_runs ALTER COLUMN workflow_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_runs_workflow_id ON workflow.workflow_runs (workflow_id);

ALTER TABLE workflow.workflow_stages
  ADD COLUMN IF NOT EXISTS input_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS output_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS confidence_score numeric(7, 4),
  ADD COLUMN IF NOT EXISTS duration_ms bigint,
  ADD COLUMN IF NOT EXISTS reject_reason text,
  ADD COLUMN IF NOT EXISTS logs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS evidence_reference text;

CREATE TABLE IF NOT EXISTS workflow.workflow_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES workflow.workflow_runs(id) ON DELETE CASCADE,
  stage_id uuid REFERENCES workflow.workflow_stages(id) ON DELETE SET NULL,
  action text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_universe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES market.assets(id) ON DELETE CASCADE,
  phase smallint NOT NULL CHECK (phase IN (1, 2)),
  tier market.asset_tier NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  priority smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asset_id)
);

CREATE TABLE IF NOT EXISTS market.market_intelligence_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES workflow.workflow_runs(id) ON DELETE CASCADE,
  source_count integer NOT NULL DEFAULT 0,
  quality_score numeric(7, 4),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS infrastructure.machine_heartbeats (
  observed_at timestamptz NOT NULL DEFAULT now(),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  machine_id uuid NOT NULL REFERENCES infrastructure.machines(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES infrastructure.machine_agents(id) ON DELETE CASCADE,
  status infrastructure.health_status NOT NULL,
  cpu_percent numeric(7, 4),
  memory_percent numeric(7, 4),
  latency_ms integer,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (observed_at, id)
);
SELECT create_hypertable('infrastructure.machine_heartbeats', by_range('observed_at'), if_not_exists => TRUE);

CREATE TABLE IF NOT EXISTS risk.risk_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  rule_type text NOT NULL,
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  veto_authority boolean NOT NULL DEFAULT true,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS execution.positions (
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

CREATE TABLE IF NOT EXISTS audit.system_events (
  observed_at timestamptz NOT NULL DEFAULT now(),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  source_type text NOT NULL,
  source_id text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('debug', 'info', 'warning', 'error', 'critical')),
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (observed_at, id)
);
SELECT create_hypertable('audit.system_events', by_range('observed_at'), if_not_exists => TRUE);

COMMIT;
