BEGIN;

CREATE TABLE IF NOT EXISTS market.intelligence_scoring_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name text NOT NULL,
  environment text NOT NULL DEFAULT 'production',
  status text NOT NULL DEFAULT 'Production',
  created_by text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_by text,
  approved_at timestamptz,
  activated_at timestamptz,
  formula jsonb NOT NULL DEFAULT '{}'::jsonb,
  change_summary text,
  UNIQUE (model_name, environment)
);

CREATE TABLE IF NOT EXISTS market.intelligence_model_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES market.intelligence_scoring_models(id) ON DELETE CASCADE,
  model_version text NOT NULL,
  state text NOT NULL DEFAULT 'Production' CHECK (state IN ('Draft','Testing','Approved','Production','Archived')),
  created_by text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_by text,
  approved_at timestamptz,
  activated_at timestamptz,
  change_summary text,
  UNIQUE (model_id, model_version)
);

CREATE TABLE IF NOT EXISTS market.intelligence_score_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version_id uuid NOT NULL REFERENCES market.intelligence_model_versions(id) ON DELETE CASCADE,
  layer_key text NOT NULL,
  layer_label text NOT NULL,
  weight_percent numeric(7, 4) NOT NULL,
  minimum_score numeric(7, 4),
  maximum_score numeric(7, 4),
  enabled boolean NOT NULL DEFAULT true,
  last_changed_by text NOT NULL DEFAULT 'system',
  last_changed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (model_version_id, layer_key)
);

CREATE TABLE IF NOT EXISTS market.intelligence_score_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version_id uuid REFERENCES market.intelligence_model_versions(id),
  market_score numeric(7, 4),
  opportunity_score numeric(7, 4),
  risk_score numeric(7, 4),
  execution_score numeric(7, 4),
  portfolio_score numeric(7, 4),
  confidence_score numeric(7, 4),
  compliance_score numeric(7, 4),
  final_decision_score numeric(7, 4),
  recommendation text,
  status text NOT NULL DEFAULT 'Calculated',
  source_mode text NOT NULL DEFAULT 'PRODUCTION_LIVE_ONLY',
  triggered_by text NOT NULL DEFAULT 'system',
  calculated_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.intelligence_score_breakdowns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id uuid REFERENCES market.intelligence_score_results(id) ON DELETE CASCADE,
  layer_key text NOT NULL,
  component_name text NOT NULL,
  component_score numeric(12, 4),
  max_score numeric(12, 4) NOT NULL DEFAULT 100,
  contribution numeric(12, 4),
  explanation text,
  source_module text,
  source_status text,
  source_timestamp timestamptz,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.intelligence_opportunity_rankings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id uuid REFERENCES market.intelligence_score_results(id) ON DELETE CASCADE,
  rank integer NOT NULL,
  instrument text NOT NULL,
  market_score numeric(7, 4),
  opportunity_score numeric(7, 4),
  risk_score numeric(7, 4),
  execution_score numeric(7, 4),
  confidence_score numeric(7, 4),
  final_score numeric(7, 4),
  recommendation text,
  calculated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.intelligence_trade_qualifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id uuid REFERENCES market.intelligence_score_results(id) ON DELETE CASCADE,
  instrument text NOT NULL,
  qualifies boolean NOT NULL,
  market_score numeric(7, 4),
  opportunity_score numeric(7, 4),
  risk_score numeric(7, 4),
  confidence_score numeric(7, 4),
  compliance_score numeric(7, 4),
  failed_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  thresholds jsonb NOT NULL DEFAULT '{}'::jsonb,
  recommendation text,
  calculated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.intelligence_signal_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id uuid REFERENCES market.intelligence_score_results(id) ON DELETE CASCADE,
  instrument text,
  conflict_type text NOT NULL,
  severity text NOT NULL,
  resolution_recommendation text NOT NULL,
  supporting_signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  opposing_signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.intelligence_signal_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id uuid REFERENCES market.intelligence_score_results(id) ON DELETE CASCADE,
  instrument text NOT NULL,
  macro text,
  sentiment text,
  institutional text,
  environment text,
  liquidity text,
  portfolio text,
  agreement_percent numeric(7, 4),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.intelligence_score_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id uuid REFERENCES market.intelligence_score_results(id) ON DELETE SET NULL,
  period text NOT NULL CHECK (period IN ('daily','weekly','monthly')),
  final_score numeric(7, 4),
  confidence_score numeric(7, 4),
  risk_score numeric(7, 4),
  opportunity_score numeric(7, 4),
  bucket_start timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.intelligence_ai_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id uuid REFERENCES market.intelligence_score_results(id) ON DELETE CASCADE,
  instrument text,
  qualifies boolean,
  why_trade_qualifies text,
  why_trade_fails text,
  supporting_factors jsonb NOT NULL DEFAULT '[]'::jsonb,
  opposing_factors jsonb NOT NULL DEFAULT '[]'::jsonb,
  risk_warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommended_position_size text,
  suggested_risk_percent numeric(7, 4),
  suggested_session text,
  suggested_holding_period text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.intelligence_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor text NOT NULL DEFAULT 'system',
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result text NOT NULL DEFAULT 'accepted',
  created_at timestamptz NOT NULL DEFAULT now()
);

WITH model AS (
  INSERT INTO market.intelligence_scoring_models (model_name, environment, status, created_by, approved_by, approved_at, activated_at, change_summary, formula)
  VALUES (
    'CACSMS Intelligence Decision Baseline',
    'production',
    'Production',
    'system',
    'system',
    now(),
    now(),
    'Initial production decision-layer scoring formula',
    '{"market_score":20,"opportunity_score":20,"risk_score":15,"execution_score":15,"portfolio_score":10,"confidence_score":10,"compliance_score":10}'::jsonb
  )
  ON CONFLICT (model_name, environment) DO UPDATE
    SET status = 'Production',
        formula = EXCLUDED.formula
  RETURNING id
),
version AS (
  INSERT INTO market.intelligence_model_versions (model_id, model_version, state, created_by, approved_by, approved_at, activated_at, change_summary)
  SELECT id, '1.0.0', 'Production', 'system', 'system', now(), now(), 'Initial approved decision engine model'
  FROM model
  ON CONFLICT (model_id, model_version) DO UPDATE SET state = 'Production'
  RETURNING id
)
INSERT INTO market.intelligence_score_weights (model_version_id, layer_key, layer_label, weight_percent, minimum_score, maximum_score, enabled)
SELECT v.id, x.layer_key, x.layer_label, x.weight_percent, x.minimum_score, x.maximum_score, true
FROM version v
CROSS JOIN (VALUES
  ('market_score', 'Market Score', 20, 70, NULL),
  ('opportunity_score', 'Opportunity Score', 20, 75, NULL),
  ('risk_score', 'Risk Score', 15, NULL, 30),
  ('execution_score', 'Execution Score', 15, 60, NULL),
  ('portfolio_score', 'Portfolio Score', 10, 60, NULL),
  ('confidence_score', 'Confidence Score', 10, 70, NULL),
  ('compliance_score', 'Compliance Score', 10, 90, NULL)
) AS x(layer_key, layer_label, weight_percent, minimum_score, maximum_score)
ON CONFLICT (model_version_id, layer_key) DO UPDATE
  SET weight_percent = EXCLUDED.weight_percent,
      minimum_score = EXCLUDED.minimum_score,
      maximum_score = EXCLUDED.maximum_score;

COMMIT;
