-- Expansion for Account Portfolio Intelligence Center

-- Drawdown Intelligence tracking
CREATE TABLE IF NOT EXISTS market.portfolio_drawdowns (
  id UUID PRIMARY KEY,
  account_id UUID REFERENCES market.trading_accounts(id),
  current_drawdown DECIMAL(10,4) NOT NULL,
  max_drawdown DECIMAL(10,4) NOT NULL,
  recovery_speed_percent DECIMAL(10,4),
  longest_recovery_days INTEGER,
  drawdown_frequency_monthly DECIMAL(10,4),
  measured_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Correlation Intelligence
CREATE TABLE IF NOT EXISTS market.portfolio_correlations (
  id UUID PRIMARY KEY,
  base_target VARCHAR(120) NOT NULL, -- e.g. "EURUSD vs GBPUSD", "Account A vs Account B"
  correlation_coefficient DECIMAL(10,6) NOT NULL,
  correlation_type VARCHAR(20) NOT NULL, -- Positive, Negative, Neutral
  measured_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Portfolio Alerts
CREATE TABLE IF NOT EXISTS market.portfolio_alerts (
  id UUID PRIMARY KEY,
  account_id UUID REFERENCES market.trading_accounts(id),
  severity VARCHAR(20) NOT NULL, -- Info, Warning, Critical, Emergency
  alert_type VARCHAR(60) NOT NULL, -- High Drawdown, Margin Call Risk, etc.
  message TEXT NOT NULL,
  is_resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP
);

-- Portfolio Reports
CREATE TABLE IF NOT EXISTS market.portfolio_reports (
  id UUID PRIMARY KEY,
  report_type VARCHAR(40) NOT NULL, -- Daily, Weekly, Monthly
  format VARCHAR(10) NOT NULL, -- PDF, Excel, CSV, JSON
  file_path TEXT,
  metadata JSONB,
  generated_by VARCHAR(120) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Prop Firm Compliance Monitoring
CREATE TABLE IF NOT EXISTS market.portfolio_prop_compliance (
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES market.trading_accounts(id),
  prop_firm VARCHAR(120) NOT NULL,
  daily_loss_limit DECIMAL(18,2),
  max_loss_limit DECIMAL(18,2),
  remaining_daily_loss DECIMAL(18,2),
  remaining_max_loss DECIMAL(18,2),
  profit_target DECIMAL(18,2),
  current_profit DECIMAL(18,2),
  compliance_score DECIMAL(10,4),
  rules_status JSONB, -- Status of news restrictions, weekend holding, etc.
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- AI Portfolio Insights
CREATE TABLE IF NOT EXISTS market.portfolio_ai_insights (
  id UUID PRIMARY KEY,
  insight_type VARCHAR(40) NOT NULL, -- Health, Risk, Exposure, Recommendation
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add missing columns to trading_accounts if necessary
ALTER TABLE market.trading_accounts ADD COLUMN IF NOT EXISTS server VARCHAR(120);
ALTER TABLE market.trading_accounts ADD COLUMN IF NOT EXISTS health_grade VARCHAR(2); -- A, B, C, D, F

-- Additional indexes
CREATE INDEX IF NOT EXISTS idx_portfolio_drawdowns_account ON market.portfolio_drawdowns(account_id, measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_portfolio_alerts_status ON market.portfolio_alerts(is_resolved, severity);
CREATE INDEX IF NOT EXISTS idx_portfolio_reports_type ON market.portfolio_reports(report_type, created_at DESC);

-- Permissions for the new features
INSERT INTO auth.permissions(code) VALUES
('market_intelligence.account_portfolio.view_correlations'),
('market_intelligence.account_portfolio.view_drawdowns'),
('market_intelligence.account_portfolio.compliance_monitor'),
('market_intelligence.account_portfolio.generate_reports'),
('market_intelligence.account_portfolio.ai_advisor')
ON CONFLICT(code) DO NOTHING;
