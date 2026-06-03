BEGIN;
ALTER TABLE market.news_headlines ADD COLUMN IF NOT EXISTS content_hash text;
ALTER TABLE market.news_headlines ADD COLUMN IF NOT EXISTS canonical_url text;
ALTER TABLE market.news_headlines ADD COLUMN IF NOT EXISTS discovered_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS news_headlines_content_hash_uq ON market.news_headlines(content_hash) WHERE content_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS news_headlines_published_at_idx ON market.news_headlines(published_at DESC);
CREATE INDEX IF NOT EXISTS news_headlines_category_idx ON market.news_headlines(category);
CREATE INDEX IF NOT EXISTS news_headlines_impact_idx ON market.news_headlines(impact);
CREATE TABLE IF NOT EXISTS market.news_sync_logs(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES market.news_sources(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL,
  articles_imported integer NOT NULL DEFAULT 0,
  latency_ms integer,
  error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS market.news_alerts(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  headline_id uuid REFERENCES market.news_headlines(id) ON DELETE CASCADE,
  alert_level text NOT NULL,
  reason text NOT NULL,
  affected_assets jsonb NOT NULL DEFAULT '[]'::jsonb,
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS market.news_market_reactions(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  headline_id uuid REFERENCES market.news_headlines(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  horizon_minutes integer NOT NULL,
  price_change numeric(18,8),
  volatility_change numeric(18,8),
  spread_change numeric(18,8),
  volume_change numeric(18,8),
  reaction_type text,
  measured_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(headline_id,symbol,horizon_minutes)
);
CREATE TABLE IF NOT EXISTS market.news_ai_summaries(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  headline_id uuid REFERENCES market.news_headlines(id) ON DELETE CASCADE,
  short_summary text,
  medium_summary text,
  trading_brief text,
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
