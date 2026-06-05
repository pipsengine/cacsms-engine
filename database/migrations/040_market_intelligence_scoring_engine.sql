BEGIN;

CREATE SCHEMA IF NOT EXISTS security;

CREATE TABLE IF NOT EXISTS security.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  resource text NOT NULL,
  action text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.scoring_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name text NOT NULL,
  environment text NOT NULL DEFAULT 'production',
  status text NOT NULL DEFAULT 'Draft',
  created_by text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_by text,
  approved_at timestamptz,
  activated_at timestamptz,
  change_summary text,
  UNIQUE (model_name, environment)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_scoring_models_one_active
  ON market.scoring_models (environment)
  WHERE status = 'Active';

CREATE TABLE IF NOT EXISTS market.scoring_model_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES market.scoring_models(id) ON DELETE CASCADE,
  model_version text NOT NULL,
  status text NOT NULL DEFAULT 'Draft',
  created_by text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_by text,
  approved_at timestamptz,
  activated_at timestamptz,
  change_summary text,
  UNIQUE (model_id, model_version)
);

CREATE TABLE IF NOT EXISTS market.scoring_model_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version_id uuid NOT NULL REFERENCES market.scoring_model_versions(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  module_label text NOT NULL,
  score_category text NOT NULL,
  weight_percent numeric(7, 4) NOT NULL,
  minimum_required_confidence numeric(7, 4) NOT NULL DEFAULT 60,
  enabled boolean NOT NULL DEFAULT true,
  required boolean NOT NULL DEFAULT false,
  last_changed_by text NOT NULL DEFAULT 'system',
  last_changed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (model_version_id, module_key)
);

CREATE TABLE IF NOT EXISTS market.scoring_input_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version_id uuid REFERENCES market.scoring_model_versions(id),
  input_snapshot jsonb NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.scoring_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version_id uuid REFERENCES market.scoring_model_versions(id),
  final_market_bias_score numeric(9, 4),
  final_confidence_score numeric(7, 4),
  trading_suitability_score numeric(7, 4),
  risk_score numeric(7, 4),
  signal_agreement_score numeric(7, 4),
  data_quality_score numeric(7, 4),
  source_reliability_score numeric(7, 4),
  market_opportunity_score numeric(7, 4),
  execution_safety_score numeric(7, 4),
  portfolio_safety_score numeric(7, 4),
  status text NOT NULL DEFAULT 'Calculated',
  triggered_by text NOT NULL DEFAULT 'system',
  duration_ms integer,
  error_message text,
  calculated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.scoring_result_breakdowns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id uuid REFERENCES market.scoring_results(id) ON DELETE CASCADE,
  score_name text NOT NULL,
  score_category text NOT NULL,
  current_value numeric(12, 4),
  label text,
  weight_percent numeric(7, 4),
  contribution numeric(12, 4),
  confidence numeric(7, 4),
  data_freshness text,
  source_health numeric(7, 4),
  last_calculation timestamptz,
  status text NOT NULL DEFAULT 'Calculated',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.scoring_instrument_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument text NOT NULL,
  market_environment numeric(12, 4),
  macro numeric(12, 4),
  sentiment numeric(12, 4),
  institutional numeric(12, 4),
  liquidity numeric(12, 4),
  risk numeric(12, 4),
  final_score numeric(12, 4),
  confidence numeric(7, 4),
  trading_bias text,
  action text,
  calculated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.scoring_signal_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument text NOT NULL,
  macro text,
  sentiment text,
  institutional text,
  market_environment text,
  liquidity text,
  portfolio_risk text,
  agreement_score numeric(7, 4),
  conflict_type text,
  recommendation text,
  calculated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.scoring_conflict_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument text,
  conflict_type text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.scoring_validation_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version_id uuid REFERENCES market.scoring_model_versions(id),
  result text NOT NULL,
  checks jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.scoring_recalculation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL,
  target text,
  status text NOT NULL DEFAULT 'completed',
  triggered_by text NOT NULL DEFAULT 'system',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  result_id uuid REFERENCES market.scoring_results(id)
);

CREATE TABLE IF NOT EXISTS market.scoring_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  severity text NOT NULL CHECK (severity IN ('info', 'warning', 'high_risk', 'critical')),
  title text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_by text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE IF NOT EXISTS market.scoring_ai_explanations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  explanation text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.scoring_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor text NOT NULL DEFAULT 'system',
  action text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result text NOT NULL DEFAULT 'accepted',
  created_at timestamptz NOT NULL DEFAULT now()
);

WITH model AS (
  INSERT INTO market.scoring_models (model_name, environment, status, created_by, approved_by, approved_at, activated_at, change_summary)
  VALUES ('CACSMS Approved Baseline', 'production', 'Active', 'system', 'system', now(), now(), 'Initial approved production scoring baseline')
  ON CONFLICT (model_name, environment) DO UPDATE SET status = 'Active'
  RETURNING id
),
version AS (
  INSERT INTO market.scoring_model_versions (model_id, model_version, status, created_by, approved_by, approved_at, activated_at, change_summary)
  SELECT id, '1.0.0', 'Active', 'system', 'system', now(), now(), 'Initial approved production scoring weights'
  FROM model
  ON CONFLICT (model_id, model_version) DO UPDATE SET status = 'Active'
  RETURNING id
)
INSERT INTO market.scoring_model_weights (model_version_id, module_key, module_label, score_category, weight_percent, minimum_required_confidence, enabled, required)
SELECT v.id, x.module_key, x.module_label, x.score_category, x.weight_percent, x.minimum_required_confidence, true, x.required
FROM version v
CROSS JOIN (VALUES
  ('market_environment', 'Market Environment', 'environment', 12, 60, true),
  ('macro', 'Macro Intelligence', 'macro', 10, 60, false),
  ('sentiment', 'Sentiment Intelligence', 'sentiment', 10, 60, false),
  ('institutional', 'Institutional Intelligence', 'institutional', 10, 60, false),
  ('broker_liquidity', 'Broker Liquidity', 'liquidity', 10, 60, false),
  ('portfolio', 'Portfolio Intelligence', 'portfolio', 10, 60, false),
  ('source_health', 'Source Health Review', 'data_quality', 10, 70, true),
  ('dependency_matrix', 'Dependency Matrix', 'dependency', 8, 60, false),
  ('news_sentiment', 'News Sentiment', 'sentiment', 5, 50, false),
  ('economic_calendar', 'Economic Calendar', 'macro', 5, 50, false),
  ('social_sentiment', 'Social Sentiment', 'sentiment', 3, 50, false),
  ('historical_data', 'Historical Data', 'data_quality', 3, 50, false),
  ('broker_data', 'Broker Data', 'liquidity', 2, 50, false),
  ('prop_firm_rules', 'Prop Firm Rules', 'risk', 2, 50, false)
) AS x(module_key, module_label, score_category, weight_percent, minimum_required_confidence, required)
ON CONFLICT (model_version_id, module_key) DO NOTHING;

INSERT INTO security.permissions (code, resource, action, description)
VALUES
  ('market_intelligence.scoring_engine.view', 'market_intelligence.scoring_engine', 'view', 'View scoring engine'),
  ('market_intelligence.scoring_engine.recalculate', 'market_intelligence.scoring_engine', 'recalculate', 'Recalculate scores'),
  ('market_intelligence.scoring_engine.configure_weights', 'market_intelligence.scoring_engine', 'configure_weights', 'Configure scoring weights'),
  ('market_intelligence.scoring_engine.approve_model', 'market_intelligence.scoring_engine', 'approve_model', 'Approve scoring model'),
  ('market_intelligence.scoring_engine.activate_model', 'market_intelligence.scoring_engine', 'activate_model', 'Activate scoring model'),
  ('market_intelligence.scoring_engine.validate', 'market_intelligence.scoring_engine', 'validate', 'Validate scoring model'),
  ('market_intelligence.scoring_engine.export', 'market_intelligence.scoring_engine', 'export', 'Export scoring reports'),
  ('market_intelligence.scoring_engine.create_alert', 'market_intelligence.scoring_engine', 'create_alert', 'Create scoring alerts')
ON CONFLICT (code) DO NOTHING;

COMMIT;
