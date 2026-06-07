BEGIN;

CREATE SCHEMA IF NOT EXISTS market;

CREATE TABLE IF NOT EXISTS market.asset_sentiment_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid,
  asset_id uuid,
  asset text NOT NULL,
  asset_class text,
  news_sentiment text,
  social_sentiment text,
  unified_sentiment text,
  macro_sentiment text,
  crowd_bias text,
  contrarian_risk text,
  sentiment_alignment text,
  sentiment_score numeric(8,4),
  confidence numeric(7,4),
  qualification text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_scanned timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_sentiment_source_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  score_id uuid,
  asset text NOT NULL,
  source_key text NOT NULL,
  source_name text NOT NULL,
  sentiment_label text,
  sentiment_score numeric(8,4),
  confidence numeric(7,4),
  freshness text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_sentiment_rankings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid,
  rank integer,
  asset_id uuid,
  asset text NOT NULL,
  asset_class text,
  news_sentiment text,
  social_sentiment text,
  unified_sentiment text,
  crowd_bias text,
  contrarian_risk text,
  alignment_score numeric(8,4),
  divergence_score numeric(8,4),
  sentiment_score numeric(8,4),
  confidence numeric(7,4),
  qualification text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_scanned timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_news_sentiment_alignment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset text NOT NULL,
  news_sentiment text,
  main_news_driver text,
  impact_level text,
  affected_currency text,
  affected_instrument text,
  news_freshness text,
  alignment_status text,
  confidence numeric(7,4),
  recommended_action text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_social_sentiment_alignment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset text NOT NULL,
  social_sentiment text,
  mention_volume integer,
  bullish_mentions_percent numeric(7,4),
  bearish_mentions_percent numeric(7,4),
  virality_score numeric(7,4),
  influencer_weight numeric(7,4),
  crowd_bias text,
  alignment_status text,
  confidence numeric(7,4),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_sentiment_divergences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset text NOT NULL,
  divergence_type text,
  news text,
  social text,
  price text,
  macro text,
  institutional text,
  severity text,
  trading_interpretation text,
  recommended_action text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_extreme_sentiment_risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset text NOT NULL,
  extreme_sentiment_type text,
  crowd_direction text,
  mention_volume integer,
  contrarian_risk_score numeric(7,4),
  reversal_risk text,
  confidence numeric(7,4),
  recommended_action text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_sentiment_momentum (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset text NOT NULL,
  previous_sentiment text,
  current_sentiment text,
  sentiment_change text,
  momentum_direction text,
  trigger text,
  confidence numeric(7,4),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_updated timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.sentiment_scanner_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component_key text NOT NULL UNIQUE,
  component_name text NOT NULL,
  weight numeric(7,4) NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.sentiment_scanner_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'Queued',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  duration_ms integer,
  assets_scanned integer NOT NULL DEFAULT 0,
  health text,
  triggered_by text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.sentiment_scanner_ai_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strongest_sentiment_bullish_assets text,
  strongest_sentiment_bearish_assets text,
  news_supported_opportunities text,
  social_supported_opportunities text,
  mixed_sentiment_risks text,
  contrarian_warnings text,
  crowd_overcrowding_risks text,
  assets_to_monitor text,
  assets_to_avoid text,
  recommended_next_step text,
  summary text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.sentiment_scanner_alerts (
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

CREATE TABLE IF NOT EXISTS market.sentiment_scanner_audit_logs (
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

INSERT INTO market.sentiment_scanner_weights (component_key, component_name, weight) VALUES
  ('news_sentiment','News Sentiment',30),
  ('social_sentiment','Social Sentiment',20),
  ('unified_sentiment_intelligence','Unified Sentiment Intelligence',20),
  ('crowd_bias_overcrowding','Crowd Bias / Overcrowding',10),
  ('sentiment_momentum','Sentiment Momentum',10),
  ('price_reaction_confirmation','Price Reaction Confirmation',5),
  ('source_health_freshness','Source Health / Freshness',5)
ON CONFLICT (component_key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_asset_sentiment_scores_asset_time ON market.asset_sentiment_scores (asset, last_scanned DESC);
CREATE INDEX IF NOT EXISTS idx_asset_sentiment_rankings_rank ON market.asset_sentiment_rankings (rank, last_scanned DESC);
CREATE INDEX IF NOT EXISTS idx_asset_sentiment_divergences_asset ON market.asset_sentiment_divergences (asset, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_sentiment_scanner_alerts_time ON market.sentiment_scanner_alerts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sentiment_scanner_audit_time ON market.sentiment_scanner_audit_logs (created_at DESC);

COMMIT;
