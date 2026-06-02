BEGIN;

INSERT INTO infrastructure.broker_server_catalog (
  broker_name, broker_search_name, server_name, platform, environment, server_type,
  verification_status, source, is_default, is_active, last_verified_at
) VALUES
  ('IC Markets', 'Raw Trading Ltd', 'ICMarketsSC-Demo', 'MT5', 'Demo', 'Demo', 'VERIFIED', 'official_reference', false, true, now()),
  ('IC Markets', 'Raw Trading Ltd', 'ICMarketsSC-MT5', 'MT5', 'Production', 'Live', 'VERIFIED', 'official_reference', false, true, now()),
  ('IC Markets', 'Raw Trading Ltd', 'ICMarketsSC-MT5-2', 'MT5', 'Production', 'Live', 'VERIFIED', 'official_reference', false, true, now()),
  ('IC Markets', 'Raw Trading Ltd', 'ICMarketsSC-MT5-3', 'MT5', 'Production', 'Live', 'VERIFIED', 'official_reference', false, true, now()),
  ('IC Markets', 'Raw Trading Ltd', 'ICMarketsSC-MT5-4', 'MT5', 'Production', 'Live', 'VERIFIED', 'official_reference', false, true, now()),
  ('IC Markets', 'Raw Trading Ltd', 'ICMarketsSC-MT5-6', 'MT5', 'Production', 'Live', 'VERIFIED', 'official_reference', true, true, now())
ON CONFLICT (broker_name, server_name) DO UPDATE SET
  broker_search_name = EXCLUDED.broker_search_name,
  verification_status = EXCLUDED.verification_status,
  source = EXCLUDED.source,
  is_default = EXCLUDED.is_default,
  is_active = EXCLUDED.is_active,
  last_verified_at = EXCLUDED.last_verified_at,
  updated_at = now();

COMMIT;
