CREATE TABLE IF NOT EXISTS market.trading_accounts (
  id UUID PRIMARY KEY, broker_name VARCHAR(120) NOT NULL, account_name VARCHAR(120) NOT NULL,
  account_number_masked VARCHAR(40) NOT NULL, account_type VARCHAR(40) NOT NULL, currency VARCHAR(10) NOT NULL,
  balance DECIMAL(18,2) NOT NULL, equity DECIMAL(18,2) NOT NULL, floating_pl DECIMAL(18,2) NOT NULL,
  realized_pl DECIMAL(18,2) NOT NULL, margin_used DECIMAL(18,2) NOT NULL, free_margin DECIMAL(18,2) NOT NULL,
  margin_level DECIMAL(12,4) NOT NULL, daily_drawdown_percent DECIMAL(10,4) NOT NULL,
  monthly_return_percent DECIMAL(10,4) NOT NULL, risk_score DECIMAL(10,4) NOT NULL, status VARCHAR(30) NOT NULL,
  last_sync_at TIMESTAMP, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS market.portfolio_positions (
  id UUID PRIMARY KEY, account_id UUID NOT NULL REFERENCES market.trading_accounts(id), instrument VARCHAR(40) NOT NULL,
  direction VARCHAR(10) NOT NULL, lot_size DECIMAL(18,4) NOT NULL, entry_price DECIMAL(18,8) NOT NULL,
  current_price DECIMAL(18,8), stop_loss DECIMAL(18,8), take_profit DECIMAL(18,8), floating_pl DECIMAL(18,2) NOT NULL,
  risk_percent DECIMAL(10,4), margin_used DECIMAL(18,2), open_time TIMESTAMP NOT NULL, status VARCHAR(20) NOT NULL,
  strategy VARCHAR(120), note TEXT, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS market.portfolio_closed_trades (
  id UUID PRIMARY KEY, account_id UUID NOT NULL REFERENCES market.trading_accounts(id), instrument VARCHAR(40) NOT NULL,
  direction VARCHAR(10) NOT NULL, lot_size DECIMAL(18,4) NOT NULL, entry_price DECIMAL(18,8) NOT NULL,
  exit_price DECIMAL(18,8) NOT NULL, profit_loss DECIMAL(18,2) NOT NULL, r_multiple DECIMAL(12,4),
  commission DECIMAL(18,2), swap DECIMAL(18,2), duration_seconds INTEGER, strategy VARCHAR(120),
  close_reason VARCHAR(120), closed_at TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS market.portfolio_equity_snapshots (
  id UUID PRIMARY KEY, account_id UUID REFERENCES market.trading_accounts(id), snapshot_at TIMESTAMP NOT NULL,
  balance DECIMAL(18,2) NOT NULL, equity DECIMAL(18,2) NOT NULL, drawdown_percent DECIMAL(10,4),
  deposit_withdrawal DECIMAL(18,2), marker_type VARCHAR(40)
);
CREATE TABLE IF NOT EXISTS market.portfolio_risk_metrics (
  id UUID PRIMARY KEY, account_id UUID REFERENCES market.trading_accounts(id), metric_name VARCHAR(120) NOT NULL,
  current_value VARCHAR(120) NOT NULL, limit_value VARCHAR(120), status VARCHAR(30) NOT NULL, measured_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS market.portfolio_sync_logs (
  id UUID PRIMARY KEY, account_id UUID REFERENCES market.trading_accounts(id), status VARCHAR(30) NOT NULL,
  records_imported INTEGER NOT NULL DEFAULT 0, started_at TIMESTAMP NOT NULL, completed_at TIMESTAMP, error_message TEXT
);
CREATE TABLE IF NOT EXISTS market.portfolio_strategy_allocation (
  id UUID PRIMARY KEY, account_id UUID REFERENCES market.trading_accounts(id), strategy VARCHAR(120) NOT NULL,
  exposure_percent DECIMAL(10,4), contribution DECIMAL(18,2), measured_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_portfolio_positions_account_status ON market.portfolio_positions(account_id,status);
CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_time ON market.portfolio_equity_snapshots(snapshot_at DESC);
INSERT INTO auth.permissions(permission_key) VALUES
('market_intelligence.account_portfolio.view'),('market_intelligence.account_portfolio.connect'),
('market_intelligence.account_portfolio.sync'),('market_intelligence.account_portfolio.export'),
('market_intelligence.account_portfolio.view_risk'),('market_intelligence.account_portfolio.manage_notes')
ON CONFLICT DO NOTHING;
