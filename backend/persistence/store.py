"""Backend source of truth. Explicit SQLite demo adapter; PostGIS deployment adapter.

No automatic remote migrations/seeding. CLI operations require explicit invocation.
"""
import json
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parents[1]


class Store:
    def __init__(self, url=None, path=None):
        self.url = url if url is not None else os.getenv('DATABASE_URL')
        self.path = Path(path or ROOT / 'data' / 'demo.sqlite3')
        self.mode = 'postgresql_postgis' if self.url else 'local_sqlite_demo'

    @contextmanager
    def connect(self):
        if self.url:
            with psycopg.connect(self.url, connect_timeout=5) as conn:
                yield conn
        else:
            conn = sqlite3.connect(self.path, timeout=30)
            try:
                conn.execute('PRAGMA foreign_keys=ON')
                with conn:
                    yield conn
            finally:
                conn.close()

    def sql(self, statement):
        return statement.replace('?', '%s') if self.url else statement

    def initialize(self):
        if self.url:
            # Validate schema availability, never modify a configured DB at startup.
            with self.connect() as conn:
                conn.execute('SELECT id FROM projects LIMIT 1')
            return
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as conn:
            conn.executescript('''
            CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,name TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS data_sources(id TEXT PRIMARY KEY,project_id TEXT REFERENCES projects(id),kind TEXT,metadata TEXT);
            CREATE TABLE IF NOT EXISTS source_features(id TEXT,source_id TEXT REFERENCES data_sources(id),payload TEXT,PRIMARY KEY(source_id,id));
            CREATE TABLE IF NOT EXISTS harmonization_runs(id TEXT PRIMARY KEY,project_id TEXT REFERENCES projects(id),status TEXT,payload TEXT);
            CREATE TABLE IF NOT EXISTS harmonized_records(id TEXT,run_id TEXT REFERENCES harmonization_runs(id),feature TEXT,PRIMARY KEY(run_id,id));
            CREATE TABLE IF NOT EXISTS review_cases(id TEXT PRIMARY KEY,run_id TEXT,record_id TEXT,status TEXT DEFAULT 'pending',decision TEXT,reviewer TEXT,note TEXT,decided_at TEXT,FOREIGN KEY(run_id,record_id) REFERENCES harmonized_records(run_id,id));
            CREATE TABLE IF NOT EXISTS audit_events(id INTEGER PRIMARY KEY,project_id TEXT,run_id TEXT,record_id TEXT,actor TEXT,action TEXT,before_data TEXT,after_data TEXT,created_at TEXT);
            ''')

    @staticmethod
    def decode(value):
        return json.loads(value) if isinstance(value, str) else value

    def sources(self):
        with self.connect() as c:
            return [self.decode(r[0]) for r in c.execute('SELECT metadata FROM data_sources ORDER BY id').fetchall()]

    def features(self, source_id):
        with self.connect() as c:
            return [self.decode(r[0]) for r in c.execute(self.sql('SELECT payload FROM source_features WHERE source_id=? ORDER BY id'), (source_id,)).fetchall()]

    def seed(self, sources):
        # Only used on empty demo storage or by the explicit database CLI.
        with self.connect() as c:
            c.execute("INSERT INTO projects(id,name) VALUES ('pune-demo','Pune synthetic study area') ON CONFLICT(id) DO NOTHING")
            for metadata, features in sources:
                c.execute(self.sql('INSERT INTO data_sources(id,project_id,kind,metadata) VALUES (?, ?, ?, ?)'),
                          (metadata['id'], 'pune-demo', metadata['kind'], json.dumps(metadata)))
                self.insert_features(c, metadata['id'], features)

    def insert_features(self, c, source_id, features):
        for f in features:
            row = (f['id'], source_id, json.dumps(f))
            if self.url:
                c.execute('INSERT INTO source_features(id,source_id,payload,geometry) VALUES (%s,%s,%s,ST_SetSRID(ST_GeomFromGeoJSON(%s),32643))', row+(json.dumps(f['geometry']),))
            else:
                c.execute('INSERT INTO source_features(id,source_id,payload) VALUES (?,?,?)', row)

    def add_source(self, metadata, features):
        with self.connect() as c:
            c.execute(self.sql('INSERT INTO data_sources(id,project_id,kind,metadata) VALUES (?,?,?,?)'),
                      (metadata['id'],'pune-demo',metadata['kind'],json.dumps(metadata)))
            self.insert_features(c,metadata['id'],features)

    def candidates(self, parcel_source, building_source):
        if not self.url:
            return None
        with self.connect() as c:
            rows = c.execute('''SELECT p.id,b.payload FROM source_features p
                JOIN source_features b ON ST_Intersects(p.geometry,b.geometry)
                WHERE p.source_id=%s AND b.source_id=%s ORDER BY p.id,b.id''',
                (parcel_source, building_source)).fetchall()
            out = {}
            for pid, payload in rows:
                out.setdefault(pid, []).append(self.decode(payload))
            return out

    def save_run(self, run, features=None):
        with self.connect() as c:
            c.execute(self.sql('''INSERT INTO harmonization_runs(id,project_id,status,payload) VALUES (?,?,?,?)
                ON CONFLICT(id) DO UPDATE SET status=excluded.status,payload=excluded.payload'''),
                (run['id'],'pune-demo',run['status'],json.dumps(run)))
            if features is not None:
                for f in features:
                    c.execute(self.sql('INSERT INTO harmonized_records(id,run_id,feature) VALUES (?,?,?)'),
                              (f['properties']['parcel_id'],run['id'],json.dumps(f)))

    def runs(self):
        with self.connect() as c:
            runs = [self.decode(r[0]) for r in c.execute('SELECT payload FROM harmonization_runs').fetchall()]
            return sorted(runs,key=lambda r:r['started_at'],reverse=True)

    def results(self, run_id):
        with self.connect() as c:
            return [self.decode(r[0]) for r in c.execute(self.sql('SELECT feature FROM harmonized_records WHERE run_id=? ORDER BY id'),(run_id,)).fetchall()]
