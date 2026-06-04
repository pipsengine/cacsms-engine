CREATE INDEX IF NOT EXISTS idx_market_data_health_provider_observed_at
  ON market.market_data_health (provider_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_market_data_latency_provider_observed_at
  ON market.market_data_latency (provider_id, observed_at DESC);
