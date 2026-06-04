ALTER TABLE market.prop_firms
  ADD COLUMN IF NOT EXISTS region VARCHAR(120),
  ADD COLUMN IF NOT EXISTS supported_platforms TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE market.prop_firm_rules
  ADD COLUMN IF NOT EXISTS program_name VARCHAR(160),
  ADD COLUMN IF NOT EXISTS currency VARCHAR(12) DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS challenge_fee DECIMAL(18,2),
  ADD COLUMN IF NOT EXISTS drawdown_type VARCHAR(40),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_prop_firm_program
  ON market.prop_firm_rules(prop_firm_id, program_name)
  WHERE program_name IS NOT NULL AND program_name <> '';

CREATE TABLE IF NOT EXISTS market.prop_firm_accounts (
  id UUID PRIMARY KEY,
  prop_firm_id UUID NOT NULL REFERENCES market.prop_firms(id) ON DELETE CASCADE,
  prop_firm_rule_id UUID REFERENCES market.prop_firm_rules(id) ON DELETE SET NULL,
  trading_account_id UUID REFERENCES market.trading_accounts(id) ON DELETE SET NULL,
  account_name VARCHAR(120) NOT NULL,
  program_name VARCHAR(160),
  phase VARCHAR(40),
  status VARCHAR(30) NOT NULL DEFAULT 'Active',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS market.prop_firm_rule_categories (
  id UUID PRIMARY KEY,
  category_key VARCHAR(80) NOT NULL UNIQUE,
  category_name VARCHAR(160) NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS market.prop_firm_compliance_status (
  id UUID PRIMARY KEY,
  prop_firm_account_id UUID NOT NULL REFERENCES market.prop_firm_accounts(id) ON DELETE CASCADE,
  daily_loss_used_percent DECIMAL(10,4),
  max_drawdown_used_percent DECIMAL(10,4),
  profit_target_progress_percent DECIMAL(10,4),
  minimum_days_completed INTEGER,
  breach_risk VARCHAR(30) NOT NULL DEFAULT 'Unknown',
  status VARCHAR(30) NOT NULL DEFAULT 'Unknown',
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  measured_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS market.prop_firm_scaling_plans (
  id UUID PRIMARY KEY,
  prop_firm_id UUID NOT NULL REFERENCES market.prop_firms(id) ON DELETE CASCADE,
  plan_name VARCHAR(160) NOT NULL,
  scaling_eligibility TEXT,
  max_allocation TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS market.prop_firm_source_configs (
  id UUID PRIMARY KEY,
  source_name VARCHAR(160) NOT NULL,
  source_type VARCHAR(60) NOT NULL,
  endpoint_url TEXT,
  authentication_type VARCHAR(60),
  sync_frequency VARCHAR(60),
  last_sync TIMESTAMP,
  health_status VARCHAR(30) NOT NULL DEFAULT 'Unknown',
  approval_required BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS market.prop_firm_rule_imports (
  id UUID PRIMARY KEY,
  prop_firm_id UUID REFERENCES market.prop_firms(id) ON DELETE SET NULL,
  source_type VARCHAR(40) NOT NULL,
  source_label TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'Pending Review',
  extracted_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(120),
  reviewed_by VARCHAR(120),
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS market.prop_firm_audit_logs (
  id UUID PRIMARY KEY,
  user_id VARCHAR(120),
  user_label VARCHAR(160),
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id UUID,
  before_value JSONB,
  after_value JSONB,
  ip_address VARCHAR(64),
  reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prop_firm_accounts_firm ON market.prop_firm_accounts(prop_firm_id);
CREATE INDEX IF NOT EXISTS idx_prop_firm_audit_created ON market.prop_firm_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prop_firm_imports_status ON market.prop_firm_rule_imports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prop_firm_sources_health ON market.prop_firm_source_configs(health_status);

INSERT INTO auth.permissions(permission_key) VALUES
('market_intelligence.prop_firm_rules.update'),
('market_intelligence.prop_firm_rules.delete'),
('market_intelligence.prop_firm_rules.approve'),
('market_intelligence.prop_firm_rules.export')
ON CONFLICT DO NOTHING;
