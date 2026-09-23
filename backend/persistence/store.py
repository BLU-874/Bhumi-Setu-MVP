"""Backend source of truth. Explicit SQLite demo adapter; PostGIS deployment adapter.

No automatic remote migrations/seeding. CLI operations require explicit invocation.
"""
import json
import os
import sqlite3
from datetime import datetime, timezone
from uuid import uuid5, NAMESPACE_URL
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
            # Configured remote databases are read-only at application startup.
            # Explicit migration and verification commands prepare them.
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
            CREATE TABLE IF NOT EXISTS schema_migrations(version TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
            ''')
            if 'version' not in {row[1] for row in conn.execute('PRAGMA table_info(review_cases)')}:
                conn.execute('ALTER TABLE review_cases ADD COLUMN version INTEGER NOT NULL DEFAULT 0')
            conn.executescript('''
            CREATE UNIQUE INDEX IF NOT EXISTS review_case_record_unique ON review_cases(run_id,record_id);
            CREATE INDEX IF NOT EXISTS audit_run_record_idx ON audit_events(run_id,record_id,id);
            CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit_events
              BEGIN SELECT RAISE(ABORT,'Audit events are append-only'); END;
            CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit_events
              BEGIN SELECT RAISE(ABORT,'Audit events are append-only'); END;
            CREATE TRIGGER IF NOT EXISTS audit_valid_reference BEFORE INSERT ON audit_events
              WHEN NOT EXISTS (SELECT 1 FROM harmonization_runs r JOIN harmonized_records h ON h.run_id=r.id
                WHERE r.id=NEW.run_id AND r.project_id=NEW.project_id AND h.id=NEW.record_id)
              BEGIN SELECT RAISE(ABORT,'Invalid audit reference'); END;
            CREATE TRIGGER IF NOT EXISTS review_valid_insert BEFORE INSERT ON review_cases
              WHEN NEW.status NOT IN ('pending','resolved','investigating') OR NEW.version<0
                OR (NEW.decision IS NOT NULL AND NEW.decision NOT IN ('accepted','rejected','investigate'))
              BEGIN SELECT RAISE(ABORT,'Invalid review state'); END;
            CREATE TRIGGER IF NOT EXISTS review_valid_update BEFORE UPDATE ON review_cases
              WHEN NOT ((NEW.status='resolved' AND NEW.decision IN ('accepted','rejected')) OR
                (NEW.status='investigating' AND NEW.decision='investigate'))
                OR NEW.reviewer IS NULL OR length(trim(NEW.reviewer))=0 OR NEW.decided_at IS NULL OR NEW.version<1
              BEGIN SELECT RAISE(ABORT,'Invalid review state'); END;
            ''')
            conn.execute("INSERT OR IGNORE INTO schema_migrations(version) VALUES ('001_foundation.sql')")
            conn.execute("INSERT OR IGNORE INTO schema_migrations(version) VALUES ('002_review_audit.sql')")
        self.backfill_reviews()

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
                    c.execute(self.sql('INSERT INTO harmonized_records(id,run_id,feature) VALUES (?,?,?) ON CONFLICT(run_id,id) DO NOTHING'),
                              (f['properties']['parcel_id'],run['id'],json.dumps(f)))
                self.ensure_reviews(c,run['id'])

    def runs(self):
        with self.connect() as c:
            runs = [self.decode(r[0]) for r in c.execute('SELECT payload FROM harmonization_runs').fetchall()]
            return sorted(runs,key=lambda r:r['started_at'],reverse=True)

    def results(self, run_id):
        with self.connect() as c:
            return [self.decode(r[0]) for r in c.execute(self.sql('SELECT feature FROM harmonized_records WHERE run_id=? ORDER BY id'),(run_id,)).fetchall()]

    def ensure_reviews(self, c, run_id):
        rows=c.execute(self.sql('SELECT id,feature FROM harmonized_records WHERE run_id=?'),(run_id,)).fetchall()
        for record_id,raw in rows:
            p=self.decode(raw)['properties']
            if p.get('review_required'):
                case_id=str(uuid5(NAMESPACE_URL,f'bhumi-setu:{run_id}:{record_id}'))
                c.execute(self.sql("INSERT INTO review_cases(id,run_id,record_id,status,version) VALUES (?,?,?,'pending',0) ON CONFLICT(run_id,record_id) DO NOTHING"),
                          (case_id,run_id,record_id))

    def backfill_reviews(self):
        with self.connect() as c:
            for (run_id,) in c.execute("SELECT id FROM harmonization_runs WHERE status='completed'").fetchall():
                self.ensure_reviews(c,run_id)

    def review_cases(self, run_id):
        with self.connect() as c:
            rows=c.execute(self.sql('''SELECT q.id,q.run_id,q.record_id,q.status,q.decision,q.reviewer,q.note,q.decided_at,q.version,h.feature
                FROM review_cases q JOIN harmonized_records h ON h.run_id=q.run_id AND h.id=q.record_id
                WHERE q.run_id=? ORDER BY q.record_id'''),(run_id,)).fetchall()
            return [self.case_dict(r) for r in rows]

    def case_dict(self,row):
        keys=('id','run_id','record_id','status','decision','reviewer','note','decided_at','version','feature')
        result=dict(zip(keys,row))
        result['feature']=self.decode(result['feature'])
        if result['decided_at'] is not None:
            result['decided_at']=str(result['decided_at'])
        return result

    def review_case(self, case_id):
        with self.connect() as c:
            row=c.execute(self.sql('''SELECT q.id,q.run_id,q.record_id,q.status,q.decision,q.reviewer,q.note,q.decided_at,q.version,h.feature
                FROM review_cases q JOIN harmonized_records h ON h.run_id=q.run_id AND h.id=q.record_id WHERE q.id=?'''),(case_id,)).fetchone()
            return self.case_dict(row) if row else None

    def decide(self, case_id, decision, reviewer, note, expected_version):
        choices={'accept':'accepted','reject':'rejected','investigate':'investigate'}
        if decision not in choices or not reviewer.strip():
            raise ValueError('Invalid decision or reviewer')
        with self.connect() as c:
            if not self.url:
                c.execute('BEGIN IMMEDIATE')
            suffix=' FOR UPDATE OF q' if self.url else ''
            row=c.execute(self.sql('''SELECT q.id,q.run_id,q.record_id,q.status,q.decision,q.reviewer,q.note,q.decided_at,q.version,h.feature
                FROM review_cases q JOIN harmonized_records h ON h.run_id=q.run_id AND h.id=q.record_id WHERE q.id=?''')+suffix,(case_id,)).fetchone()
            if not row:
                raise LookupError('Review case not found')
            before=self.case_dict(row)
            if before['version']!=expected_version:
                raise ReviewConflict('This case changed. Reload its current decision before submitting again.')
            if decision=='accept' and not before['feature']['properties'].get('matched_footprint_id'):
                raise ValueError('No candidate exists to accept. Reject or investigate this case.')
            timestamp=datetime.now(timezone.utc).isoformat()
            state='investigating' if decision=='investigate' else 'resolved'
            after={k:v for k,v in before.items() if k!='feature'}
            after.update(status=state,decision=choices[decision],reviewer=reviewer.strip(),note=note,
                         decided_at=timestamp,version=expected_version+1)
            c.execute(self.sql('''UPDATE review_cases SET status=?,decision=?,reviewer=?,note=?,decided_at=?,version=? WHERE id=?'''),
                      (state,choices[decision],reviewer.strip(),note,timestamp,expected_version+1,case_id))
            project=c.execute(self.sql('SELECT project_id FROM harmonization_runs WHERE id=?'),(before['run_id'],)).fetchone()[0]
            c.execute(self.sql('''INSERT INTO audit_events(project_id,run_id,record_id,actor,action,before_data,after_data,created_at)
                VALUES (?,?,?,?,?,?,?,?)'''),(project,before['run_id'],before['record_id'],reviewer.strip(),f'review.{decision}',
                    json.dumps({k:v for k,v in before.items() if k!='feature'}),json.dumps(after),timestamp))
            return {**after,'feature':before['feature']}

    def log_audit_event(self, run_id, record_id, actor, action, metadata=None):
        with self.connect() as c:
            row = c.execute(self.sql('''SELECT r.project_id FROM harmonization_runs r
                JOIN harmonized_records h ON h.run_id=r.id WHERE r.id=? AND h.id=?'''), (run_id, record_id)).fetchone()
            if not row:
                raise LookupError('Invalid run or record reference')
            project_id = row[0]
            timestamp = datetime.now(timezone.utc).isoformat()
            c.execute(self.sql('''INSERT INTO audit_events(project_id,run_id,record_id,actor,action,before_data,after_data,created_at)
                VALUES (?,?,?,?,?,?,?,?)'''),
                (project_id, run_id, record_id, actor.strip() or 'Officer', action,
                 json.dumps({'type': action}), json.dumps(metadata or {}), timestamp))
            return {'status': 'recorded', 'action': action, 'actor': actor.strip() or 'Officer', 'timestamp': timestamp}

    def audit(self, run_id=None, record_id=None, limit=100, offset=0):
        clauses,params=[],[]
        for field,value in [('run_id',run_id),('record_id',record_id)]:
            if value:
                clauses.append(field+'=?'); params.append(value)
        where=' WHERE '+' AND '.join(clauses) if clauses else ''
        where_a=' WHERE '+' AND '.join(['a.'+c for c in clauses]) if clauses else ''
        with self.connect() as c:
            total=c.execute(self.sql('SELECT count(*) FROM audit_events'+where),tuple(params)).fetchone()[0]
            rows=c.execute(self.sql('''SELECT a.id,a.project_id,a.run_id,a.record_id,a.actor,a.action,a.before_data,a.after_data,a.created_at,
                h.feature, r.payload
                FROM audit_events a
                LEFT JOIN harmonized_records h ON h.run_id=a.run_id AND h.id=a.record_id
                LEFT JOIN harmonization_runs r ON r.id=a.run_id
                '''+where_a+' ORDER BY a.id DESC LIMIT ? OFFSET ?'),tuple(params+[limit,offset])).fetchall()
            events=[]
            for row in rows:
                event=dict(zip(('id','project_id','run_id','record_id','actor','action','before','after','timestamp'),row[:9]))
                event['before']=self.decode(event['before']);event['after']=self.decode(event['after'])
                event['timestamp']=str(event['timestamp'])
                if row[9] is not None:
                    event['record']=self.decode(row[9])
                if row[10] is not None:
                    event['run']=self.decode(row[10])
                events.append(event)
            return {'events':events,'total':total,'limit':limit,'offset':offset}

    def sync_study_area(self, study_area):
        """Ensure all synthetic geometries and results match the configured study area origin."""
        target_lon = study_area['origin_lon']
        target_lat = study_area['origin_lat']
        from pyproj import Transformer
        from shapely.geometry import shape, mapping
        from shapely.affinity import translate
        from domain.normalization import METRIC_CRS, DISPLAY_CRS, reproject

        t_to_metric = Transformer.from_crs(4326, 32643, always_xy=True)
        target_x, target_y = t_to_metric.transform(target_lon, target_lat)

        with self.connect() as c:
            cad_meta_row = c.execute(self.sql("SELECT metadata FROM data_sources WHERE id='cadastral'")).fetchone()
            if not cad_meta_row:
                return 0, 0
            cad_meta = self.decode(cad_meta_row[0])
            cur_origin = cad_meta.get('study_area_origin')
            if cur_origin:
                cur_x, cur_y = t_to_metric.transform(cur_origin[0], cur_origin[1])
            else:
                cur_x, cur_y = t_to_metric.transform(73.8567, 18.5204)

            dx = target_x - cur_x
            dy = target_y - cur_y
            if abs(dx) < 0.01 and abs(dy) < 0.01:
                return 0, 0

            # 1. Translate synthetic source_features (stored in METRIC_CRS)
            sf_rows = c.execute(self.sql("SELECT source_id, id, payload FROM source_features WHERE source_id IN ('cadastral','buildings','gnss')")).fetchall()
            updated_sf = []
            for sid, fid, raw_payload in sf_rows:
                p = self.decode(raw_payload)
                g = shape(p['geometry'])
                new_g = translate(g, dx, dy)
                p['geometry'] = mapping(new_g)
                if 'original_geometry' in p:
                    if sid == 'cadastral':
                        orig_g = shape(reproject(p['original_geometry'], DISPLAY_CRS, METRIC_CRS))
                        p['original_geometry'] = reproject(mapping(translate(orig_g, dx, dy)), METRIC_CRS, DISPLAY_CRS)
                    else:
                        orig_g = shape(p['original_geometry'])
                        p['original_geometry'] = mapping(translate(orig_g, dx, dy))
                if 'normalized_original_geometry' in p:
                    norm_g = shape(p['normalized_original_geometry'])
                    p['normalized_original_geometry'] = mapping(translate(norm_g, dx, dy))
                updated_sf.append((json.dumps(p), sid, fid))

            c.executemany(self.sql("UPDATE source_features SET payload=? WHERE source_id=? AND id=?"), updated_sf)

            # 2. Update data_sources metadata with new study_area_origin and name
            for sid in ('cadastral', 'buildings', 'gnss'):
                row = c.execute(self.sql("SELECT metadata FROM data_sources WHERE id=?"), (sid,)).fetchone()
                if row:
                    meta = self.decode(row[0])
                    meta['study_area_origin'] = [target_lon, target_lat]
                    meta['study_area_name'] = study_area['name']
                    c.execute(self.sql("UPDATE data_sources SET metadata=? WHERE id=?"), (json.dumps(meta), sid))

            # 3. Translate harmonized_records (stored in DISPLAY_CRS EPSG:4326)
            hr_rows = c.execute(self.sql("SELECT run_id, id, feature FROM harmonized_records")).fetchall()
            updated_hr = []
            for run_id, fid, raw_feature in hr_rows:
                f = self.decode(raw_feature)
                metric_g = shape(reproject(f['geometry'], DISPLAY_CRS, METRIC_CRS))
                new_metric_g = translate(metric_g, dx, dy)
                f['geometry'] = reproject(mapping(new_metric_g), METRIC_CRS, DISPLAY_CRS)
                updated_hr.append((json.dumps(f), run_id, fid))

            c.executemany(self.sql("UPDATE harmonized_records SET feature=? WHERE run_id=? AND id=?"), updated_hr)

            # 4. Update projects table
            c.execute(self.sql("UPDATE projects SET name=? WHERE id='pune-demo'"), (study_area['name'],))

            return dx, dy


class ReviewConflict(Exception):
    pass
