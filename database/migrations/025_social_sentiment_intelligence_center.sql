CREATE TABLE IF NOT EXISTS market.social_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key text UNIQUE NOT NULL,
  name text NOT NULL,
  connection_type text NOT NULL,
  status text NOT NULL DEFAULT 'READY',
  trust_score numeric(7,4) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.social_source_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES market.social_sources(id),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  sync_frequency text NOT NULL DEFAULT '5 minutes',
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES market.social_sources(id),
  external_id text,
  content text NOT NULL,
  author text,
  published_at timestamptz,
  instrument text,
  currency text,
  engagement integer NOT NULL DEFAULT 0,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.social_sentiment_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES market.social_posts(id),
  instrument text,
  sentiment text NOT NULL,
  sentiment_score numeric(7,4) NOT NULL,
  ai_confidence numeric(7,4) NOT NULL DEFAULT 0,
  crowd_bias text,
  contrarian_risk text,
  virality_score numeric(7,4) NOT NULL DEFAULT 0,
  influence_score numeric(7,4) NOT NULL DEFAULT 0,
  engagement_score numeric(7,4) NOT NULL DEFAULT 0,
  topic_momentum numeric(7,4) NOT NULL DEFAULT 0,
  observed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE market.social_sentiment_scores ADD COLUMN IF NOT EXISTS post_id uuid REFERENCES market.social_posts(id);
ALTER TABLE market.social_sentiment_scores ADD COLUMN IF NOT EXISTS instrument text;
ALTER TABLE market.social_sentiment_scores ADD COLUMN IF NOT EXISTS sentiment text;
ALTER TABLE market.social_sentiment_scores ADD COLUMN IF NOT EXISTS sentiment_score numeric(7,4);
ALTER TABLE market.social_sentiment_scores ADD COLUMN IF NOT EXISTS ai_confidence numeric(7,4) NOT NULL DEFAULT 0;
ALTER TABLE market.social_sentiment_scores ADD COLUMN IF NOT EXISTS crowd_bias text;
ALTER TABLE market.social_sentiment_scores ADD COLUMN IF NOT EXISTS contrarian_risk text;
ALTER TABLE market.social_sentiment_scores ADD COLUMN IF NOT EXISTS virality_score numeric(7,4) NOT NULL DEFAULT 0;
ALTER TABLE market.social_sentiment_scores ADD COLUMN IF NOT EXISTS influence_score numeric(7,4) NOT NULL DEFAULT 0;
ALTER TABLE market.social_sentiment_scores ADD COLUMN IF NOT EXISTS engagement_score numeric(7,4) NOT NULL DEFAULT 0;
ALTER TABLE market.social_sentiment_scores ADD COLUMN IF NOT EXISTS topic_momentum numeric(7,4) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS market.social_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic text UNIQUE NOT NULL,
  related_instrument text,
  sentiment text,
  virality_score numeric(7,4) NOT NULL DEFAULT 0,
  first_detected_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'WATCH'
);

CREATE TABLE IF NOT EXISTS market.social_topic_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid REFERENCES market.social_topics(id),
  post_id uuid REFERENCES market.social_posts(id),
  mention_volume integer NOT NULL DEFAULT 1,
  source_count integer NOT NULL DEFAULT 1,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.social_instrument_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument text NOT NULL,
  mentions integer NOT NULL DEFAULT 0,
  bullish_pct numeric(7,4),
  bearish_pct numeric(7,4),
  neutral_pct numeric(7,4),
  sentiment_score numeric(7,4),
  virality numeric(7,4),
  contrarian_risk text,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.social_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  instrument text,
  message text NOT NULL,
  risk_level text NOT NULL DEFAULT 'Medium',
  delivery_channels text[] NOT NULL DEFAULT ARRAY['In-App'],
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.social_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES market.social_sources(id),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  posts_fetched integer NOT NULL DEFAULT 0,
  posts_stored integer NOT NULL DEFAULT 0,
  duplicates_skipped integer NOT NULL DEFAULT 0,
  alerts_triggered integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'STARTED',
  error text
);

CREATE TABLE IF NOT EXISTS market.social_provider_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES market.social_sources(id),
  status text NOT NULL,
  trust_score numeric(7,4),
  rate_limit_status text,
  latency_ms integer,
  error_count integer NOT NULL DEFAULT 0,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.social_ai_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  summary text NOT NULL,
  dominant_narrative text,
  risk_mood text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.social_correlation_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument text NOT NULL,
  news_sentiment text,
  economic_calendar text,
  cot_report text,
  interest_rates text,
  historical_data text,
  broker_data text,
  account_portfolio text,
  technical_signals text,
  interpretation text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_posts_instrument_published_at ON market.social_posts (instrument, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_scores_instrument_observed_at ON market.social_sentiment_scores (instrument, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_topics_status ON market.social_topics (status);
