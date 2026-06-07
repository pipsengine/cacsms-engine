BEGIN;

CREATE SCHEMA IF NOT EXISTS market;
CREATE SCHEMA IF NOT EXISTS security;

CREATE TABLE IF NOT EXISTS market.scanner_test_catalog (
  id text PRIMARY KEY,
  test_name text NOT NULL,
  category text NOT NULL,
  module text NOT NULL,
  description text,
  default_safety_mode text NOT NULL DEFAULT 'Read-Only Test',
  requires_approval boolean NOT NULL DEFAULT false,
  risk_level text NOT NULL DEFAULT 'Low',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.scanner_test_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id text REFERENCES market.scanner_test_catalog(id),
  test_name text NOT NULL,
  category text NOT NULL,
  module text NOT NULL,
  safety_mode text NOT NULL DEFAULT 'Read-Only Test',
  status text NOT NULL DEFAULT 'Running',
  triggered_by text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  duration_ms integer,
  failure_count integer NOT NULL DEFAULT 0,
  warning_count integer NOT NULL DEFAULT 0,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE market.scanner_test_runs
  ADD COLUMN IF NOT EXISTS risk_level text NOT NULL DEFAULT 'Low',
  ADD COLUMN IF NOT EXISTS input_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS market.scanner_test_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES market.scanner_test_runs(id) ON DELETE CASCADE,
  status text NOT NULL,
  expected_result text,
  actual_result text,
  warnings text,
  errors text,
  stack_trace text,
  affected_module text,
  recommended_fix text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.scanner_test_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES market.scanner_test_runs(id) ON DELETE CASCADE,
  check_name text NOT NULL,
  status text NOT NULL,
  detail text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.scanner_test_diagnostics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostic_type text NOT NULL,
  status text NOT NULL,
  passed_tests integer NOT NULL DEFAULT 0,
  warning_tests integer NOT NULL DEFAULT 0,
  failed_tests integer NOT NULL DEFAULT 0,
  blocked_tests integer NOT NULL DEFAULT 0,
  recommended_actions text,
  triggered_by text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.scanner_test_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.scanner_test_runs(id) ON DELETE CASCADE,
  failure_type text NOT NULL,
  severity text NOT NULL DEFAULT 'Error',
  message text NOT NULL,
  recommended_fix text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.scanner_test_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id text REFERENCES market.scanner_test_catalog(id),
  schedule_name text NOT NULL,
  frequency text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.scanner_test_readiness_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.scanner_test_runs(id) ON DELETE CASCADE,
  check_name text NOT NULL,
  status text NOT NULL,
  output text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.scanner_test_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid,
  user_name text NOT NULL DEFAULT 'api',
  action text NOT NULL,
  entity_type text,
  entity_id text,
  reason text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO market.scanner_test_catalog (id, test_name, category, module, description, default_safety_mode, requires_approval, risk_level) VALUES
('data-input-readiness','Data Input Readiness','Data Input Tests','Data Inputs','Validate live assets, broker mappings, live prices, source health, dependencies, calendar, sentiment, macro, and prop rule inputs.','Read-Only Test',false,'Low'),
('asset-universe-validation','Asset Universe Validation','Asset Universe Tests','Asset Universe','Validate active scanner-enabled assets and broker symbol mappings.','Read-Only Test',false,'Low'),
('currency-strength-engine','CurrencyStrengthEngine Validation','Currency Strength Tests','CurrencyStrengthEngine','Validate currency strength storage, score ranges, freshness, and audit coverage.','Read-Only Test',false,'Medium'),
('trend-scanner-engine','TrendScannerEngine Validation','Trend Scanner Tests','TrendScannerEngine','Validate trend scanner run/output tables, weight configuration, score ranges, and audit coverage.','Read-Only Test',false,'Medium'),
('market-structure-engine','MarketStructureScannerEngine Validation','Market Structure Tests','MarketStructureScannerEngine','Validate structure scanner run/output tables, score ranges, and audit coverage.','Read-Only Test',false,'Medium'),
('momentum-scanner-engine','MomentumScannerEngine Validation','Momentum Tests','MomentumScannerEngine','Validate momentum scanner run/output tables, score ranges, and audit coverage.','Read-Only Test',false,'Medium'),
('volatility-scanner-engine','VolatilityScannerEngine Validation','Volatility Tests','VolatilityScannerEngine','Validate volatility scanner run/output tables, score ranges, and audit coverage.','Read-Only Test',false,'Medium'),
('liquidity-scanner-engine','LiquidityScannerEngine Validation','Liquidity Tests','LiquidityScannerEngine','Validate liquidity scanner run/output tables, score ranges, and audit coverage.','Read-Only Test',false,'Medium'),
('institutional-scanner-engine','InstitutionalScannerEngine Validation','Institutional Tests','InstitutionalScannerEngine','Validate institutional scanner run/output tables, score ranges, and audit coverage.','Read-Only Test',false,'Medium'),
('sentiment-scanner-engine','SentimentScannerEngine Validation','Sentiment Tests','SentimentScannerEngine','Validate sentiment scanner inputs, score ranges, and audit coverage.','Read-Only Test',false,'Medium'),
('macro-scanner-engine','MacroScannerEngine Validation','Macro Tests','MacroScannerEngine','Validate macro scanner inputs, score ranges, and audit coverage.','Read-Only Test',false,'Medium'),
('economic-events-engine','EconomicEventsScannerEngine Validation','Economic Events Tests','EconomicEventsScannerEngine','Validate synced economic events, restriction windows, exposure outputs, and audit coverage.','Read-Only Test',false,'Medium'),
('risk-scanner-engine','RiskScannerEngine Validation','Risk Tests','RiskScannerEngine','Validate risk scanner outputs, score ranges, critical risk handling, and audit coverage.','Read-Only Test',false,'High'),
('prop-compliance-engine','PropFirmComplianceScannerEngine Validation','Prop Compliance Tests','PropFirmComplianceScannerEngine','Validate prop firm rules, compliance outputs, blocked assets, and audit coverage.','Read-Only Test',false,'High'),
('score-range-validation','Score Range Validation','End-to-End Diagnostic Tests','Score Engine','Validate all scanner and opportunity scores remain in approved numeric ranges.','Read-Only Test',false,'Medium'),
('opportunity-ranking-validation','Opportunity Ranking Validation','Opportunity Ranking Tests','OpportunityRankingEngine','Validate weights, ranking outputs, risk/compliance adjustments, confidence, and blocked asset handling.','Dry Run',false,'Medium'),
('qualified-trades-validation','Qualified Trades Validation','Qualified Trades Tests','QualifiedTradeCandidateEngine','Validate opportunity/risk/compliance/confidence thresholds, expiry, scoring readiness, and package readiness.','Read-Only Test',false,'Medium'),
('ai-grounding-validation','AI Grounding Validation','AI Insights Tests','AIOpportunityInsightsEngine','Validate AI insights are grounded in live scanner outputs, disclose missing data, and block unsupported claims.','Read-Only Test',false,'High'),
('control-center-validation','Scanner Control Validation','Control Center Tests','ScannerControlCenter','Validate scanner control state, jobs, workers, queues, schedules, and safety checks.','Read-Only Test',false,'Medium'),
('logs-validation','Scanner Logs Validation','Logs Tests','ScannerLogs','Validate scanner logs, audit logs, errors, incidents, retention, and diagnostic trail availability.','Read-Only Test',false,'Medium'),
('orchestration-sequence','Orchestration Sequence Validation','End-to-End Diagnostic Tests','Scanner Orchestration','Validate the Card 3 scanner sequence, dependency blocking, retry controls, and failure logging.','Read-Only Test',false,'High'),
('card3-readiness-diagnostic','Card 3 Readiness Diagnostic','End-to-End Diagnostic Tests','Card 3 Output','Validate Card 3 handoff readiness, qualified/no-op output, risk/compliance completion, AI handling, and audit trail.','Read-Only Test',false,'Critical')
ON CONFLICT (id) DO UPDATE SET
  test_name = EXCLUDED.test_name,
  category = EXCLUDED.category,
  module = EXCLUDED.module,
  description = EXCLUDED.description,
  default_safety_mode = EXCLUDED.default_safety_mode,
  requires_approval = EXCLUDED.requires_approval,
  risk_level = EXCLUDED.risk_level,
  enabled = true;

INSERT INTO market.scanner_test_schedules (test_id, schedule_name, frequency, enabled, created_by) VALUES
('card3-readiness-diagnostic','Every 15 Minutes','Every 15 Minutes',false,'migration'),
('card3-readiness-diagnostic','Hourly','Hourly',false,'migration'),
('card3-readiness-diagnostic','Daily','Daily',false,'migration'),
('data-input-readiness','Before Market Open','Before Market Open',false,'migration'),
('data-input-readiness','Before London Session','Before London Session',false,'migration'),
('data-input-readiness','Before New York Session','Before New York Session',false,'migration'),
('orchestration-sequence','Before Full Scanner Run','Before Full Scanner Run',false,'migration'),
('data-input-readiness','After Source Sync','After Source Sync',false,'migration')
ON CONFLICT DO NOTHING;

INSERT INTO security.permissions (code, resource, action, description) VALUES
('universe_scanner.test_harness.view','universe_scanner.test_harness','view','View universe scanner test harness'),
('universe_scanner.test_harness.run','universe_scanner.test_harness','run','Run universe scanner tests'),
('universe_scanner.test_harness.run_full_diagnostic','universe_scanner.test_harness','run_full_diagnostic','Run full universe scanner diagnostic'),
('universe_scanner.test_harness.approved_write_test','universe_scanner.test_harness','approved_write_test','Run approved write tests'),
('universe_scanner.test_harness.schedule','universe_scanner.test_harness','schedule','Schedule universe scanner tests'),
('universe_scanner.test_harness.export','universe_scanner.test_harness','export','Export universe scanner test reports'),
('universe_scanner.test_harness.create_incident','universe_scanner.test_harness','create_incident','Create incidents from scanner test failures'),
('universe_scanner.test_harness.view_sensitive','universe_scanner.test_harness','view_sensitive','View sensitive scanner test details')
ON CONFLICT (code) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_scanner_test_runs_started ON market.scanner_test_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_scanner_test_runs_status ON market.scanner_test_runs(status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_scanner_test_results_run ON market.scanner_test_results(run_id);
CREATE INDEX IF NOT EXISTS idx_scanner_test_checks_run ON market.scanner_test_checks(run_id);
CREATE INDEX IF NOT EXISTS idx_scanner_test_audit_time ON market.scanner_test_audit_logs(created_at DESC);

COMMIT;
