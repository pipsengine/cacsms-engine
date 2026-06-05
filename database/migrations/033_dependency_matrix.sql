BEGIN;

CREATE SCHEMA IF NOT EXISTS market;

CREATE TABLE IF NOT EXISTS market.module_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key text NOT NULL UNIQUE,
  module_name text NOT NULL,
  status text NOT NULL DEFAULT 'UNKNOWN',
  owner text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.service_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_key text NOT NULL UNIQUE,
  service_name text NOT NULL,
  depends_on text,
  consumed_by text,
  health_status text NOT NULL DEFAULT 'UNKNOWN',
  last_run_at timestamptz,
  queue_status text,
  failure_count integer NOT NULL DEFAULT 0,
  risk_level text NOT NULL DEFAULT 'UNKNOWN',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.api_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key text NOT NULL UNIQUE,
  provider text,
  endpoint text,
  status text NOT NULL DEFAULT 'UNKNOWN',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.database_table_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL UNIQUE,
  used_by_services text,
  used_by_pages text,
  record_count bigint,
  last_updated timestamptz,
  data_freshness text,
  validation_status text NOT NULL DEFAULT 'UNKNOWN',
  risk_level text NOT NULL DEFAULT 'UNKNOWN',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.dependency_graph_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_key text NOT NULL UNIQUE,
  node_type text NOT NULL,
  label text NOT NULL,
  status text NOT NULL DEFAULT 'UNKNOWN',
  risk_level text NOT NULL DEFAULT 'UNKNOWN',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.dependency_graph_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_node_key text NOT NULL,
  to_node_key text NOT NULL,
  dependency_level text NOT NULL DEFAULT 'Medium',
  failure_impact text NOT NULL DEFAULT 'Moderate',
  status text NOT NULL DEFAULT 'UNKNOWN',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_node_key, to_node_key)
);

CREATE TABLE IF NOT EXISTS market.dependency_health_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dependency_key text NOT NULL,
  score numeric(7,4),
  status text NOT NULL DEFAULT 'UNKNOWN',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  calculated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.dependency_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dependency_key text,
  source_key text,
  recommendation text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  status text NOT NULL DEFAULT 'OPEN',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.dependency_simulation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_type text NOT NULL,
  target_key text,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor text NOT NULL DEFAULT 'api',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.dependency_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  source text NOT NULL DEFAULT 'dependency_matrix',
  status text NOT NULL DEFAULT 'RECORDED',
  actor text NOT NULL DEFAULT 'api',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dependency_edges_from ON market.dependency_graph_edges (from_node_key);
CREATE INDEX IF NOT EXISTS idx_dependency_edges_to ON market.dependency_graph_edges (to_node_key);
CREATE INDEX IF NOT EXISTS idx_dependency_scores_key_time ON market.dependency_health_scores (dependency_key, calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_dependency_recommendations_key ON market.dependency_recommendations (dependency_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dependency_audit_time ON market.dependency_audit_logs (created_at DESC);

COMMIT;
