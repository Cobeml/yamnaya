CREATE TABLE IF NOT EXISTS camp_model_context (
  camp_id text NOT NULL REFERENCES camps(id),
  agent_id text NOT NULL,
  call_id text NOT NULL,
  reasoning jsonb NOT NULL,
  PRIMARY KEY(camp_id,agent_id,call_id)
);
