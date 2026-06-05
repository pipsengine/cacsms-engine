BEGIN;

CREATE TABLE IF NOT EXISTS market.intelligence_handoff_destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_key text NOT NULL UNIQUE,
  destination_label text NOT NULL,
  engine_status text NOT NULL DEFAULT 'Available',
  api_health text NOT NULL DEFAULT 'Healthy',
  queue_status text NOT NULL DEFAULT 'Available',
  accepted_payload_version text NOT NULL DEFAULT '1.0.0',
  handoff_permission_required text NOT NULL,
  last_successful_handoff_at timestamptz,
  payload_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.intelligence_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handoff_id text NOT NULL UNIQUE,
  package_id text NOT NULL REFERENCES market.intelligence_packages(package_id) ON DELETE CASCADE,
  destination_key text NOT NULL REFERENCES market.intelligence_handoff_destinations(destination_key),
  priority text NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Critical','High','Normal','Low')),
  status text NOT NULL DEFAULT 'Ready',
  submitted_by text NOT NULL DEFAULT 'system',
  submitted_at timestamptz,
  accepted_at timestamptz,
  processing_time_ms integer,
  retry_count integer NOT NULL DEFAULT 0,
  result text,
  error_message text,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.intelligence_handoff_payloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handoff_id text NOT NULL REFERENCES market.intelligence_handoffs(handoff_id) ON DELETE CASCADE,
  payload_id text NOT NULL UNIQUE,
  payload_version text NOT NULL DEFAULT '1.0.0',
  checksum text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.intelligence_handoff_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handoff_id text NOT NULL REFERENCES market.intelligence_handoffs(handoff_id) ON DELETE CASCADE,
  check_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('Passed','Warning','Failed','Blocked')),
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.intelligence_handoff_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handoff_id text NOT NULL REFERENCES market.intelligence_handoffs(handoff_id) ON DELETE CASCADE,
  approver_role text NOT NULL,
  approver_name text,
  status text NOT NULL DEFAULT 'Not Required' CHECK (status IN ('Not Required','Pending','Approved','Rejected','Escalated')),
  decision_time timestamptz,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.intelligence_handoff_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handoff_id text NOT NULL REFERENCES market.intelligence_handoffs(handoff_id) ON DELETE CASCADE,
  package_id text NOT NULL,
  destination_key text NOT NULL,
  priority text NOT NULL,
  status text NOT NULL DEFAULT 'Queued',
  queued_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  processing_time_ms integer,
  retry_count integer NOT NULL DEFAULT 0,
  error text
);

CREATE TABLE IF NOT EXISTS market.intelligence_handoff_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handoff_id text NOT NULL REFERENCES market.intelligence_handoffs(handoff_id) ON DELETE CASCADE,
  status text NOT NULL,
  engine_response jsonb NOT NULL DEFAULT '{}'::jsonb,
  accepted_at timestamptz,
  processing_time_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.intelligence_handoff_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handoff_id text NOT NULL REFERENCES market.intelligence_handoffs(handoff_id) ON DELETE CASCADE,
  package_id text NOT NULL,
  destination_key text NOT NULL,
  failure_type text NOT NULL,
  error_message text NOT NULL,
  severity text NOT NULL DEFAULT 'High',
  retryable boolean NOT NULL DEFAULT true,
  recommended_fix text NOT NULL,
  status text NOT NULL DEFAULT 'Open',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.intelligence_handoff_retries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handoff_id text NOT NULL REFERENCES market.intelligence_handoffs(handoff_id) ON DELETE CASCADE,
  retry_number integer NOT NULL,
  retried_by text NOT NULL DEFAULT 'system',
  status text NOT NULL DEFAULT 'Retried',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.intelligence_handoff_ai_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handoff_id text REFERENCES market.intelligence_handoffs(handoff_id) ON DELETE CASCADE,
  summary text NOT NULL,
  ready_packages jsonb NOT NULL DEFAULT '[]'::jsonb,
  blocked_packages jsonb NOT NULL DEFAULT '[]'::jsonb,
  healthy_destinations jsonb NOT NULL DEFAULT '[]'::jsonb,
  retry_guidance text,
  risk_review jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.intelligence_handoff_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handoff_id text REFERENCES market.intelligence_handoffs(handoff_id) ON DELETE SET NULL,
  actor text NOT NULL DEFAULT 'system',
  action text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result text NOT NULL DEFAULT 'accepted',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intelligence_handoffs_status ON market.intelligence_handoffs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intelligence_handoffs_package ON market.intelligence_handoffs(package_id, destination_key, status);
CREATE INDEX IF NOT EXISTS idx_handoff_queue_status ON market.intelligence_handoff_queue(status, queued_at DESC);
CREATE INDEX IF NOT EXISTS idx_handoff_failures_status ON market.intelligence_handoff_failures(status, severity, created_at DESC);

INSERT INTO market.intelligence_handoff_destinations (destination_key, destination_label, engine_status, api_health, queue_status, accepted_payload_version, handoff_permission_required, payload_schema)
VALUES
  ('scoring_engine', 'Scoring Engine', 'Available', 'Healthy', 'Available', '1.0.0', 'market_intelligence.handoff.submit', '{"type":"decision_package"}'::jsonb),
  ('ai_decision_engine', 'AI Decision Engine', 'Available', 'Healthy', 'Available', '1.0.0', 'market_intelligence.handoff.submit', '{"type":"decision_package"}'::jsonb),
  ('strategy_engine', 'Strategy Engine', 'Available', 'Healthy', 'Available', '1.0.0', 'market_intelligence.handoff.submit', '{"type":"strategy_input"}'::jsonb),
  ('risk_engine', 'Risk Engine', 'Available', 'Healthy', 'Available', '1.0.0', 'market_intelligence.handoff.submit', '{"type":"risk_input"}'::jsonb),
  ('backtesting_engine', 'Backtesting Engine', 'Available', 'Healthy', 'Available', '1.0.0', 'market_intelligence.handoff.submit', '{"type":"backtest_input"}'::jsonb),
  ('portfolio_intelligence', 'Portfolio Intelligence', 'Available', 'Healthy', 'Available', '1.0.0', 'market_intelligence.handoff.submit', '{"type":"portfolio_input"}'::jsonb),
  ('alert_engine', 'Alert Engine', 'Available', 'Healthy', 'Available', '1.0.0', 'market_intelligence.handoff.submit', '{"type":"alert_input"}'::jsonb),
  ('trade_execution_engine', 'Trade Execution Engine', 'Unavailable', 'Offline', 'Unavailable', '1.0.0', 'market_intelligence.handoff.submit', '{"type":"execution_input"}'::jsonb),
  ('audit_archive', 'Audit Archive', 'Available', 'Healthy', 'Available', '1.0.0', 'market_intelligence.handoff.archive', '{"type":"audit_archive"}'::jsonb)
ON CONFLICT (destination_key) DO NOTHING;

INSERT INTO security.permissions (code, resource, action, description)
VALUES
  ('market_intelligence.handoff.view', 'market_intelligence.handoff', 'view', 'View intelligence handoffs'),
  ('market_intelligence.handoff.create', 'market_intelligence.handoff', 'create', 'Create intelligence handoff'),
  ('market_intelligence.handoff.validate', 'market_intelligence.handoff', 'validate', 'Validate intelligence handoff'),
  ('market_intelligence.handoff.approve', 'market_intelligence.handoff', 'approve', 'Approve intelligence handoff'),
  ('market_intelligence.handoff.submit', 'market_intelligence.handoff', 'submit', 'Submit intelligence handoff'),
  ('market_intelligence.handoff.retry', 'market_intelligence.handoff', 'retry', 'Retry intelligence handoff'),
  ('market_intelligence.handoff.cancel', 'market_intelligence.handoff', 'cancel', 'Cancel intelligence handoff'),
  ('market_intelligence.handoff.export', 'market_intelligence.handoff', 'export', 'Export intelligence handoff'),
  ('market_intelligence.handoff.archive', 'market_intelligence.handoff', 'archive', 'Archive intelligence handoff')
ON CONFLICT (code) DO NOTHING;

COMMIT;
