CREATE TABLE IF NOT EXISTS camps (
  id text PRIMARY KEY,
  revision integer NOT NULL,
  state jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS camp_events (
  camp_id text NOT NULL REFERENCES camps(id),
  sequence integer NOT NULL,
  event jsonb NOT NULL,
  PRIMARY KEY (camp_id, sequence)
);
