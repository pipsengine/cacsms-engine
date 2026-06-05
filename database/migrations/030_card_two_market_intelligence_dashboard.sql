BEGIN;

CREATE TABLE IF NOT EXISTS workflow.card_inputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES workflow.workflow_runs(id) ON DELETE CASCADE,
  card_number smallint NOT NULL,
  source_card_number smallint,
  package_id text,
  status text NOT NULL DEFAULT 'WAITING_FOR_INPUT',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workflow.card_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES workflow.workflow_runs(id) ON DELETE CASCADE,
  card_number smallint NOT NULL,
  package_id text,
  status text NOT NULL DEFAULT 'PENDING',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz,
  validated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workflow.card_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES workflow.workflow_runs(id) ON DELETE CASCADE,
  from_card_number smallint NOT NULL,
  to_card_number smallint NOT NULL,
  package_id text,
  status text NOT NULL DEFAULT 'PENDING',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  handed_off_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.intelligence_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES workflow.workflow_runs(id) ON DELETE CASCADE,
  score_key text NOT NULL,
  score_label text NOT NULL,
  score_value numeric(7, 4),
  status text NOT NULL DEFAULT 'PENDING',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  calculated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.intelligence_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES workflow.workflow_runs(id) ON DELETE CASCADE,
  package_id text NOT NULL UNIQUE,
  version text NOT NULL DEFAULT '1.0.0',
  status text NOT NULL DEFAULT 'PENDING',
  confidence numeric(7, 4),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz,
  validated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.intelligence_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES workflow.workflow_runs(id) ON DELETE CASCADE,
  event text NOT NULL,
  source text NOT NULL DEFAULT 'card_2',
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('debug', 'info', 'warning', 'error', 'critical')),
  status text NOT NULL DEFAULT 'RECORDED',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_card_inputs_card_run ON workflow.card_inputs (card_number, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_card_outputs_card_run ON workflow.card_outputs (card_number, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_card_handoffs_from_to ON workflow.card_handoffs (from_card_number, to_card_number, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intelligence_scores_run_key ON market.intelligence_scores (run_id, score_key, calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_intelligence_packages_run_status ON market.intelligence_packages (run_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intelligence_logs_run_time ON market.intelligence_logs (run_id, created_at DESC);

COMMIT;
