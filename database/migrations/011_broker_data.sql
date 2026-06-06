CREATE TABLE IF NOT EXISTS market.broker_data_sources (
  id UUID PRIMARY KEY,
  broker_name VARCHAR(120) NOT NULL,
  platform VARCHAR(40) NOT NULL,
  account_type VARCHAR(40) NOT NULL,
  server_name VARCHAR(160),
  status VARCHAR(30) NOT NULL,
  credentials_ref VARCHAR(255),
  sync_frequency VARCHAR(40),
  security_status VARCHAR(40),
  last_sync_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS market.broker_market_data (
  id UUID PRIMARY KEY,
  broker_source_id UUID NOT NULL REFERENCES market.broker_data_sources(id),
  instrument VARCHAR(40) NOT NULL,
  timeframe VARCHAR(20) NOT NULL,
  price_timestamp TIMESTAMP NOT NULL,
  bid DECIMAL(18,8), ask DECIMAL(18,8), spread DECIMAL(18,8),
  open_price DECIMAL(18,8), high_price DECIMAL(18,8), low_price DECIMAL(18,8), close_price DECIMAL(18,8),
  volume NUMERIC, tick_count NUMERIC, latency_ms INTEGER,
  source VARCHAR(120) NOT NULL, quality_flag VARCHAR(30) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(broker_source_id,instrument,timeframe,price_timestamp)
);
CREATE TABLE IF NOT EXISTS market.broker_data_validation_logs (
  id UUID PRIMARY KEY, broker_source_id UUID REFERENCES market.broker_data_sources(id),
  validation_rule VARCHAR(80) NOT NULL, severity VARCHAR(20) NOT NULL,
  instrument VARCHAR(40), issue_count INTEGER NOT NULL DEFAULT 0,
  recommended_fix TEXT, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS market.broker_data_sync_logs (
  id UUID PRIMARY KEY, broker_source_id UUID REFERENCES market.broker_data_sources(id),
  status VARCHAR(30) NOT NULL, records_imported INTEGER NOT NULL DEFAULT 0,
  missing_records INTEGER NOT NULL DEFAULT 0, rejected_records INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMP NOT NULL, completed_at TIMESTAMP
);
CREATE TABLE IF NOT EXISTS market.broker_comparison_metrics (
  id UUID PRIMARY KEY, broker_source_id UUID NOT NULL REFERENCES market.broker_data_sources(id),
  instrument VARCHAR(40) NOT NULL, average_spread DECIMAL(18,8), average_slippage DECIMAL(18,8),
  latency_ms INTEGER, completeness_percent DECIMAL(8,4), quality_score DECIMAL(8,4),
  measured_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_broker_market_data_lookup ON market.broker_market_data(instrument,timeframe,price_timestamp DESC);
INSERT INTO auth.permissions(code) VALUES
('market_intelligence.broker_data.view'),('market_intelligence.broker_data.connect'),('market_intelligence.broker_data.sync'),
('market_intelligence.broker_data.upload'),('market_intelligence.broker_data.export'),('market_intelligence.broker_data.configure'),
('market_intelligence.broker_data.disconnect') ON CONFLICT(code) DO NOTHING;
