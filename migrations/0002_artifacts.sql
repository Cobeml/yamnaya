CREATE TABLE IF NOT EXISTS camp_artifacts (
  camp_id text NOT NULL,
  build_id text NOT NULL,
  digest text NOT NULL,
  files jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (camp_id, build_id)
);
