ALTER TABLE camps ADD COLUMN IF NOT EXISTS next_work_at timestamptz;
ALTER TABLE camps ADD COLUMN IF NOT EXISTS last_claim_at timestamptz;
CREATE INDEX IF NOT EXISTS camps_ready ON camps(next_work_at,last_claim_at);
CREATE TABLE IF NOT EXISTS camp_quota (id text PRIMARY KEY, state jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS camp_boards (id text PRIMARY KEY, owner_id text NOT NULL, state jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS camp_delivery (id text PRIMARY KEY, state jsonb NOT NULL);
-- Indexed projection maintained for every camp update, including existing callers.
CREATE OR REPLACE FUNCTION camp_ready_projection() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 NEW.next_work_at := NULL;
 IF NEW.state->>'status' = 'running' THEN
  SELECT min(at) INTO NEW.next_work_at FROM (
   SELECT CASE WHEN j->>'status'='leased' THEN (j->>'leaseUntil')::timestamptz
    ELSE coalesce((j->'input'->>'notBefore')::timestamptz,'epoch'::timestamptz) END AS at
   FROM jsonb_array_elements(NEW.state->'jobs') j WHERE j->>'status' IN ('queued','leased')
   UNION ALL SELECT (NEW.state->'schedule'->>'nextSocialAt')::timestamptz WHERE (NEW.state->'schedule'->>'socialEnabled')::boolean
   UNION ALL SELECT (NEW.state->'schedule'->>'nextRefreshAt')::timestamptz WHERE (NEW.state->'schedule'->>'refreshMinutes')::int > 0
  ) ready;
 END IF;
 PERFORM pg_notify('camp_work',NEW.id);
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS camp_ready ON camps;
CREATE TRIGGER camp_ready BEFORE INSERT OR UPDATE OF state ON camps FOR EACH ROW EXECUTE FUNCTION camp_ready_projection();
UPDATE camps SET state=state WHERE next_work_at IS NULL;
