BEGIN;

CREATE SCHEMA IF NOT EXISTS market;

CREATE TABLE IF NOT EXISTS market.institutional_intelligence_inputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  input_key text NOT NULL,
  input_name text NOT NULL,
  source text,
  status text NOT NULL DEFAULT 'UNKNOWN',
  freshness text,
  health numeric(7,4),
  weight numeric(7,4) NOT NULL DEFAULT 1,
  last_updated timestamptz,
  used_in_score boolean NOT NULL DEFAULT true,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.institutional_intelligence_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institutional_bias text,
  smart_money_direction text,
  liquidity_condition text,
  accumulation_signals integer NOT NULL DEFAULT 0,
  distribution_signals integer NOT NULL DEFAULT 0,
  cot_alignment text,
  order_flow_bias text,
  retail_trap_risk text,
  stop_hunt_risk text,
  manipulation_risk text,
  high_confidence_instruments integer NOT NULL DEFAULT 0,
  institutional_confidence numeric(7,4),
  institutional_score numeric(8,4),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  calculated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.instrument_institutional_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument text NOT NULL,
  asset_class text,
  cot_bias text,
  smart_money_bias text,
  liquidity_bias text,
  order_flow_bias text,
  market_structure text,
  accumulation_distribution text,
  retail_trap_risk text,
  stop_hunt_risk text,
  institutional_bias text,
  confidence numeric(7,4),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.liquidity_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument text NOT NULL,
  liquidity_zone text,
  zone_type text,
  price_level numeric(18,8),
  timeframe text,
  strength text,
  distance_from_price numeric(18,8),
  sweep_status text,
  risk_level text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.cot_positioning_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market text NOT NULL,
  commercial_net numeric(18,4),
  large_spec_net numeric(18,4),
  small_spec_net numeric(18,4),
  open_interest numeric(18,4),
  weekly_change numeric(18,4),
  cot_bias text,
  extreme_positioning text,
  last_report_date date,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.accumulation_distribution_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument text NOT NULL,
  state text,
  volume_behaviour text,
  range_compression text,
  breakout_failure text,
  liquidity_sweeps text,
  candle_displacement text,
  cot_direction text,
  market_structure_shift text,
  confidence numeric(7,4),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.smart_money_concept_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument text NOT NULL,
  smc_signal text,
  direction text,
  timeframe text,
  price_zone text,
  strength text,
  confirmation text,
  invalidation_level numeric(18,8),
  status text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.retail_trap_risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument text NOT NULL,
  retail_overcrowding text,
  stop_cluster_risk text,
  fake_breakout_risk text,
  liquidity_sweep_risk text,
  news_trap_risk text,
  session_trap_risk text,
  risk_level text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.institutional_ai_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  summary text NOT NULL,
  best_aligned_instruments text,
  liquidity_targets text,
  smart_money_direction text,
  cot_confirmation text,
  retail_trap_warnings text,
  stop_hunt_risk text,
  trading_caution text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.institutional_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  title text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  status text NOT NULL DEFAULT 'OPEN',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.institutional_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  source text NOT NULL DEFAULT 'institutional_intelligence',
  status text NOT NULL DEFAULT 'RECORDED',
  actor text NOT NULL DEFAULT 'api',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_institutional_inputs_time ON market.institutional_intelligence_inputs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_institutional_scores_time ON market.institutional_intelligence_scores (calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_instrument_institutional_time ON market.instrument_institutional_states (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_liquidity_zones_time ON market.liquidity_zones (observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_cot_positioning_time ON market.cot_positioning_metrics (observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_acc_dist_time ON market.accumulation_distribution_states (observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_smc_time ON market.smart_money_concept_signals (observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_retail_trap_time ON market.retail_trap_risks (observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_institutional_audit_time ON market.institutional_audit_logs (created_at DESC);

COMMIT;
