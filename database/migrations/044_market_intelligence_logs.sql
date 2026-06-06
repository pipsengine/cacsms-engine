-- Market Intelligence Logs Migration
-- Creates tables for comprehensive logging across Market Intelligence modules

BEGIN;

-- Create schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS market_intelligence;

-- Main logs table
CREATE TABLE IF NOT EXISTS market_intelligence.market_intelligence_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp timestamptz NOT NULL DEFAULT now(),
  severity text NOT NULL CHECK (severity IN ('info', 'success', 'warning', 'error', 'critical', 'emergency')),
  status text NOT NULL CHECK (status IN ('started', 'completed', 'failed', 'retrying', 'blocked', 'acknowledged', 'resolved', 'archived')),
  module text NOT NULL,
  category text NOT NULL,
  action text NOT NULL,
  message text NOT NULL,
  detailed_description text,
  entity_type text,
  entity_id uuid,
  user_id uuid,
  user_name text,
  ip_address text,
  source text,
  provider text,
  request_id text,
  correlation_id text NOT NULL,
  duration_ms integer,
  environment text NOT NULL DEFAULT 'production',
  error_code text,
  stack_trace text,
  payload_snapshot jsonb,
  before_value jsonb,
  after_value jsonb,
  recommended_action text,
  resolution_status text CHECK (resolution_status IN ('pending', 'acknowledged', 'resolved', 'archived')),
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS market_intelligence.market_intelligence_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  user_name text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  before_value jsonb,
  after_value jsonb,
  reason text,
  ip_address text,
  environment text NOT NULL DEFAULT 'production',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Error logs table
CREATE TABLE IF NOT EXISTS market_intelligence.market_intelligence_error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp timestamptz NOT NULL DEFAULT now(),
  severity text NOT NULL CHECK (severity IN ('warning', 'error', 'critical', 'emergency')),
  module text NOT NULL,
  category text NOT NULL,
  error_code text,
  message text NOT NULL,
  affected_entity_type text,
  affected_entity_id uuid,
  stack_trace text,
  retry_count integer NOT NULL DEFAULT 0,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid,
  recommended_action text,
  correlation_id text,
  environment text NOT NULL DEFAULT 'production',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Event logs table
CREATE TABLE IF NOT EXISTS market_intelligence.market_intelligence_event_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp timestamptz NOT NULL DEFAULT now(),
  event_type text NOT NULL,
  module text NOT NULL,
  category text,
  entity_type text,
  entity_id uuid,
  data jsonb,
  user_id uuid,
  user_name text,
  correlation_id text,
  environment text NOT NULL DEFAULT 'production',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Incidents table
CREATE TABLE IF NOT EXISTS market_intelligence.market_intelligence_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  affected_module text,
  affected_source text,
  description text,
  assigned_to uuid,
  assigned_to_name text,
  due_date timestamptz,
  status text NOT NULL CHECK (status IN ('open', 'investigating', 'resolved', 'closed')),
  related_log_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid
);

-- Log timeline table
CREATE TABLE IF NOT EXISTS market_intelligence.market_intelligence_log_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id text NOT NULL,
  log_id uuid NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now(),
  event_type text NOT NULL,
  sequence integer NOT NULL,
  data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (correlation_id, sequence)
);

-- Log exports table
CREATE TABLE IF NOT EXISTS market_intelligence.market_intelligence_log_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  export_type text NOT NULL CHECK (export_type IN ('csv', 'excel', 'json', 'pdf')),
  filters jsonb NOT NULL,
  file_path text,
  status text NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  row_count integer,
  file_size_bytes bigint,
  created_by uuid,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- Log retention table
CREATE TABLE IF NOT EXISTS market_intelligence.market_intelligence_log_retention (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_type text NOT NULL,
  retention_period_days integer NOT NULL,
  archive_status text CHECK (archive_status IN ('active', 'archived', 'deleted')),
  legal_hold boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_mi_logs_timestamp ON market_intelligence.market_intelligence_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_mi_logs_severity ON market_intelligence.market_intelligence_logs (severity);
CREATE INDEX IF NOT EXISTS idx_mi_logs_status ON market_intelligence.market_intelligence_logs (status);
CREATE INDEX IF NOT EXISTS idx_mi_logs_module ON market_intelligence.market_intelligence_logs (module);
CREATE INDEX IF NOT EXISTS idx_mi_logs_category ON market_intelligence.market_intelligence_logs (category);
CREATE INDEX IF NOT EXISTS idx_mi_logs_correlation ON market_intelligence.market_intelligence_logs (correlation_id);
CREATE INDEX IF NOT EXISTS idx_mi_logs_user ON market_intelligence.market_intelligence_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_mi_logs_entity ON market_intelligence.market_intelligence_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_mi_logs_environment ON market_intelligence.market_intelligence_logs (environment);
CREATE INDEX IF NOT EXISTS idx_mi_logs_timestamp_severity ON market_intelligence.market_intelligence_logs (timestamp DESC, severity);

CREATE INDEX IF NOT EXISTS idx_mi_audit_timestamp ON market_intelligence.market_intelligence_audit_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_mi_audit_user ON market_intelligence.market_intelligence_audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_mi_audit_entity ON market_intelligence.market_intelligence_audit_logs (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_mi_error_timestamp ON market_intelligence.market_intelligence_error_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_mi_error_severity ON market_intelligence.market_intelligence_error_logs (severity);
CREATE INDEX IF NOT EXISTS idx_mi_error_resolved ON market_intelligence.market_intelligence_error_logs (resolved);
CREATE INDEX IF NOT EXISTS idx_mi_error_correlation ON market_intelligence.market_intelligence_error_logs (correlation_id);

CREATE INDEX IF NOT EXISTS idx_mi_event_timestamp ON market_intelligence.market_intelligence_event_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_mi_event_type ON market_intelligence.market_intelligence_event_logs (event_type);
CREATE INDEX IF NOT EXISTS idx_mi_event_correlation ON market_intelligence.market_intelligence_event_logs (correlation_id);

CREATE INDEX IF NOT EXISTS idx_mi_incident_status ON market_intelligence.market_intelligence_incidents (status);
CREATE INDEX IF NOT EXISTS idx_mi_incident_severity ON market_intelligence.market_intelligence_incidents (severity);
CREATE INDEX IF NOT EXISTS idx_mi_incident_assigned ON market_intelligence.market_intelligence_incidents (assigned_to);

CREATE INDEX IF NOT EXISTS idx_mi_timeline_correlation ON market_intelligence.market_intelligence_log_timeline (correlation_id);
CREATE INDEX IF NOT EXISTS idx_mi_timeline_timestamp ON market_intelligence.market_intelligence_log_timeline (timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_mi_export_status ON market_intelligence.market_intelligence_log_exports (status);
CREATE INDEX IF NOT EXISTS idx_mi_export_created ON market_intelligence.market_intelligence_log_exports (created_at DESC);

COMMIT;
