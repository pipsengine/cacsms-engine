BEGIN;

CREATE TABLE market.data_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL,
  subtitle text NOT NULL,
  provider text NOT NULL,
  status text NOT NULL CHECK (status IN ('ONLINE','LIVE','SYNCED','SCHEDULED','OPTIONAL','WARNING','FAILED','STALE')),
  required boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,
  freshness_seconds integer NOT NULL DEFAULT 0,
  health_score numeric(7, 4) NOT NULL DEFAULT 100,
  latency_ms integer,
  error_count integer NOT NULL DEFAULT 0,
  feeds_stage text NOT NULL,
  failure_action text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE market.data_source_health (
  observed_at timestamptz NOT NULL DEFAULT now(),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES market.data_sources(id) ON DELETE CASCADE,
  status text NOT NULL,
  freshness_seconds integer NOT NULL,
  health_score numeric(7, 4) NOT NULL,
  latency_ms integer,
  error_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (observed_at, id)
);
SELECT create_hypertable('market.data_source_health', by_range('observed_at'), if_not_exists => TRUE);

CREATE TABLE market.data_source_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES market.data_sources(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info','warning','error','critical')),
  message text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE market.market_data_provider_configs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_id uuid NOT NULL REFERENCES market.data_sources(id) ON DELETE CASCADE, config jsonb NOT NULL DEFAULT '{}'::jsonb);
CREATE TABLE market.news_sentiment_sources (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_id uuid NOT NULL REFERENCES market.data_sources(id) ON DELETE CASCADE, config jsonb NOT NULL DEFAULT '{}'::jsonb);
CREATE TABLE market.economic_calendar_sources (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_id uuid NOT NULL REFERENCES market.data_sources(id) ON DELETE CASCADE, config jsonb NOT NULL DEFAULT '{}'::jsonb);
CREATE TABLE market.institutional_data_sources (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_id uuid NOT NULL REFERENCES market.data_sources(id) ON DELETE CASCADE, config jsonb NOT NULL DEFAULT '{}'::jsonb);
CREATE TABLE market.historical_data_sources (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_id uuid NOT NULL REFERENCES market.data_sources(id) ON DELETE CASCADE, config jsonb NOT NULL DEFAULT '{}'::jsonb);
CREATE TABLE market.broker_data_sources (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_id uuid NOT NULL REFERENCES market.data_sources(id) ON DELETE CASCADE, config jsonb NOT NULL DEFAULT '{}'::jsonb);
CREATE TABLE market.account_portfolio_sources (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_id uuid NOT NULL REFERENCES market.data_sources(id) ON DELETE CASCADE, config jsonb NOT NULL DEFAULT '{}'::jsonb);
CREATE TABLE market.prop_firm_rule_sources (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_id uuid NOT NULL REFERENCES market.data_sources(id) ON DELETE CASCADE, config jsonb NOT NULL DEFAULT '{}'::jsonb);

CREATE TABLE market.data_quality_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid REFERENCES workflow.workflow_runs(id) ON DELETE SET NULL,
  data_quality_score numeric(7, 4) NOT NULL,
  freshness_status text NOT NULL,
  validation_status text NOT NULL,
  proceed_to_stage_1 boolean NOT NULL,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  reject_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
