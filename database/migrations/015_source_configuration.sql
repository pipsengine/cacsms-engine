BEGIN;

CREATE TABLE market.source_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL,
  required boolean NOT NULL DEFAULT true,
  enabled boolean NOT NULL DEFAULT true,
  environment text NOT NULL DEFAULT 'production',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE market.source_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registry_id uuid NOT NULL REFERENCES market.source_registry(id) ON DELETE CASCADE,
  provider_name text NOT NULL,
  provider_type text NOT NULL,
  api_url text,
  websocket_url text,
  authentication_type text NOT NULL DEFAULT 'api_key',
  status text NOT NULL DEFAULT 'NOT_CONFIGURED',
  enabled boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE market.source_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES market.source_providers(id) ON DELETE CASCADE,
  vault_ref text NOT NULL,
  secret_hash text,
  rotated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vault_ref)
);

CREATE TABLE market.source_health (
  observed_at timestamptz NOT NULL DEFAULT now(),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  registry_id uuid NOT NULL REFERENCES market.source_registry(id) ON DELETE CASCADE,
  status text NOT NULL,
  health text NOT NULL,
  freshness text NOT NULL,
  latency_ms integer,
  availability text NOT NULL,
  PRIMARY KEY (observed_at, id)
);
SELECT create_hypertable('market.source_health', by_range('observed_at'), if_not_exists => TRUE);

CREATE TABLE market.source_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registry_id uuid NOT NULL REFERENCES market.source_registry(id) ON DELETE CASCADE,
  schedule text NOT NULL,
  last_sync_at timestamptz,
  next_sync_at timestamptz,
  records_imported integer NOT NULL DEFAULT 0,
  sync_duration_ms integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'IDLE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE market.source_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_job_id uuid REFERENCES market.source_sync_jobs(id) ON DELETE SET NULL,
  registry_id uuid REFERENCES market.source_registry(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL,
  records_imported integer NOT NULL DEFAULT 0,
  sync_duration_ms integer NOT NULL DEFAULT 0,
  message text
);

CREATE TABLE market.source_test_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid REFERENCES market.source_providers(id) ON DELETE SET NULL,
  registry_id uuid REFERENCES market.source_registry(id) ON DELETE SET NULL,
  tested_at timestamptz NOT NULL DEFAULT now(),
  result text NOT NULL CHECK (result IN ('PASS', 'WARNING', 'FAIL')),
  latency_ms integer,
  details text
);

CREATE TABLE market.source_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registry_id uuid REFERENCES market.source_registry(id) ON DELETE SET NULL,
  source_key text NOT NULL,
  event text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  actor text NOT NULL,
  result text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE market.source_workflow_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key text NOT NULL,
  target_stage text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  UNIQUE (source_key, target_stage)
);

COMMIT;
