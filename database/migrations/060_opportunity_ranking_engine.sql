BEGIN;
CREATE SCHEMA IF NOT EXISTS market;
CREATE SCHEMA IF NOT EXISTS security;

CREATE TABLE IF NOT EXISTS market.asset_opportunity_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid,
  asset_id uuid,
  asset text NOT NULL,
  asset_class text,
  direction text,
  technical_score numeric(7,4),
  structure_score numeric(7,4),
  momentum_score numeric(7,4),
  volatility_score numeric(7,4),
  liquidity_score numeric(7,4),
  institutional_score numeric(7,4),
  sentiment_score numeric(7,4),
  macro_score numeric(7,4),
  event_score numeric(7,4),
  risk_score numeric(7,4),
  compliance_score numeric(7,4),
  confidence_score numeric(7,4),
  risk_adjusted_score numeric(7,4),
  compliance_adjusted_score numeric(7,4),
  final_opportunity_score numeric(7,4),
  qualification text,
  main_reason text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_ranked timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_opportunity_rankings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid,
  rank integer,
  asset_id uuid,
  asset text NOT NULL,
  asset_class text,
  direction text,
  opportunity_score numeric(7,4),
  confidence_score numeric(7,4),
  risk_score numeric(7,4),
  compliance_score numeric(7,4),
  trend_score numeric(7,4),
  structure_score numeric(7,4),
  momentum_score numeric(7,4),
  volatility_score numeric(7,4),
  liquidity_score numeric(7,4),
  institutional_score numeric(7,4),
  sentiment_score numeric(7,4),
  macro_score numeric(7,4),
  event_score numeric(7,4),
  main_reason text,
  qualification text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_ranked timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_opportunity_score_breakdowns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset text NOT NULL,
  component_key text NOT NULL,
  component_name text NOT NULL,
  raw_score numeric(7,4),
  normalized_score numeric(7,4),
  weight numeric(7,4),
  weighted_contribution numeric(7,4),
  confidence numeric(7,4),
  source_status text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_opportunity_weight_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_name text NOT NULL DEFAULT 'Production Default',
  component_key text NOT NULL,
  component_name text NOT NULL,
  weight numeric(7,4) NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  required boolean NOT NULL DEFAULT true,
  approved boolean NOT NULL DEFAULT true,
  approved_by text,
  approved_at timestamptz,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_name, component_key)
);

CREATE TABLE IF NOT EXISTS market.asset_opportunity_signal_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset text NOT NULL,
  trend text,
  structure text,
  momentum text,
  liquidity text,
  institutional text,
  sentiment text,
  macro text,
  risk text,
  compliance text,
  agreement_score numeric(7,4),
  conflict_level text,
  interpretation text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_opportunity_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset text NOT NULL,
  conflict_type text NOT NULL,
  severity text NOT NULL,
  description text,
  recommended_action text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_opportunity_readiness_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset text NOT NULL,
  status text NOT NULL,
  opportunity_threshold_passed boolean,
  confidence_threshold_passed boolean,
  risk_threshold_passed boolean,
  compliance_threshold_passed boolean,
  critical_blocker_clear boolean,
  conflict_clear boolean,
  freshness_passed boolean,
  source_health_passed boolean,
  recommendation text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  checked_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_opportunity_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset text NOT NULL,
  previous_rank integer,
  current_rank integer,
  rank_change integer,
  previous_score numeric(7,4),
  current_score numeric(7,4),
  score_change numeric(7,4),
  trigger text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_opportunity_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  title text NOT NULL,
  severity text NOT NULL DEFAULT 'Info',
  asset text,
  status text NOT NULL DEFAULT 'Open',
  created_by text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_opportunity_ai_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  top_ranked_opportunities text,
  best_buy_candidates text,
  best_sell_candidates text,
  top_ranking_reasons text,
  rejected_assets text,
  main_risks text,
  signal_conflicts text,
  recommended_next_action text,
  summary text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_opportunity_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid,
  user_name text NOT NULL DEFAULT 'api',
  action text NOT NULL,
  entity_type text,
  entity_id text,
  reason text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_opportunity_ranking_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'Queued',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  duration_ms integer,
  assets_ranked integer NOT NULL DEFAULT 0,
  health text,
  triggered_by text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE market.asset_opportunity_scores
  ADD COLUMN IF NOT EXISTS last_ranked timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS direction text,
  ADD COLUMN IF NOT EXISTS confidence_score numeric(7,4),
  ADD COLUMN IF NOT EXISTS final_opportunity_score numeric(7,4),
  ADD COLUMN IF NOT EXISTS qualification text,
  ADD COLUMN IF NOT EXISTS main_reason text,
  ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE market.asset_opportunity_rankings
  ADD COLUMN IF NOT EXISTS last_ranked timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS direction text,
  ADD COLUMN IF NOT EXISTS opportunity_score numeric(7,4),
  ADD COLUMN IF NOT EXISTS confidence_score numeric(7,4),
  ADD COLUMN IF NOT EXISTS risk_score numeric(7,4),
  ADD COLUMN IF NOT EXISTS compliance_score numeric(7,4),
  ADD COLUMN IF NOT EXISTS main_reason text,
  ADD COLUMN IF NOT EXISTS qualification text,
  ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}'::jsonb;

INSERT INTO market.asset_opportunity_weight_profiles (component_key, component_name, weight, required, approved, approved_at) VALUES
  ('trend','Trend Score',12,true,true,now()),
  ('structure','Market Structure Score',12,true,true,now()),
  ('momentum','Momentum Score',10,true,true,now()),
  ('volatility','Volatility Score',8,true,true,now()),
  ('liquidity','Liquidity Score',10,true,true,now()),
  ('institutional','Institutional Score',12,true,true,now()),
  ('sentiment','Sentiment Score',8,true,true,now()),
  ('macro','Macro Score',10,true,true,now()),
  ('event','Economic Event Score',6,true,true,now()),
  ('risk','Risk Score Adjustment',7,true,true,now()),
  ('compliance','Compliance Score Adjustment',5,true,true,now())
ON CONFLICT (profile_name, component_key) DO NOTHING;

INSERT INTO security.permissions (code, resource, action, description) VALUES
  ('universe_scanner.opportunities.view','universe_scanner.opportunities','view','View opportunity rankings'),
  ('universe_scanner.opportunities.run_ranking','universe_scanner.opportunities','run_ranking','Run opportunity ranking'),
  ('universe_scanner.opportunities.recalculate','universe_scanner.opportunities','recalculate','Recalculate opportunity scores'),
  ('universe_scanner.opportunities.configure_weights','universe_scanner.opportunities','configure_weights','Configure opportunity weights'),
  ('universe_scanner.opportunities.send_to_qualified','universe_scanner.opportunities','send_to_qualified','Send opportunity to qualified trades'),
  ('universe_scanner.opportunities.create_package','universe_scanner.opportunities','create_package','Create opportunity intelligence package'),
  ('universe_scanner.opportunities.create_alert','universe_scanner.opportunities','create_alert','Create opportunity alerts'),
  ('universe_scanner.opportunities.export','universe_scanner.opportunities','export','Export opportunity ranking report')
ON CONFLICT (code) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_asset_opportunity_scores_asset_time ON market.asset_opportunity_scores(asset, last_ranked DESC);
CREATE INDEX IF NOT EXISTS idx_asset_opportunity_rankings_rank ON market.asset_opportunity_rankings(rank, last_ranked DESC);
CREATE INDEX IF NOT EXISTS idx_asset_opportunity_history_time ON market.asset_opportunity_history(observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_asset_opportunity_alerts_time ON market.asset_opportunity_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_asset_opportunity_audit_time ON market.asset_opportunity_audit_logs(created_at DESC);

COMMIT;
