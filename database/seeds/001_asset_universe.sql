INSERT INTO market.assets (
  symbol, display_name, asset_class, tier, enabled, priority,
  default_timeframes, risk_category, spread_category, session_preference
) VALUES
  ('XAUUSD', 'Gold / US Dollar', 'commodity', 'tier_1', true, 1, ARRAY['M15','H1','H4'], 'elevated', 'standard', 'london_new_york'),
  ('EURUSD', 'Euro / US Dollar', 'forex', 'tier_1', true, 2, ARRAY['M15','H1','H4'], 'standard', 'tight', 'london_new_york'),
  ('GBPUSD', 'British Pound / US Dollar', 'forex', 'tier_1', true, 3, ARRAY['M15','H1','H4'], 'standard', 'tight', 'london_new_york'),
  ('USDJPY', 'US Dollar / Japanese Yen', 'forex', 'tier_1', true, 4, ARRAY['M15','H1','H4'], 'standard', 'tight', 'tokyo_london'),
  ('AUDUSD', 'Australian Dollar / US Dollar', 'forex', 'tier_1', true, 5, ARRAY['M15','H1','H4'], 'standard', 'tight', 'sydney_tokyo'),
  ('USDCAD', 'US Dollar / Canadian Dollar', 'forex', 'tier_1', true, 6, ARRAY['M15','H1','H4'], 'standard', 'standard', 'new_york'),
  ('USDCHF', 'US Dollar / Swiss Franc', 'forex', 'tier_1', true, 7, ARRAY['M15','H1','H4'], 'standard', 'standard', 'london_new_york'),
  ('NZDUSD', 'New Zealand Dollar / US Dollar', 'forex', 'tier_1', true, 8, ARRAY['M15','H1','H4'], 'standard', 'standard', 'sydney_tokyo'),
  ('NAS100', 'Nasdaq 100', 'index', 'tier_1', true, 9, ARRAY['M15','H1','H4'], 'elevated', 'standard', 'new_york'),
  ('US30', 'Dow Jones Industrial Average', 'index', 'tier_1', true, 10, ARRAY['M15','H1','H4'], 'elevated', 'standard', 'new_york'),
  ('EURJPY', 'Euro / Japanese Yen', 'forex', 'tier_2', true, 11, ARRAY['M15','H1','H4'], 'standard', 'standard', 'tokyo_london'),
  ('GBPJPY', 'British Pound / Japanese Yen', 'forex', 'tier_2', true, 12, ARRAY['M15','H1','H4'], 'elevated', 'wide', 'tokyo_london'),
  ('AUDJPY', 'Australian Dollar / Japanese Yen', 'forex', 'tier_2', true, 13, ARRAY['M15','H1','H4'], 'standard', 'standard', 'sydney_tokyo'),
  ('CADJPY', 'Canadian Dollar / Japanese Yen', 'forex', 'tier_2', true, 14, ARRAY['M15','H1','H4'], 'standard', 'standard', 'tokyo'),
  ('EURGBP', 'Euro / British Pound', 'forex', 'tier_2', true, 15, ARRAY['M15','H1','H4'], 'standard', 'tight', 'london'),
  ('EURAUD', 'Euro / Australian Dollar', 'forex', 'tier_2', true, 16, ARRAY['M15','H1','H4'], 'standard', 'wide', 'london'),
  ('EURCAD', 'Euro / Canadian Dollar', 'forex', 'tier_2', true, 17, ARRAY['M15','H1','H4'], 'standard', 'wide', 'london_new_york'),
  ('SPX500', 'S&P 500', 'index', 'tier_2', true, 18, ARRAY['M15','H1','H4'], 'elevated', 'standard', 'new_york'),
  ('GER40', 'German DAX 40', 'index', 'tier_2', true, 19, ARRAY['M15','H1','H4'], 'elevated', 'standard', 'london'),
  ('USOIL', 'WTI Crude Oil', 'commodity', 'tier_2', true, 20, ARRAY['M15','H1','H4'], 'elevated', 'wide', 'new_york')
ON CONFLICT (symbol) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  asset_class = EXCLUDED.asset_class,
  tier = EXCLUDED.tier,
  enabled = EXCLUDED.enabled,
  priority = EXCLUDED.priority,
  default_timeframes = EXCLUDED.default_timeframes,
  risk_category = EXCLUDED.risk_category,
  spread_category = EXCLUDED.spread_category,
  session_preference = EXCLUDED.session_preference;

INSERT INTO market.asset_universe (asset_id, phase, tier, enabled, priority)
SELECT id, CASE WHEN tier = 'tier_1' THEN 1 ELSE 2 END, tier, enabled, priority
FROM market.assets
ON CONFLICT (asset_id) DO UPDATE SET
  phase = EXCLUDED.phase,
  tier = EXCLUDED.tier,
  enabled = EXCLUDED.enabled,
  priority = EXCLUDED.priority;
