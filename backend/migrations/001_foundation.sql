-- Run only against a dedicated MVP database. Geometry analysis uses Pune UTM 43N.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE TABLE IF NOT EXISTS projects (
 id text PRIMARY KEY, name text NOT NULL, synthetic boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS data_sources (
 id text PRIMARY KEY, project_id text NOT NULL REFERENCES projects(id),
 kind text NOT NULL CHECK (kind IN ('cadastral','buildings','gnss')),
 metadata jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS source_features (
 id text NOT NULL, source_id text NOT NULL REFERENCES data_sources(id),
 payload jsonb NOT NULL, geometry geometry(Geometry,32643) NOT NULL,
 PRIMARY KEY(source_id,id), CHECK (ST_IsValid(geometry))
);
CREATE INDEX IF NOT EXISTS source_features_geometry_idx ON source_features USING gist(geometry);
CREATE TABLE IF NOT EXISTS harmonization_runs (
 id text PRIMARY KEY, project_id text NOT NULL REFERENCES projects(id),
 status text NOT NULL CHECK(status IN ('running','completed','failed')),
 payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS harmonized_records (
 id text NOT NULL, run_id text NOT NULL REFERENCES harmonization_runs(id),
 feature jsonb NOT NULL, PRIMARY KEY(run_id,id)
);
-- Phase 4 foundation only. No review mutation or audit UI in Phase 3.
CREATE TABLE IF NOT EXISTS review_cases (
 id text PRIMARY KEY, run_id text NOT NULL, record_id text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','investigating','resolved')),
 decision text CHECK(decision IN ('accepted','rejected','investigate')),
 reviewer text, note text, decided_at timestamptz,
 FOREIGN KEY(run_id,record_id) REFERENCES harmonized_records(run_id,id)
);
CREATE TABLE IF NOT EXISTS audit_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 project_id text NOT NULL REFERENCES projects(id), run_id text REFERENCES harmonization_runs(id),
 record_id text, actor text NOT NULL, action text NOT NULL,
 before_data jsonb, after_data jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
