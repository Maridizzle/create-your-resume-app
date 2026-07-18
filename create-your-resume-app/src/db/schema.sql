-- Create Your Resume, intake pipeline schema
-- Single admin user, client records, and a running log of the pipeline
-- independent of the Google Sheet.

CREATE TABLE IF NOT EXISTS admin_user (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  totp_secret TEXT,
  totp_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  target_role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'input',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tracks which pipeline stage a client is currently on.
-- stage: input | chat | checklist | link | results | output | complete
CREATE TABLE IF NOT EXISTS pipeline_state (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  stage TEXT NOT NULL DEFAULT 'input',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Versioned intake JSON per client. New row on every regeneration so
-- nothing is ever overwritten silently.
CREATE TABLE IF NOT EXISTS intake_json (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  json_data JSONB NOT NULL,
  intake_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Full transcript of the chat refinement step.
CREATE TABLE IF NOT EXISTS chat_logs (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- 'user' or 'assistant'
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cached pull of the client's completed Google Sheet row(s), timestamped
-- so the Results screen can show "last pulled" without hitting the API
-- on every page load.
CREATE TABLE IF NOT EXISTS results_cache (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  sheet_data JSONB NOT NULL,
  pulled_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_state_client ON pipeline_state(client_id);
CREATE INDEX IF NOT EXISTS idx_intake_json_client ON intake_json(client_id);
CREATE INDEX IF NOT EXISTS idx_chat_logs_client ON chat_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_results_cache_client ON results_cache(client_id);
