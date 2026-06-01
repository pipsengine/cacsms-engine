CREATE TABLE IF NOT EXISTS market.prop_firms (
  id UUID PRIMARY KEY, firm_name VARCHAR(120) NOT NULL UNIQUE, country VARCHAR(120), website VARCHAR(255),
  status VARCHAR(30) NOT NULL DEFAULT 'Active', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS market.prop_firm_rules (
  id UUID PRIMARY KEY, prop_firm_id UUID NOT NULL REFERENCES market.prop_firms(id), account_size DECIMAL(18,2) NOT NULL,
  account_type VARCHAR(40) NOT NULL, phase VARCHAR(40) NOT NULL, profit_target_percent DECIMAL(10,4),
  daily_loss_limit_percent DECIMAL(10,4) NOT NULL, max_drawdown_percent DECIMAL(10,4) NOT NULL,
  min_trading_days INTEGER, max_trading_days INTEGER, news_trading_allowed BOOLEAN NOT NULL,
  weekend_holding_allowed BOOLEAN NOT NULL, ea_allowed BOOLEAN NOT NULL, copy_trading_allowed BOOLEAN NOT NULL,
  payout_split_percent DECIMAL(10,4), payout_cycle VARCHAR(80), consistency_rule TEXT, leverage VARCHAR(30),
  status VARCHAR(30) NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS market.prop_firm_account_rules (
  id UUID PRIMARY KEY, prop_firm_rule_id UUID NOT NULL REFERENCES market.prop_firm_rules(id),
  rule_category VARCHAR(80) NOT NULL, rule_name VARCHAR(160) NOT NULL, rule_value TEXT NOT NULL,
  enforcement VARCHAR(40) NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS market.prop_firm_compliance_accounts (
  id UUID PRIMARY KEY, prop_firm_id UUID NOT NULL REFERENCES market.prop_firms(id), account_name VARCHAR(120) NOT NULL,
  phase VARCHAR(40), balance DECIMAL(18,2) NOT NULL, equity DECIMAL(18,2) NOT NULL,
  daily_loss_used_percent DECIMAL(10,4), max_drawdown_used_percent DECIMAL(10,4),
  profit_target_progress_percent DECIMAL(10,4), minimum_days_completed INTEGER,
  breach_risk VARCHAR(30) NOT NULL, status VARCHAR(30) NOT NULL, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS market.prop_firm_breach_alerts (
  id UUID PRIMARY KEY, compliance_account_id UUID REFERENCES market.prop_firm_compliance_accounts(id),
  alert_type VARCHAR(120) NOT NULL, severity VARCHAR(30) NOT NULL, current_state TEXT,
  required_action TEXT, status VARCHAR(30) NOT NULL DEFAULT 'Open', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS market.prop_firm_payout_policies (
  id UUID PRIMARY KEY, prop_firm_id UUID NOT NULL REFERENCES market.prop_firms(id), payout_split_percent DECIMAL(10,4),
  payout_cycle VARCHAR(80), refund_policy TEXT, scaling_plan TEXT, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS market.prop_firm_sync_logs (
  id UUID PRIMARY KEY, prop_firm_id UUID REFERENCES market.prop_firms(id), status VARCHAR(30) NOT NULL,
  rules_imported INTEGER NOT NULL DEFAULT 0, started_at TIMESTAMP NOT NULL, completed_at TIMESTAMP, error_message TEXT
);
CREATE INDEX IF NOT EXISTS idx_prop_rules_firm_phase ON market.prop_firm_rules(prop_firm_id,phase);
CREATE INDEX IF NOT EXISTS idx_prop_compliance_risk ON market.prop_firm_compliance_accounts(breach_risk,status);
INSERT INTO auth.permissions(permission_key) VALUES
('market_intelligence.prop_firm_rules.view'),('market_intelligence.prop_firm_rules.create'),
('market_intelligence.prop_firm_rules.import'),('market_intelligence.prop_firm_rules.sync'),
('market_intelligence.prop_firm_rules.export'),('market_intelligence.prop_firm_rules.monitor_compliance')
ON CONFLICT DO NOTHING;
