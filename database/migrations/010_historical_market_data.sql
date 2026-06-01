BEGIN;
CREATE TABLE market.historical_market_data(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),instrument varchar(30) NOT NULL,asset_class varchar(50) NOT NULL,timeframe varchar(20) NOT NULL,price_date date NOT NULL,price_time time,open_price numeric(18,8) NOT NULL,high_price numeric(18,8) NOT NULL,low_price numeric(18,8) NOT NULL,close_price numeric(18,8) NOT NULL,volume numeric,change_value numeric(18,8) NOT NULL,change_percent numeric(10,4) NOT NULL,price_range numeric(18,8) NOT NULL,volatility numeric(10,4),trend_bias varchar(50) NOT NULL,source varchar(100) NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(instrument,timeframe,price_date,price_time,source));
CREATE INDEX historical_market_data_query_idx ON market.historical_market_data(asset_class,instrument,timeframe,price_date DESC);
CREATE TABLE market.historical_data_sources(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),source_name text UNIQUE NOT NULL,provider text NOT NULL,status text NOT NULL,config jsonb NOT NULL DEFAULT '{}'::jsonb,last_sync_at timestamptz,next_sync_at timestamptz,records_imported bigint NOT NULL DEFAULT 0,failed_records bigint NOT NULL DEFAULT 0,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE market.historical_data_sync_logs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),source_id uuid REFERENCES market.historical_data_sources(id),status text NOT NULL,records_found bigint NOT NULL DEFAULT 0,records_imported bigint NOT NULL DEFAULT 0,failed_records bigint NOT NULL DEFAULT 0,triggered_by text NOT NULL,started_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz,payload jsonb NOT NULL DEFAULT '{}'::jsonb);
INSERT INTO auth.permissions(code,description) VALUES
('market_intelligence.historical_data.view','View historical market data'),
('market_intelligence.historical_data.export','Export historical market data'),
('market_intelligence.historical_data.sync','Synchronize historical market data'),
('market_intelligence.historical_data.upload','Upload historical market data'),
('market_intelligence.historical_data.configure_source','Configure historical data sources'),
('market_intelligence.historical_data.delete','Delete historical market data')
ON CONFLICT(code) DO NOTHING;
COMMIT;
