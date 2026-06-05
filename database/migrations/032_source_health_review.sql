BEGIN;

CREATE SCHEMA IF NOT EXISTS market;

CREATE TABLE IF NOT EXISTS market.source_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key text NOT NULL UNIQUE,
  name text NOT NULL,
  module text,
  category text NOT NULL,
  required boolean NOT NULL DEFAULT true,
  priority text NOT NULL DEFAULT 'normal',
  environment text NOT NULL DEFAULT 'production',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE market.source_registry ADD COLUMN IF NOT EXISTS module text;
ALTER TABLE market.source_registry ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal';

CREATE TABLE IF NOT EXISTS market.source_provider_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registry_id uuid REFERENCES market.source_registry(id) ON DELETE CASCADE,
  source_key text,
  provider text,
  provider_type text,
  status text NOT NULL DEFAULT 'UNKNOWN',
  plan text,
  availability_pct numeric(7,4),
  success_rate_pct numeric(7,4),
  failure_rate_pct numeric(7,4),
  latency_ms integer,
  rate_limit_status text NOT NULL DEFAULT 'UNKNOWN',
  authentication_status text NOT NULL DEFAULT 'UNKNOWN',
  environment text NOT NULL DEFAULT 'production',
  observed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.source_health_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registry_id uuid REFERENCES market.source_registry(id) ON DELETE CASCADE,
  source_key text,
  health text NOT NULL DEFAULT 'UNKNOWN',
  health_score numeric(7,4),
  quality_score numeric(7,4),
  freshness_status text NOT NULL DEFAULT 'UNKNOWN',
  data_freshness text,
  records_imported integer NOT NULL DEFAULT 0,
  records_rejected integer NOT NULL DEFAULT 0,
  duplicate_records integer NOT NULL DEFAULT 0,
  missing_records integer NOT NULL DEFAULT 0,
  invalid_records integer NOT NULL DEFAULT 0,
  outdated_records integer NOT NULL DEFAULT 0,
  schema_errors integer NOT NULL DEFAULT 0,
  timestamp_gaps integer NOT NULL DEFAULT 0,
  data_completeness_pct numeric(7,4),
  validation_pass_rate_pct numeric(7,4),
  observed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.source_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registry_id uuid REFERENCES market.source_registry(id) ON DELETE SET NULL,
  source_key text,
  provider text,
  job_type text,
  status text NOT NULL DEFAULT 'UNKNOWN',
  failure_type text,
  error_message text,
  retry_count integer NOT NULL DEFAULT 0,
  resolved boolean NOT NULL DEFAULT false,
  affected_records integer NOT NULL DEFAULT 0,
  severity text NOT NULL DEFAULT 'info',
  records_imported integer NOT NULL DEFAULT 0,
  records_rejected integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE market.source_sync_logs ADD COLUMN IF NOT EXISTS source_key text;
ALTER TABLE market.source_sync_logs ADD COLUMN IF NOT EXISTS provider text;
ALTER TABLE market.source_sync_logs ADD COLUMN IF NOT EXISTS job_type text;
ALTER TABLE market.source_sync_logs ADD COLUMN IF NOT EXISTS failure_type text;
ALTER TABLE market.source_sync_logs ADD COLUMN IF NOT EXISTS error_message text;
ALTER TABLE market.source_sync_logs ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0;
ALTER TABLE market.source_sync_logs ADD COLUMN IF NOT EXISTS resolved boolean NOT NULL DEFAULT false;
ALTER TABLE market.source_sync_logs ADD COLUMN IF NOT EXISTS affected_records integer NOT NULL DEFAULT 0;
ALTER TABLE market.source_sync_logs ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'info';
ALTER TABLE market.source_sync_logs ADD COLUMN IF NOT EXISTS records_rejected integer NOT NULL DEFAULT 0;
ALTER TABLE market.source_sync_logs ADD COLUMN IF NOT EXISTS last_success_at timestamptz;
ALTER TABLE market.source_sync_logs ADD COLUMN IF NOT EXISTS last_failure_at timestamptz;
ALTER TABLE market.source_sync_logs ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS market.source_validation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registry_id uuid REFERENCES market.source_registry(id) ON DELETE SET NULL,
  source_key text,
  validation_rule text NOT NULL,
  issue_count integer NOT NULL DEFAULT 0,
  severity text NOT NULL DEFAULT 'info',
  status text NOT NULL DEFAULT 'UNKNOWN',
  recommended_fix text,
  detected_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.source_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registry_id uuid REFERENCES market.source_registry(id) ON DELETE SET NULL,
  source_key text,
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  status text NOT NULL DEFAULT 'OPEN',
  message text,
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.source_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registry_id uuid REFERENCES market.source_registry(id) ON DELETE CASCADE,
  source_key text,
  affected_module text NOT NULL,
  affected_page text,
  business_impact text,
  risk_level text NOT NULL DEFAULT 'UNKNOWN',
  fallback_available boolean,
  recommended_action text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.source_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registry_id uuid REFERENCES market.source_registry(id) ON DELETE CASCADE,
  source_key text,
  provider text,
  plan text,
  api_calls_used integer,
  api_calls_remaining integer,
  reset_time timestamptz,
  usage_pct numeric(7,4),
  status text NOT NULL DEFAULT 'UNKNOWN',
  recommended_action text,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.source_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid,
  registry_id uuid REFERENCES market.source_registry(id) ON DELETE CASCADE,
  source_key text,
  authentication_type text,
  credential_status text NOT NULL DEFAULT 'UNKNOWN',
  credential_expiry timestamptz,
  last_rotation timestamptz,
  encryption_status text,
  access_scope text,
  security_risk text,
  vault_ref text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE market.source_credentials ADD COLUMN IF NOT EXISTS registry_id uuid REFERENCES market.source_registry(id) ON DELETE CASCADE;
ALTER TABLE market.source_credentials ADD COLUMN IF NOT EXISTS source_key text;
ALTER TABLE market.source_credentials ADD COLUMN IF NOT EXISTS authentication_type text;
ALTER TABLE market.source_credentials ADD COLUMN IF NOT EXISTS credential_status text NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE market.source_credentials ADD COLUMN IF NOT EXISTS credential_expiry timestamptz;
ALTER TABLE market.source_credentials ADD COLUMN IF NOT EXISTS last_rotation timestamptz;
ALTER TABLE market.source_credentials ADD COLUMN IF NOT EXISTS encryption_status text;
ALTER TABLE market.source_credentials ADD COLUMN IF NOT EXISTS access_scope text;
ALTER TABLE market.source_credentials ADD COLUMN IF NOT EXISTS security_risk text;
ALTER TABLE market.source_credentials ALTER COLUMN provider_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS market.source_health_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_type text NOT NULL,
  status text NOT NULL DEFAULT 'RECORDED',
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.source_health_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registry_id uuid REFERENCES market.source_registry(id) ON DELETE CASCADE,
  source_key text,
  recommendation text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  status text NOT NULL DEFAULT 'OPEN',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.source_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registry_id uuid REFERENCES market.source_registry(id) ON DELETE SET NULL,
  source_key text NOT NULL DEFAULT 'system',
  event text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  actor text NOT NULL DEFAULT 'api',
  result text NOT NULL DEFAULT 'RECORDED',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_source_provider_health_source_time ON market.source_provider_health (source_key, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_source_health_metrics_source_time ON market.source_health_metrics (source_key, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_source_sync_logs_source_time ON market.source_sync_logs (source_key, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_source_validation_logs_source_time ON market.source_validation_logs (source_key, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_source_alerts_status ON market.source_alerts (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_source_dependencies_source ON market.source_dependencies (source_key);
CREATE INDEX IF NOT EXISTS idx_source_rate_limits_source_time ON market.source_rate_limits (source_key, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_source_credentials_source ON market.source_credentials (source_key);
CREATE INDEX IF NOT EXISTS idx_source_audit_logs_source_time ON market.source_audit_logs (source_key, created_at DESC);

COMMIT;
