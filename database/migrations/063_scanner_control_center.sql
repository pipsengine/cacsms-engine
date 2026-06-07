BEGIN;
CREATE SCHEMA IF NOT EXISTS market;
CREATE SCHEMA IF NOT EXISTS security;

CREATE TABLE IF NOT EXISTS market.scanner_control_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scanner_mode text NOT NULL DEFAULT 'Manual',
  scanner_status text NOT NULL DEFAULT 'Idle',
  emergency_stop boolean NOT NULL DEFAULT false,
  last_full_scan_at timestamptz,
  last_full_scan_status text,
  next_scheduled_scan_at timestamptz,
  card3_readiness text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.scanner_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key text NOT NULL,
  module_name text NOT NULL,
  job_type text NOT NULL,
  priority integer NOT NULL DEFAULT 5,
  status text NOT NULL DEFAULT 'Queued',
  queued_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  duration_ms integer,
  retry_count integer NOT NULL DEFAULT 0,
  max_retries integer NOT NULL DEFAULT 3,
  triggered_by text,
  worker_id uuid,
  error_message text,
  input_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.scanner_job_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES market.scanner_jobs(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  priority integer NOT NULL DEFAULT 5,
  status text NOT NULL DEFAULT 'Queued',
  queued_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.scanner_workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_name text NOT NULL,
  assigned_module text,
  status text NOT NULL DEFAULT 'Idle',
  current_job_id uuid,
  cpu_usage numeric(7,4),
  memory_usage numeric(7,4),
  jobs_processed_today integer NOT NULL DEFAULT 0,
  failed_jobs integer NOT NULL DEFAULT 0,
  last_error text,
  disabled boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.scanner_worker_heartbeats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid REFERENCES market.scanner_workers(id) ON DELETE CASCADE,
  status text NOT NULL,
  cpu_usage numeric(7,4),
  memory_usage numeric(7,4),
  current_job_id uuid,
  heartbeat_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.scanner_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_name text NOT NULL,
  module_key text NOT NULL,
  frequency text NOT NULL,
  cron_expression text,
  enabled boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  timezone text NOT NULL DEFAULT 'Africa/Lagos',
  created_by text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.scanner_safety_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_key text NOT NULL,
  check_name text NOT NULL,
  status text NOT NULL,
  severity text NOT NULL DEFAULT 'Info',
  detail text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  checked_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.scanner_failure_recovery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES market.scanner_jobs(id) ON DELETE SET NULL,
  module_key text,
  failure_type text NOT NULL,
  error_message text,
  retry_count integer NOT NULL DEFAULT 0,
  max_retries integer NOT NULL DEFAULT 3,
  retryable boolean NOT NULL DEFAULT true,
  recommended_fix text,
  status text NOT NULL DEFAULT 'Open',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.scanner_health_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_key text NOT NULL,
  metric_name text NOT NULL,
  metric_value numeric(12,4),
  status text,
  detail text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.scanner_control_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  title text NOT NULL,
  severity text NOT NULL DEFAULT 'Info',
  module_key text,
  job_id uuid,
  worker_id uuid,
  status text NOT NULL DEFAULT 'Open',
  created_by text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.scanner_control_ai_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scanner_operational_health text,
  modules_failing_or_delayed text,
  queue_pressure text,
  worker_issues text,
  full_scan_readiness text,
  next_card_readiness text,
  recommended_operational_actions text,
  summary text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.scanner_control_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_name text NOT NULL DEFAULT 'api',
  action text NOT NULL,
  entity_type text,
  entity_id text,
  before_state jsonb,
  after_state jsonb,
  reason text,
  ip_address text,
  environment text NOT NULL DEFAULT 'production',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO security.permissions (code, resource, action, description) VALUES
  ('universe_scanner.control_center.view','universe_scanner.control_center','view','View scanner control center'),
  ('universe_scanner.control_center.run_full_scan','universe_scanner.control_center','run_full_scan','Run full universe scan'),
  ('universe_scanner.control_center.run_module','universe_scanner.control_center','run_module','Run scanner module'),
  ('universe_scanner.control_center.pause','universe_scanner.control_center','pause','Pause scanner'),
  ('universe_scanner.control_center.resume','universe_scanner.control_center','resume','Resume scanner'),
  ('universe_scanner.control_center.stop','universe_scanner.control_center','stop','Stop scanner'),
  ('universe_scanner.control_center.emergency_stop','universe_scanner.control_center','emergency_stop','Emergency stop scanner'),
  ('universe_scanner.control_center.change_mode','universe_scanner.control_center','change_mode','Change scanner mode'),
  ('universe_scanner.control_center.manage_workers','universe_scanner.control_center','manage_workers','Manage scanner workers'),
  ('universe_scanner.control_center.manage_schedules','universe_scanner.control_center','manage_schedules','Manage scanner schedules'),
  ('universe_scanner.control_center.export','universe_scanner.control_center','export','Export scanner control report')
ON CONFLICT (code) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_scanner_jobs_status ON market.scanner_jobs(status, queued_at DESC);
CREATE INDEX IF NOT EXISTS idx_scanner_workers_status ON market.scanner_workers(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_scanner_schedules_next ON market.scanner_schedules(enabled, next_run_at);
CREATE INDEX IF NOT EXISTS idx_scanner_control_audit_time ON market.scanner_control_audit_logs(created_at DESC);

COMMIT;
