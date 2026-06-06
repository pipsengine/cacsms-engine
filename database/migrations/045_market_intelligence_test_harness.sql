-- Market Intelligence Test Harness Migration
-- Production-safe test catalog, runs, results, diagnostics, schedules, and audit logs.

BEGIN;

CREATE SCHEMA IF NOT EXISTS market_intelligence;

CREATE TABLE IF NOT EXISTS market_intelligence.test_harness_catalog (
  id text PRIMARY KEY,
  test_name text NOT NULL,
  category text NOT NULL,
  module text NOT NULL,
  description text NOT NULL,
  default_safety_mode text NOT NULL DEFAULT 'read_only',
  requires_approval boolean NOT NULL DEFAULT false,
  risk_level text NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market_intelligence.test_harness_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id text REFERENCES market_intelligence.test_harness_catalog(id),
  test_name text NOT NULL,
  category text NOT NULL,
  module text NOT NULL,
  safety_mode text NOT NULL CHECK (safety_mode IN ('read_only', 'dry_run', 'transactional', 'approved_write', 'sandbox_account')),
  status text NOT NULL CHECK (status IN ('passed', 'warning', 'failed', 'blocked', 'skipped', 'running')),
  triggered_by text NOT NULL DEFAULT 'system',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  duration_ms integer,
  failure_count integer NOT NULL DEFAULT 0,
  warning_count integer NOT NULL DEFAULT 0,
  risk_level text,
  input_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market_intelligence.test_harness_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES market_intelligence.test_harness_runs(id) ON DELETE CASCADE,
  expected_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  actual_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  checks_performed jsonb NOT NULL DEFAULT '[]'::jsonb,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  stack_trace text,
  related_logs jsonb NOT NULL DEFAULT '[]'::jsonb,
  affected_module text,
  recommended_fix text,
  audit_trail jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market_intelligence.test_harness_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES market_intelligence.test_harness_runs(id) ON DELETE CASCADE,
  check_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('passed', 'warning', 'failed', 'blocked', 'skipped')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market_intelligence.test_harness_diagnostics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL CHECK (status IN ('passed', 'warning', 'failed', 'blocked', 'running')),
  safety_mode text NOT NULL,
  triggered_by text NOT NULL DEFAULT 'system',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  run_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  passed integer NOT NULL DEFAULT 0,
  warnings integer NOT NULL DEFAULT 0,
  failures integer NOT NULL DEFAULT 0,
  blocked_tests integer NOT NULL DEFAULT 0,
  recommended_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market_intelligence.test_harness_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market_intelligence.test_harness_runs(id) ON DELETE CASCADE,
  failure_type text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  message text NOT NULL,
  recommended_fix text,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market_intelligence.test_harness_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id text REFERENCES market_intelligence.test_harness_catalog(id),
  schedule_name text NOT NULL,
  cron_expression text,
  safety_mode text NOT NULL DEFAULT 'read_only',
  enabled boolean NOT NULL DEFAULT false,
  created_by text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market_intelligence.test_harness_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid,
  user_name text,
  action text NOT NULL,
  entity_type text NOT NULL DEFAULT 'test_harness',
  entity_id text,
  before_value jsonb,
  after_value jsonb,
  reason text,
  ip_address text,
  environment text NOT NULL DEFAULT 'production',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_test_harness_runs_started ON market_intelligence.test_harness_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_harness_runs_status ON market_intelligence.test_harness_runs(status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_harness_results_run ON market_intelligence.test_harness_results(run_id);
CREATE INDEX IF NOT EXISTS idx_test_harness_audit_time ON market_intelligence.test_harness_audit_logs(created_at DESC);

INSERT INTO market_intelligence.test_harness_catalog (id, test_name, category, module, description, default_safety_mode, requires_approval, risk_level)
VALUES
  ('source-registry-check', 'Source Registry Check', 'Source Connectivity Tests', 'source-health', 'Verify production source registry has enabled live sources and no disabled critical gaps.', 'read_only', false, 'low'),
  ('provider-connectivity-check', 'Provider Connectivity Check', 'Provider Authentication Tests', 'source-health', 'Verify provider health, credentials metadata, endpoint reachability status, latency, and rate-limit state from production records.', 'read_only', false, 'medium'),
  ('sync-readiness-check', 'Sync Job Readiness Check', 'Sync Job Tests', 'source-sync', 'Verify recent production sync jobs, dry-run readiness, retry state, and failure recovery signals.', 'dry_run', false, 'medium'),
  ('validation-rule-check', 'Validation Rule Check', 'Data Validation Tests', 'validation', 'Verify production validation logs and known validation issue counts without writing test rows.', 'read_only', false, 'medium'),
  ('dependency-matrix-check', 'Dependency Matrix Check', 'Dependency Matrix Tests', 'dependency-matrix', 'Verify dependency graph records, source dependencies, and recent dependency audit activity.', 'read_only', false, 'low'),
  ('package-builder-readiness', 'Package Builder Readiness', 'Package Builder Tests', 'package-builder', 'Verify package builder production packages, validation readiness, and audit state.', 'read_only', false, 'medium'),
  ('validated-package-check', 'Validated Package Check', 'Validated Package Tests', 'validated-package', 'Verify validated package records and readiness for downstream scoring.', 'read_only', false, 'medium'),
  ('scoring-engine-validation', 'Scoring Engine Validation', 'Scoring Engine Tests', 'scoring-engine', 'Verify active scoring models, weight totals, scoring audit state, and production scoring readiness.', 'read_only', false, 'high'),
  ('handoff-readiness-check', 'Handoff Readiness Check', 'Handoff Tests', 'handoff', 'Verify handoff destinations, queue state, schema readiness, and recent handoff audit activity.', 'read_only', false, 'high'),
  ('alert-dry-run-check', 'Alert Dry Run Check', 'Alert Tests', 'alerts', 'Evaluate alert-rule infrastructure and duplicate suppression state in dry-run mode without external notification delivery.', 'dry_run', false, 'medium'),
  ('ai-output-grounding-check', 'AI Output Grounding Check', 'AI Summary Tests', 'ai-summary', 'Verify AI summary records are grounded by production inputs and disclose missing data.', 'read_only', false, 'medium'),
  ('permission-safety-check', 'Permission Safety Check', 'Permission Tests', 'permissions', 'Verify required Market Intelligence test harness permissions exist for guarded operations.', 'read_only', false, 'low'),
  ('database-integrity-check', 'Database Integrity Check', 'Database Integrity Tests', 'database', 'Verify required production Market Intelligence test harness and integration tables exist.', 'read_only', false, 'critical'),
  ('performance-baseline-check', 'Performance Baseline Check', 'Performance Tests', 'performance', 'Verify recorded operation durations and provider latency remain available for performance review.', 'read_only', false, 'medium')
ON CONFLICT (id) DO UPDATE SET
  test_name = EXCLUDED.test_name,
  category = EXCLUDED.category,
  module = EXCLUDED.module,
  description = EXCLUDED.description,
  default_safety_mode = EXCLUDED.default_safety_mode,
  requires_approval = EXCLUDED.requires_approval,
  risk_level = EXCLUDED.risk_level,
  updated_at = now();

INSERT INTO security.permissions (code, resource, action, description)
VALUES
  ('market_intelligence.test_harness.view', 'market_intelligence.test_harness', 'view', 'View Market Intelligence test harness'),
  ('market_intelligence.test_harness.run', 'market_intelligence.test_harness', 'run', 'Run read-only and dry-run Market Intelligence tests'),
  ('market_intelligence.test_harness.run_full_diagnostic', 'market_intelligence.test_harness', 'run_full_diagnostic', 'Run full Market Intelligence diagnostic'),
  ('market_intelligence.test_harness.approved_write_test', 'market_intelligence.test_harness', 'approved_write_test', 'Run approved write tests'),
  ('market_intelligence.test_harness.export', 'market_intelligence.test_harness', 'export', 'Export test harness reports'),
  ('market_intelligence.test_harness.create_incident', 'market_intelligence.test_harness', 'create_incident', 'Create incidents from test failures'),
  ('market_intelligence.test_harness.view_sensitive', 'market_intelligence.test_harness', 'view_sensitive', 'View sensitive test harness details')
ON CONFLICT (code) DO NOTHING;

COMMIT;
