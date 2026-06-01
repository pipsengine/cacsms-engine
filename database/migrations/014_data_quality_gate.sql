CREATE TABLE IF NOT EXISTS market.data_quality_gate_runs (
  id UUID PRIMARY KEY, gate_status VARCHAR(30) NOT NULL, workflow_permission VARCHAR(30) NOT NULL,
  quality_score DECIMAL(10,4) NOT NULL, trading_mode VARCHAR(30) NOT NULL, proceed_to_stage_one BOOLEAN NOT NULL,
  blocking_issue_count INTEGER NOT NULL DEFAULT 0, warning_count INTEGER NOT NULL DEFAULT 0,
  triggered_by VARCHAR(120) NOT NULL, validated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS market.data_quality_gate_rules (
  id UUID PRIMARY KEY, rule_name VARCHAR(160) NOT NULL, severity VARCHAR(30) NOT NULL,
  source_id VARCHAR(120), description TEXT NOT NULL, enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS market.data_quality_gate_results (
  id UUID PRIMARY KEY, gate_run_id UUID NOT NULL REFERENCES market.data_quality_gate_runs(id),
  rule_id UUID NOT NULL REFERENCES market.data_quality_gate_rules(id), result VARCHAR(30) NOT NULL,
  detail TEXT, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS market.data_quality_gate_source_snapshots (
  id UUID PRIMARY KEY, gate_run_id UUID NOT NULL REFERENCES market.data_quality_gate_runs(id),
  source_id VARCHAR(120) NOT NULL, source_name VARCHAR(160) NOT NULL, status VARCHAR(30) NOT NULL,
  health_score DECIMAL(10,4) NOT NULL, freshness_seconds INTEGER, latency_ms INTEGER, error_count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS market.data_quality_gate_events (
  id UUID PRIMARY KEY, gate_run_id UUID REFERENCES market.data_quality_gate_runs(id), event_type VARCHAR(120) NOT NULL,
  actor VARCHAR(120) NOT NULL, event_payload JSONB, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS market.data_quality_gate_overrides (
  id UUID PRIMARY KEY, gate_run_id UUID REFERENCES market.data_quality_gate_runs(id), approved_by VARCHAR(120) NOT NULL,
  reason TEXT NOT NULL, expires_at TIMESTAMP NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_quality_gate_runs_validated ON market.data_quality_gate_runs(validated_at DESC);
CREATE INDEX IF NOT EXISTS idx_quality_gate_snapshots_run ON market.data_quality_gate_source_snapshots(gate_run_id,source_id);
INSERT INTO auth.permissions(permission_key) VALUES
('market_intelligence.data_quality_gate.view'),('market_intelligence.data_quality_gate.run'),
('market_intelligence.data_quality_gate.refresh_sources'),('market_intelligence.data_quality_gate.export'),
('market_intelligence.data_quality_gate.override'),('market_intelligence.data_quality_gate.view_audit')
ON CONFLICT DO NOTHING;
