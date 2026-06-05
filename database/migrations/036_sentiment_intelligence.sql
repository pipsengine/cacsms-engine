BEGIN;

CREATE SCHEMA IF NOT EXISTS market;

CREATE TABLE IF NOT EXISTS market.sentiment_intelligence_inputs (
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

CREATE TABLE IF NOT EXISTS market.sentiment_intelligence_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  overall_market_sentiment text,
  risk_tone text,
  bullish_instruments integer NOT NULL DEFAULT 0,
  bearish_instruments integer NOT NULL DEFAULT 0,
  mixed_signals integer NOT NULL DEFAULT 0,
  extreme_sentiment integer NOT NULL DEFAULT 0,
  overcrowded_trades integer NOT NULL DEFAULT 0,
  sentiment_divergence integer NOT NULL DEFAULT 0,
  news_sentiment text,
  social_sentiment text,
  cot_positioning text,
  sentiment_confidence numeric(7,4),
  overall_sentiment_score numeric(8,4),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  calculated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.instrument_sentiment_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument text NOT NULL,
  asset_class text,
  news_sentiment text,
  social_sentiment text,
  macro_bias text,
  cot_bias text,
  price_confirmation text,
  volatility_risk text,
  overall_sentiment text,
  confidence numeric(7,4),
  trading_bias text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.currency_sentiment_matrix (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  currency text NOT NULL,
  news text,
  social text,
  macro text,
  cot text,
  price text,
  overall text,
  confidence numeric(7,4),
  risk text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.sentiment_divergence_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument text NOT NULL,
  news text,
  social text,
  macro text,
  cot text,
  price text,
  agreement_level text,
  divergence_type text,
  risk_level text,
  recommendation text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.sentiment_extreme_risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_type text NOT NULL,
  instrument text,
  risk_label text NOT NULL DEFAULT 'Low',
  description text,
  recommendation text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.sentiment_timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument text,
  previous_sentiment text,
  current_sentiment text,
  change text,
  trigger text,
  confidence numeric(7,4),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.sentiment_ai_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  summary text NOT NULL,
  strongest_bullish_instruments text,
  strongest_bearish_instruments text,
  agreement_notes text,
  conflict_notes text,
  contrarian_risks text,
  trade_caution text,
  prop_firm_caution text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.sentiment_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  title text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  status text NOT NULL DEFAULT 'OPEN',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.sentiment_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  source text NOT NULL DEFAULT 'sentiment_intelligence',
  status text NOT NULL DEFAULT 'RECORDED',
  actor text NOT NULL DEFAULT 'api',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sentiment_inputs_time ON market.sentiment_intelligence_inputs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sentiment_scores_time ON market.sentiment_intelligence_scores (calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_instrument_sentiment_time ON market.instrument_sentiment_states (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_currency_sentiment_time ON market.currency_sentiment_matrix (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_sentiment_divergence_time ON market.sentiment_divergence_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sentiment_extreme_time ON market.sentiment_extreme_risks (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sentiment_timeline_time ON market.sentiment_timeline_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sentiment_audit_time ON market.sentiment_audit_logs (created_at DESC);

COMMIT;
