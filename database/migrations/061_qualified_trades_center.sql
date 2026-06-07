BEGIN;
CREATE SCHEMA IF NOT EXISTS market;
CREATE SCHEMA IF NOT EXISTS security;

ALTER TABLE market.qualified_trade_candidates
  ADD COLUMN IF NOT EXISTS asset_id uuid,
  ADD COLUMN IF NOT EXISTS asset_class text,
  ADD COLUMN IF NOT EXISTS signal_agreement numeric(7,4),
  ADD COLUMN IF NOT EXISTS package_status text NOT NULL DEFAULT 'Not Created',
  ADD COLUMN IF NOT EXISTS scoring_status text NOT NULL DEFAULT 'Not Submitted',
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS market.qualified_trade_candidate_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid REFERENCES market.qualified_trade_candidates(id) ON DELETE CASCADE,
  score_key text NOT NULL,
  score_name text NOT NULL,
  score_value numeric(7,4),
  threshold_value numeric(7,4),
  status text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.qualified_trade_candidate_readiness (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid REFERENCES market.qualified_trade_candidates(id) ON DELETE CASCADE,
  opportunity_passed text NOT NULL DEFAULT 'Not Checked',
  risk_passed text NOT NULL DEFAULT 'Not Checked',
  compliance_passed text NOT NULL DEFAULT 'Not Checked',
  confidence_passed text NOT NULL DEFAULT 'Not Checked',
  signal_agreement_passed text NOT NULL DEFAULT 'Not Checked',
  source_health_passed text NOT NULL DEFAULT 'Not Checked',
  dependency_health_passed text NOT NULL DEFAULT 'Not Checked',
  freshness_passed text NOT NULL DEFAULT 'Not Checked',
  expiry_passed text NOT NULL DEFAULT 'Not Checked',
  readiness_score numeric(7,4),
  status text NOT NULL DEFAULT 'Not Checked',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  checked_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.qualified_trade_candidate_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid REFERENCES market.qualified_trade_candidates(id) ON DELETE CASCADE,
  package_type text NOT NULL,
  recommended_package text,
  package_status text NOT NULL DEFAULT 'Created',
  package_id uuid,
  created_by text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.qualified_trade_candidate_scoring_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid REFERENCES market.qualified_trade_candidates(id) ON DELETE CASCADE,
  scoring_model text,
  eligibility text,
  submission_status text NOT NULL DEFAULT 'Submitted',
  submitted_by text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.qualified_trade_candidate_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid REFERENCES market.qualified_trade_candidates(id) ON DELETE CASCADE,
  review_reason text NOT NULL,
  weakest_component text,
  severity text NOT NULL DEFAULT 'Warning',
  recommended_action text,
  assigned_to text,
  status text NOT NULL DEFAULT 'Open',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.qualified_trade_candidate_expiry_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_class text NOT NULL,
  timeframe text NOT NULL DEFAULT 'Default',
  expiry_minutes integer NOT NULL DEFAULT 240,
  volatility_regime_expiry boolean NOT NULL DEFAULT true,
  score_drop_threshold numeric(7,4) NOT NULL DEFAULT 10,
  risk_increase_threshold numeric(7,4) NOT NULL DEFAULT 10,
  compliance_drop_threshold numeric(7,4) NOT NULL DEFAULT 5,
  event_window_minutes integer NOT NULL DEFAULT 60,
  source_freshness_minutes integer NOT NULL DEFAULT 60,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(asset_class, timeframe)
);

CREATE TABLE IF NOT EXISTS market.qualified_trade_candidate_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid REFERENCES market.qualified_trade_candidates(id) ON DELETE SET NULL,
  asset text,
  previous_status text,
  current_status text,
  trigger text,
  notes text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.qualified_trade_candidate_ai_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  best_qualified_candidates text,
  ready_for_scoring text,
  review_required text,
  blocked_or_expired text,
  major_risks text,
  compliance_concerns text,
  recommended_next_action text,
  summary text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.qualified_trade_candidate_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  title text NOT NULL,
  severity text NOT NULL DEFAULT 'Info',
  candidate_id uuid,
  asset text,
  status text NOT NULL DEFAULT 'Open',
  created_by text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.qualified_trade_candidate_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid,
  user_name text NOT NULL DEFAULT 'api',
  action text NOT NULL,
  entity_type text,
  entity_id text,
  reason text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO market.qualified_trade_candidate_expiry_rules (asset_class, timeframe, expiry_minutes) VALUES
  ('Forex','Default',240),
  ('Metals','Default',120),
  ('Indices','Default',180),
  ('Crypto','Default',60),
  ('Default','Default',240)
ON CONFLICT (asset_class, timeframe) DO NOTHING;

INSERT INTO security.permissions (code, resource, action, description) VALUES
  ('universe_scanner.qualified_trades.view','universe_scanner.qualified_trades','view','View qualified trade candidates'),
  ('universe_scanner.qualified_trades.validate','universe_scanner.qualified_trades','validate','Validate qualified trade candidates'),
  ('universe_scanner.qualified_trades.create_package','universe_scanner.qualified_trades','create_package','Create qualified trade packages'),
  ('universe_scanner.qualified_trades.send_to_scoring','universe_scanner.qualified_trades','send_to_scoring','Send qualified trade to scoring'),
  ('universe_scanner.qualified_trades.review','universe_scanner.qualified_trades','review','Mark qualified trade for review'),
  ('universe_scanner.qualified_trades.expire','universe_scanner.qualified_trades','expire','Expire qualified trade candidates'),
  ('universe_scanner.qualified_trades.create_alert','universe_scanner.qualified_trades','create_alert','Create qualified trade alerts'),
  ('universe_scanner.qualified_trades.export','universe_scanner.qualified_trades','export','Export qualified trades')
ON CONFLICT (code) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_qtc_status ON market.qualified_trade_candidates(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qtc_readiness_candidate ON market.qualified_trade_candidate_readiness(candidate_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_qtc_alerts_time ON market.qualified_trade_candidate_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qtc_audit_time ON market.qualified_trade_candidate_audit_logs(created_at DESC);

COMMIT;
