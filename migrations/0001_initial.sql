CREATE TABLE IF NOT EXISTS runs (id text PRIMARY KEY, revision integer NOT NULL, state jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS control (key text PRIMARY KEY, run_id text NOT NULL);
CREATE TABLE IF NOT EXISTS audit_events (run_id text NOT NULL REFERENCES runs(id), id text NOT NULL, sequence integer NOT NULL, event jsonb NOT NULL, PRIMARY KEY(run_id, id));
CREATE TABLE IF NOT EXISTS ontology_objects (run_id text NOT NULL REFERENCES runs(id), id text NOT NULL, type text NOT NULL, value jsonb NOT NULL, PRIMARY KEY(run_id, id));
CREATE TABLE IF NOT EXISTS ontology_relationships (run_id text NOT NULL REFERENCES runs(id), id text NOT NULL, value jsonb NOT NULL, PRIMARY KEY(run_id, id));
CREATE TABLE IF NOT EXISTS approvals (run_id text NOT NULL REFERENCES runs(id), id text NOT NULL, role text NOT NULL, actor text NOT NULL, value jsonb NOT NULL, PRIMARY KEY(run_id, id));
CREATE INDEX IF NOT EXISTS audit_sequence ON audit_events(run_id, sequence);
CREATE INDEX IF NOT EXISTS object_types ON ontology_objects(run_id, type);
