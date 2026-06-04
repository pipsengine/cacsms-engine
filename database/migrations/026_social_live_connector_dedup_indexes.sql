CREATE UNIQUE INDEX IF NOT EXISTS idx_social_posts_source_external_id
  ON market.social_posts (source_id, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_social_posts_source_created_at
  ON market.social_posts (source_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_social_provider_health_source_observed_at
  ON market.social_provider_health (source_id, observed_at DESC);
