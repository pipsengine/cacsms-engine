INSERT INTO auth.roles (code, name, protected) VALUES
  ('super_administrator', 'Super Administrator', true),
  ('platform_administrator', 'Platform Administrator', false),
  ('trading_manager', 'Trading Manager', false),
  ('risk_manager', 'Risk Manager', false),
  ('ai_supervisor', 'AI Supervisor', false),
  ('infrastructure_manager', 'Infrastructure Manager', false),
  ('compliance_officer', 'Compliance Officer', false),
  ('auditor', 'Auditor', false),
  ('viewer', 'Viewer', false)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO auth.permissions (code, description) VALUES
  ('view', 'View platform resources'),
  ('create', 'Create platform resources'),
  ('edit', 'Edit platform resources'),
  ('delete', 'Delete platform resources'),
  ('approve', 'Approve governed operations'),
  ('execute', 'Execute approved trading operations'),
  ('override', 'Override permitted controls'),
  ('audit', 'Access audit records'),
  ('govern', 'Manage governance controls'),
  ('administer', 'Administer the platform')
ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO auth.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM auth.roles r CROSS JOIN auth.permissions p
WHERE r.code = 'super_administrator'
ON CONFLICT DO NOTHING;

INSERT INTO risk.risk_rules (code, name, description, rule_type, parameters) VALUES
  ('absolute-veto', 'Risk Engine Absolute Veto', 'A rejected risk assessment cannot proceed to execution.', 'governance', '{"reject_blocks_execution": true}'),
  ('daily-drawdown', 'Maximum Daily Drawdown', 'Blocks execution when daily drawdown limit is reached.', 'capital', '{"max_percent": 4.0}'),
  ('open-exposure', 'Maximum Open Exposure', 'Blocks execution when portfolio exposure limit is reached.', 'portfolio', '{"max_percent": 65.0}')
ON CONFLICT (code) DO UPDATE SET parameters = EXCLUDED.parameters;
