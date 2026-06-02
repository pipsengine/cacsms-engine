BEGIN;

CREATE TABLE IF NOT EXISTS infrastructure.broker_server_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_name text NOT NULL,
  broker_search_name text NOT NULL DEFAULT '',
  server_name text NOT NULL,
  platform text NOT NULL DEFAULT 'MT5',
  environment text NOT NULL DEFAULT 'Production',
  server_type text NOT NULL DEFAULT 'Unknown',
  verification_status text NOT NULL CHECK (verification_status IN ('VERIFIED', 'DISCOVERED', 'ADMIN_DEFINED', 'UNVERIFIED')),
  source text NOT NULL CHECK (source IN ('official_reference', 'mt5_discovery', 'admin_created', 'custom_user_entry')),
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  last_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (broker_name, server_name)
);

CREATE INDEX IF NOT EXISTS idx_broker_server_catalog_broker
  ON infrastructure.broker_server_catalog (broker_name, is_active);

INSERT INTO infrastructure.broker_server_catalog (
  broker_name, broker_search_name, server_name, platform, environment, server_type,
  verification_status, source, is_default, is_active, last_verified_at
) VALUES (
  'IC Markets', 'Raw Trading Ltd', 'ICMarketsSC-MT5-6', 'MT5', 'Production', 'Live',
  'VERIFIED', 'official_reference', true, true, now()
) ON CONFLICT (broker_name, server_name) DO UPDATE SET
  broker_search_name = EXCLUDED.broker_search_name,
  verification_status = EXCLUDED.verification_status,
  source = EXCLUDED.source,
  is_default = EXCLUDED.is_default,
  is_active = EXCLUDED.is_active,
  last_verified_at = EXCLUDED.last_verified_at,
  updated_at = now();

COMMIT;
