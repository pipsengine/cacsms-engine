BEGIN;

CREATE SCHEMA IF NOT EXISTS infrastructure;

CREATE TABLE IF NOT EXISTS infrastructure.ea_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE,
  release_notes text,
  manifest jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS infrastructure.mt5_terminal_paths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terminal_id uuid NOT NULL UNIQUE REFERENCES infrastructure.mt5_terminals(id) ON DELETE CASCADE,
  machine_id uuid REFERENCES infrastructure.machines(id) ON DELETE SET NULL,
  data_path text NOT NULL,
  experts_path text,
  include_path text,
  scripts_path text,
  templates_path text,
  presets_path text,
  terminal_install_id text,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS infrastructure.ea_deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid REFERENCES infrastructure.machines(id) ON DELETE SET NULL,
  terminal_id uuid NOT NULL REFERENCES infrastructure.mt5_terminals(id) ON DELETE CASCADE,
  version_id uuid REFERENCES infrastructure.ea_versions(id) ON DELETE SET NULL,
  previous_version_id uuid REFERENCES infrastructure.ea_versions(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'DEPLOYING', 'DEPLOYED', 'VERIFIED', 'FAILED', 'ROLLBACK_REQUIRED')),
  ea_version text,
  navigator_verified boolean NOT NULL DEFAULT false,
  checksum_verified boolean NOT NULL DEFAULT false,
  rollback_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ea_deployments_terminal ON infrastructure.ea_deployments (terminal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ea_deployments_status ON infrastructure.ea_deployments (status, created_at DESC);

CREATE TABLE IF NOT EXISTS infrastructure.ea_deployment_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id uuid NOT NULL REFERENCES infrastructure.ea_deployments(id) ON DELETE CASCADE,
  relative_path text NOT NULL,
  target_path text NOT NULL,
  source_checksum text,
  target_checksum text,
  status text NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS infrastructure.ea_deployment_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id uuid REFERENCES infrastructure.ea_deployments(id) ON DELETE CASCADE,
  level text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ea_deployment_logs_deployment ON infrastructure.ea_deployment_logs (deployment_id, created_at DESC);

COMMIT;
