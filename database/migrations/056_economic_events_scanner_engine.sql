BEGIN;

CREATE SCHEMA IF NOT EXISTS market;

CREATE TABLE IF NOT EXISTS market.asset_event_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid,
  asset_id uuid,
  asset text NOT NULL,
  asset_class text,
  next_event_id text,
  next_event text,
  currency text,
  country text,
  impact text,
  risk_window text,
  affected_direction text,
  volatility_risk text,
  liquidity_risk text,
  prop_restriction text,
  event_score numeric(7,4),
  confidence numeric(7,4),
  recommendation text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_scanned timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_event_exposures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL,
  asset text NOT NULL,
  event_name text NOT NULL,
  currency text,
  country text,
  impact text,
  scheduled_at timestamptz,
  time_to_event text,
  risk_window text,
  affected_direction text,
  volatility_risk text,
  liquidity_risk text,
  prop_restriction text,
  event_score numeric(7,4),
  confidence numeric(7,4),
  recommendation text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_event_risk_rankings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid,
  rank integer,
  asset_id uuid,
  asset text NOT NULL,
  asset_class text,
  next_event_id text,
  next_event text,
  currency text,
  impact text,
  time_to_event text,
  event_risk_score numeric(7,4),
  volatility_risk text,
  liquidity_risk text,
  prop_restriction text,
  opportunity_score numeric(7,4),
  recommendation text,
  confidence numeric(7,4),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_scanned timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_event_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset text NOT NULL,
  event_id text,
  event_name text,
  currency text,
  event_direction text,
  macro_alignment text,
  sentiment_alignment text,
  trend_alignment text,
  liquidity_condition text,
  opportunity_score numeric(7,4),
  confidence numeric(7,4),
  recommended_action text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_event_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset text NOT NULL,
  event_id text,
  event_name text,
  reason text,
  risk_window text,
  prop_firm_rule text,
  volatility_risk text,
  liquidity_risk text,
  severity text,
  recommended_action text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_event_prop_restrictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm text,
  account text,
  event_id text,
  event_name text,
  currency text,
  restriction_window text,
  rule_type text,
  account_status text,
  compliance_risk text,
  action_required text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_event_volatility_liquidity_risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text,
  event_name text,
  asset text NOT NULL,
  historical_avg_move text,
  expected_volatility text,
  spread_widening_risk text,
  slippage_risk text,
  liquidity_drop_risk text,
  tradeability text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.economic_events_scanner_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component_key text NOT NULL UNIQUE,
  component_name text NOT NULL,
  weight numeric(7,4) NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.economic_events_scanner_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'Queued',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  duration_ms integer,
  events_scanned integer NOT NULL DEFAULT 0,
  assets_scanned integer NOT NULL DEFAULT 0,
  health text,
  triggered_by text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.economic_events_scanner_ai_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  most_important_upcoming_events text,
  assets_most_exposed text,
  events_creating_opportunities text,
  events_requiring_avoidance text,
  prop_firm_restriction_risks text,
  likely_volatility_windows text,
  macro_sentiment_alignment text,
  assets_to_monitor text,
  assets_to_avoid text,
  recommended_next_step text,
  summary text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.economic_events_scanner_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  title text NOT NULL,
  severity text NOT NULL DEFAULT 'Info',
  event_id text,
  asset text,
  status text NOT NULL DEFAULT 'Open',
  created_by text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.economic_events_scanner_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text,
  asset_id uuid,
  user_name text NOT NULL DEFAULT 'api',
  action text NOT NULL,
  entity_type text,
  entity_id text,
  reason text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO market.economic_events_scanner_weights (component_key, component_name, weight) VALUES
  ('impact_level','Impact Level',20),
  ('time_proximity','Time Proximity',15),
  ('historical_volatility_reaction','Historical Volatility Reaction',15),
  ('actual_forecast_deviation','Actual-Forecast Deviation',15),
  ('asset_currency_exposure','Asset Currency Exposure',10),
  ('news_macro_context','News/Macro Context',10),
  ('broker_liquidity_risk','Broker Liquidity Risk',10),
  ('prop_restriction','Prop Restriction',5)
ON CONFLICT (component_key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_asset_event_scores_asset_time ON market.asset_event_scores (asset, last_scanned DESC);
CREATE INDEX IF NOT EXISTS idx_asset_event_exposures_event_asset ON market.asset_event_exposures (event_id, asset);
CREATE INDEX IF NOT EXISTS idx_asset_event_rankings_rank ON market.asset_event_risk_rankings (rank, last_scanned DESC);
CREATE INDEX IF NOT EXISTS idx_event_scanner_alerts_time ON market.economic_events_scanner_alerts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_scanner_audit_time ON market.economic_events_scanner_audit_logs (created_at DESC);

COMMIT;
