BEGIN;

ALTER TABLE market.intelligence_packages
  ADD COLUMN IF NOT EXISTS package_type text,
  ADD COLUMN IF NOT EXISTS built_by text NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS scoring_status text,
  ADD COLUMN IF NOT EXISTS completeness_score numeric(7, 4),
  ADD COLUMN IF NOT EXISTS freshness_score numeric(7, 4),
  ADD COLUMN IF NOT EXISTS source_health_score numeric(7, 4),
  ADD COLUMN IF NOT EXISTS dependency_risk_score numeric(7, 4),
  ADD COLUMN IF NOT EXISTS conflict_score numeric(7, 4),
  ADD COLUMN IF NOT EXISTS readiness_score numeric(7, 4),
  ADD COLUMN IF NOT EXISTS validation_status text,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE TABLE IF NOT EXISTS market.intelligence_package_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id text NOT NULL REFERENCES market.intelligence_packages(package_id) ON DELETE CASCADE,
  item_type text NOT NULL,
  item_key text NOT NULL,
  item_label text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.intelligence_package_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id text NOT NULL REFERENCES market.intelligence_packages(package_id) ON DELETE CASCADE,
  module_key text NOT NULL,
  module_label text NOT NULL,
  status text NOT NULL,
  freshness text,
  confidence numeric(7, 4),
  completeness numeric(7, 4),
  health numeric(7, 4),
  required boolean NOT NULL DEFAULT false,
  source_timestamp timestamptz,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (package_id, module_key)
);

CREATE TABLE IF NOT EXISTS market.intelligence_package_input_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id text NOT NULL REFERENCES market.intelligence_packages(package_id) ON DELETE CASCADE,
  module_key text NOT NULL,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.intelligence_package_validation_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id text NOT NULL REFERENCES market.intelligence_packages(package_id) ON DELETE CASCADE,
  check_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('Passed','Warning','Failed','Blocked','Insufficient Data')),
  severity text NOT NULL DEFAULT 'Medium',
  detail text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.intelligence_package_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id text NOT NULL REFERENCES market.intelligence_packages(package_id) ON DELETE CASCADE,
  conflict_type text NOT NULL,
  affected_instrument text,
  modules_involved jsonb NOT NULL DEFAULT '[]'::jsonb,
  severity text NOT NULL CHECK (severity IN ('Low','Medium','High','Critical')),
  description text NOT NULL,
  resolution_recommendation text NOT NULL,
  status text NOT NULL DEFAULT 'Open',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.intelligence_package_ai_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id text NOT NULL REFERENCES market.intelligence_packages(package_id) ON DELETE CASCADE,
  summary text NOT NULL,
  bullish_factors jsonb NOT NULL DEFAULT '[]'::jsonb,
  bearish_factors jsonb NOT NULL DEFAULT '[]'::jsonb,
  missing_inputs jsonb NOT NULL DEFAULT '[]'::jsonb,
  risk_warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  ready_for_scoring boolean NOT NULL DEFAULT false,
  created_by text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.intelligence_package_scoring_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id text NOT NULL REFERENCES market.intelligence_packages(package_id) ON DELETE CASCADE,
  scoring_model_id uuid,
  status text NOT NULL DEFAULT 'Pending Scoring',
  submitted_by text NOT NULL DEFAULT 'system',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  response jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.intelligence_package_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id text REFERENCES market.intelligence_packages(package_id) ON DELETE SET NULL,
  actor text NOT NULL DEFAULT 'system',
  action text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result text NOT NULL DEFAULT 'accepted',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_package_builder_status ON market.intelligence_packages (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_package_builder_modules ON market.intelligence_package_modules (package_id, module_key);
CREATE INDEX IF NOT EXISTS idx_package_builder_validations ON market.intelligence_package_validation_results (package_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_package_builder_conflicts ON market.intelligence_package_conflicts (package_id, severity, status);

INSERT INTO security.permissions (code, resource, action, description)
VALUES
  ('market_intelligence.package_builder.view', 'market_intelligence.package_builder', 'view', 'View package builder'),
  ('market_intelligence.package_builder.build', 'market_intelligence.package_builder', 'build', 'Build intelligence package'),
  ('market_intelligence.package_builder.validate', 'market_intelligence.package_builder', 'validate', 'Validate intelligence package'),
  ('market_intelligence.package_builder.submit_to_scoring', 'market_intelligence.package_builder', 'submit_to_scoring', 'Submit package to scoring'),
  ('market_intelligence.package_builder.export', 'market_intelligence.package_builder', 'export', 'Export package'),
  ('market_intelligence.package_builder.archive', 'market_intelligence.package_builder', 'archive', 'Archive package'),
  ('market_intelligence.package_builder.configure', 'market_intelligence.package_builder', 'configure', 'Configure package builder')
ON CONFLICT (code) DO NOTHING;

COMMIT;
