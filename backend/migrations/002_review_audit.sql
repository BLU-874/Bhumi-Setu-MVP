CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE review_cases ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 0;
ALTER TABLE review_cases ADD CONSTRAINT review_version_nonnegative CHECK (version >= 0);
CREATE UNIQUE INDEX review_case_record_unique ON review_cases(run_id, record_id);
ALTER TABLE harmonization_runs ADD CONSTRAINT run_project_unique UNIQUE(id,project_id);
ALTER TABLE audit_events ADD CONSTRAINT audit_run_project_fk
 FOREIGN KEY(run_id,project_id) REFERENCES harmonization_runs(id,project_id);
ALTER TABLE audit_events ADD CONSTRAINT audit_record_fk
 FOREIGN KEY(run_id,record_id) REFERENCES harmonized_records(run_id,id);
ALTER TABLE review_cases ADD CONSTRAINT review_state_consistent CHECK (
 (status='pending' AND decision IS NULL AND reviewer IS NULL AND decided_at IS NULL) OR
 (status='resolved' AND decision IN ('accepted','rejected') AND length(trim(reviewer))>0 AND decided_at IS NOT NULL) OR
 (status='investigating' AND decision='investigate' AND length(trim(reviewer))>0 AND decided_at IS NOT NULL)
);
CREATE INDEX audit_run_record_idx ON audit_events(run_id,record_id,id);
CREATE FUNCTION prevent_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Audit events are append-only'; END;
$$;
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON audit_events
 FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();
INSERT INTO schema_migrations(version) VALUES ('001_foundation.sql') ON CONFLICT DO NOTHING;
INSERT INTO schema_migrations(version) VALUES ('002_review_audit.sql') ON CONFLICT DO NOTHING;
