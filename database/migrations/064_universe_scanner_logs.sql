BEGIN;
CREATE SCHEMA IF NOT EXISTS market;
CREATE SCHEMA IF NOT EXISTS security;

CREATE TABLE IF NOT EXISTS market.scanner_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp timestamptz NOT NULL DEFAULT now(),
  severity text NOT NULL DEFAULT 'Info',
  status text NOT NULL DEFAULT 'Completed',
  module_key text,
  module_name text,
  category text NOT NULL DEFAULT 'System Logs',
  action text,
  message text NOT NULL,
  detailed_description text,
  asset text,
  candidate_id uuid,
  job_id uuid,
  run_id uuid,
  worker_id uuid,
  user_name text,
  ip_address text,
  correlation_id text,
  duration_ms integer,
  environment text NOT NULL DEFAULT 'production',
  error_code text,
  stack_trace text,
  input_snapshot jsonb,
  output_snapshot jsonb,
  before_value jsonb,
  after_value jsonb,
  recommended_fix text,
  resolution_status text NOT NULL DEFAULT 'Open',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.scanner_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp timestamptz NOT NULL DEFAULT now(),
  user_name text,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  before_value jsonb,
  after_value jsonb,
  reason text,
  ip_address text,
  environment text NOT NULL DEFAULT 'production',
  correlation_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.scanner_job_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid,
  module_key text,
  status text NOT NULL,
  message text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.scanner_worker_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid,
  worker_name text,
  status text,
  message text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.scanner_queue_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid,
  queue_status text,
  message text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.scanner_error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key text,
  asset text,
  job_id uuid,
  worker_id uuid,
  error_code text,
  error_message text NOT NULL,
  severity text NOT NULL DEFAULT 'Error',
  retry_count integer NOT NULL DEFAULT 0,
  resolved boolean NOT NULL DEFAULT false,
  recommended_fix text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.scanner_module_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key text NOT NULL,
  module_name text,
  action text,
  status text,
  message text,
  duration_ms integer,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.scanner_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_title text NOT NULL,
  severity text NOT NULL,
  affected_module text,
  affected_asset text,
  affected_job uuid,
  description text,
  assigned_to text,
  due_date date,
  status text NOT NULL DEFAULT 'Open',
  source_log_id text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.scanner_log_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id text,
  event_type text NOT NULL,
  module_key text,
  asset text,
  job_id uuid,
  worker_id uuid,
  candidate_id uuid,
  message text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.scanner_log_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_key text NOT NULL,
  metric_name text NOT NULL,
  metric_value numeric(14,4),
  bucket_start timestamptz NOT NULL DEFAULT date_trunc('hour', now()),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.scanner_log_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  export_type text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'Created',
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.scanner_log_retention (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retention_period_days integer NOT NULL DEFAULT 365,
  archive_status text NOT NULL DEFAULT 'Active',
  legal_hold boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE market.scanner_audit_logs
  ADD COLUMN IF NOT EXISTS timestamp timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS user_name text,
  ADD COLUMN IF NOT EXISTS entity_type text,
  ADD COLUMN IF NOT EXISTS entity_id text,
  ADD COLUMN IF NOT EXISTS before_value jsonb,
  ADD COLUMN IF NOT EXISTS after_value jsonb,
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'production',
  ADD COLUMN IF NOT EXISTS correlation_id text,
  ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}'::jsonb;

INSERT INTO security.permissions (code, resource, action, description) VALUES
  ('universe_scanner.logs.view','universe_scanner.logs','view','View universe scanner logs'),
  ('universe_scanner.logs.view_sensitive','universe_scanner.logs','view_sensitive','View sensitive scanner log fields'),
  ('universe_scanner.logs.export','universe_scanner.logs','export','Export universe scanner logs'),
  ('universe_scanner.logs.acknowledge','universe_scanner.logs','acknowledge','Acknowledge scanner logs'),
  ('universe_scanner.logs.resolve','universe_scanner.logs','resolve','Resolve scanner logs'),
  ('universe_scanner.logs.create_incident','universe_scanner.logs','create_incident','Create incidents from scanner logs'),
  ('universe_scanner.logs.archive','universe_scanner.logs','archive','Archive scanner logs'),
  ('universe_scanner.logs.view_audit','universe_scanner.logs','view_audit','View scanner audit logs')
ON CONFLICT (code) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_scanner_logs_time ON market.scanner_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_scanner_logs_correlation ON market.scanner_logs(correlation_id);
CREATE INDEX IF NOT EXISTS idx_scanner_error_logs_time ON market.scanner_error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scanner_incidents_status ON market.scanner_incidents(status, created_at DESC);

COMMIT;
