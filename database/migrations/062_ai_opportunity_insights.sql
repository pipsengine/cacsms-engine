BEGIN;
CREATE SCHEMA IF NOT EXISTS market;
CREATE SCHEMA IF NOT EXISTS security;

CREATE TABLE IF NOT EXISTS market.scanner_ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_type text NOT NULL,
  asset text,
  title text NOT NULL,
  summary text NOT NULL,
  confidence_score numeric(7,4),
  grounding_status text NOT NULL DEFAULT 'Pending Generation',
  status text NOT NULL DEFAULT 'Generated',
  missing_inputs text,
  source_freshness text,
  review_status text NOT NULL DEFAULT 'Unreviewed',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.scanner_ai_insight_inputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_id uuid REFERENCES market.scanner_ai_insights(id) ON DELETE CASCADE,
  source_table text NOT NULL,
  source_id text,
  asset text,
  input_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  freshness text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.scanner_ai_insight_grounding_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_id uuid REFERENCES market.scanner_ai_insights(id) ON DELETE CASCADE,
  check_name text NOT NULL,
  status text NOT NULL,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.scanner_ai_opportunity_narratives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_id uuid REFERENCES market.scanner_ai_insights(id) ON DELETE SET NULL,
  asset text NOT NULL,
  direction text,
  opportunity_score numeric(7,4),
  confidence_score numeric(7,4),
  risk_score numeric(7,4),
  compliance_score numeric(7,4),
  why_ranked_high text,
  supporting_factors text,
  opposing_factors text,
  risk_warnings text,
  recommended_next_step text,
  grounding_status text NOT NULL DEFAULT 'Grounding Passed',
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.scanner_ai_risk_narratives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_id uuid REFERENCES market.scanner_ai_insights(id) ON DELETE SET NULL,
  asset text,
  narrative text NOT NULL,
  risk_driver text,
  risk_score numeric(7,4),
  recommended_control text,
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.scanner_ai_compliance_narratives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_id uuid REFERENCES market.scanner_ai_insights(id) ON DELETE SET NULL,
  asset text,
  narrative text NOT NULL,
  compliance_score numeric(7,4),
  compliance_warning text,
  recommended_action text,
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.scanner_ai_conflict_narratives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_id uuid REFERENCES market.scanner_ai_insights(id) ON DELETE SET NULL,
  asset text NOT NULL,
  conflict_type text,
  modules_involved text,
  severity text,
  ai_explanation text,
  recommended_resolution text,
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.scanner_ai_review_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_id uuid REFERENCES market.scanner_ai_insights(id) ON DELETE SET NULL,
  asset text NOT NULL,
  reason_for_review text NOT NULL,
  severity text NOT NULL DEFAULT 'Warning',
  reviewer_role text NOT NULL DEFAULT 'Trader',
  recommended_action text,
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.scanner_ai_generation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL,
  insights_generated integer NOT NULL DEFAULT 0,
  grounding_blocks integer NOT NULL DEFAULT 0,
  triggered_by text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS market.scanner_ai_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_id uuid,
  user_name text NOT NULL DEFAULT 'api',
  action text NOT NULL,
  entity_type text,
  entity_id text,
  reason text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.scanner_ai_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_id uuid,
  alert_type text NOT NULL,
  title text NOT NULL,
  severity text NOT NULL DEFAULT 'Info',
  asset text,
  status text NOT NULL DEFAULT 'Open',
  created_by text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO security.permissions (code, resource, action, description) VALUES
  ('universe_scanner.ai_insights.view','universe_scanner.ai_insights','view','View AI opportunity insights'),
  ('universe_scanner.ai_insights.generate','universe_scanner.ai_insights','generate','Generate AI opportunity insights'),
  ('universe_scanner.ai_insights.regenerate','universe_scanner.ai_insights','regenerate','Regenerate AI opportunity insights'),
  ('universe_scanner.ai_insights.review','universe_scanner.ai_insights','review','Review AI opportunity insights'),
  ('universe_scanner.ai_insights.archive','universe_scanner.ai_insights','archive','Archive AI opportunity insights'),
  ('universe_scanner.ai_insights.create_alert','universe_scanner.ai_insights','create_alert','Create AI insight alerts'),
  ('universe_scanner.ai_insights.export','universe_scanner.ai_insights','export','Export AI opportunity insight brief')
ON CONFLICT (code) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_scanner_ai_insights_time ON market.scanner_ai_insights(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_scanner_ai_insights_asset ON market.scanner_ai_insights(asset, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_scanner_ai_audit_time ON market.scanner_ai_audit_logs(created_at DESC);

COMMIT;
