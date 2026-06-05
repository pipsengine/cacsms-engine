BEGIN;

CREATE TABLE IF NOT EXISTS market.validated_intelligence_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES workflow.workflow_runs(id) ON DELETE SET NULL,
  package_id text NOT NULL UNIQUE,
  workflow_run_id text,
  source_card_number smallint NOT NULL DEFAULT 1,
  target_card_number smallint NOT NULL DEFAULT 2,
  version text NOT NULL DEFAULT '1.0.0',
  status text NOT NULL DEFAULT 'VALIDATED',
  validation_status text NOT NULL DEFAULT 'PASSED',
  package_status text NOT NULL DEFAULT 'READY',
  workflow_permission text NOT NULL DEFAULT 'CONTINUE',
  validation_score numeric(7, 4),
  acceptance_score numeric(7, 4),
  data_confidence_score numeric(7, 4),
  freshness_score numeric(7, 4),
  source_coverage text,
  created_by text NOT NULL DEFAULT 'card_1.data_sources_validation',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  approved_at timestamptz
);

CREATE TABLE IF NOT EXISTS market.source_validation_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id text NOT NULL REFERENCES market.validated_intelligence_packages(package_id) ON DELETE CASCADE,
  source_id text NOT NULL,
  source_name text NOT NULL,
  provider text,
  required boolean NOT NULL DEFAULT false,
  status text NOT NULL,
  health numeric(7, 4),
  freshness text,
  coverage text,
  confidence numeric(7, 4),
  records integer,
  validation text NOT NULL DEFAULT 'PENDING',
  last_sync_at timestamptz,
  latency_ms integer,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.source_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id text NOT NULL REFERENCES market.validated_intelligence_packages(package_id) ON DELETE CASCADE,
  source_id text NOT NULL,
  evidence_type text NOT NULL DEFAULT 'runtime_probe',
  title text NOT NULL,
  status text NOT NULL DEFAULT 'RECORDED',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  collected_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.validation_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id text REFERENCES market.validated_intelligence_packages(package_id) ON DELETE SET NULL,
  action text NOT NULL,
  source text NOT NULL DEFAULT 'card_1',
  status text NOT NULL DEFAULT 'RECORDED',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_validated_packages_created ON market.validated_intelligence_packages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_validated_packages_run ON market.validated_intelligence_packages (run_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_source_validation_package ON market.source_validation_results (package_id, source_id);
CREATE INDEX IF NOT EXISTS idx_source_evidence_package ON market.source_evidence (package_id, source_id);
CREATE INDEX IF NOT EXISTS idx_validation_audit_package ON market.validation_audit_logs (package_id, created_at DESC);

COMMIT;
