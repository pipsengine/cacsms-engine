BEGIN;

ALTER TABLE market.market_data_providers
  ADD COLUMN IF NOT EXISTS connection_method text,
  ADD COLUMN IF NOT EXISTS base_url text,
  ADD COLUMN IF NOT EXISTS websocket_url text,
  ADD COLUMN IF NOT EXISTS auth_type text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS vault_secret_ref text,
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'foundation',
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS supported_asset_classes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS last_sync_at timestamptz;

UPDATE market.market_data_providers
SET base_url = api_url
WHERE base_url IS NULL AND api_url IS NOT NULL;

ALTER TABLE market.market_data_logs
  ADD COLUMN IF NOT EXISTS provider_name text;

ALTER TABLE market.market_data_symbols
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

INSERT INTO market.market_data_symbols (symbol, asset_class)
VALUES
  ('EURUSD', 'forex'), ('GBPUSD', 'forex'), ('USDJPY', 'forex'), ('AUDUSD', 'forex'),
  ('USDCAD', 'forex'), ('USDCHF', 'forex'), ('NZDUSD', 'forex'), ('EURJPY', 'forex'),
  ('GBPJPY', 'forex'), ('AUDJPY', 'forex'), ('CADJPY', 'forex'), ('EURGBP', 'forex'),
  ('EURAUD', 'forex'), ('EURCAD', 'forex'), ('XAUUSD', 'metals'), ('NAS100', 'indices'),
  ('US30', 'indices'), ('SPX500', 'indices'), ('GER40', 'indices'), ('USOIL', 'commodities')
ON CONFLICT (symbol) DO NOTHING;

COMMIT;
