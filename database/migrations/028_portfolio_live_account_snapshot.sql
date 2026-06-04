-- Live portfolio account snapshots from MT5 terminals / sync engine

ALTER TABLE infrastructure.mt5_terminals
  ADD COLUMN IF NOT EXISTS account_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE market.trading_accounts
  ADD COLUMN IF NOT EXISTS terminal_id uuid REFERENCES infrastructure.mt5_terminals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS provider_id uuid REFERENCES market.market_data_providers(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_trading_accounts_terminal
  ON market.trading_accounts(terminal_id)
  WHERE terminal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trading_accounts_last_sync
  ON market.trading_accounts(last_sync_at DESC NULLS LAST);
