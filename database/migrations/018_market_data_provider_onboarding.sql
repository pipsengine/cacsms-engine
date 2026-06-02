BEGIN;

ALTER TABLE market.market_data_providers
  ADD COLUMN IF NOT EXISTS provider_code text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS vendor_website text,
  ADD COLUMN IF NOT EXISTS contact_info text,
  ADD COLUMN IF NOT EXISTS port integer,
  ADD COLUMN IF NOT EXISTS capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS asset_coverage jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS supported_symbols jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS health_score numeric(7, 4),
  ADD COLUMN IF NOT EXISTS last_tested_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by text;

CREATE UNIQUE INDEX IF NOT EXISTS market_data_providers_provider_code_uq
  ON market.market_data_providers (provider_code)
  WHERE provider_code IS NOT NULL AND archived = false;

CREATE UNIQUE INDEX IF NOT EXISTS market_data_providers_name_uq
  ON market.market_data_providers (lower(name))
  WHERE archived = false;

ALTER TABLE market.market_data_logs
  ADD COLUMN IF NOT EXISTS action text,
  ADD COLUMN IF NOT EXISTS actor text,
  ADD COLUMN IF NOT EXISTS result text;

COMMIT;
