"""Read-only checks. Never return connection strings or raw database exceptions."""
from persistence.timing import timed

REQUIRED = {
    'projects': {'id','name'},
    'data_sources': {'id','project_id','kind','metadata'},
    'source_features': {'id','source_id','payload','geometry'},
    'harmonization_runs': {'id','project_id','status','payload'},
    'harmonized_records': {'id','run_id','feature'},
    'review_cases': {'id','run_id','record_id','status','decision','reviewer','note','decided_at','version'},
    'audit_events': {'id','project_id','run_id','record_id','actor','action','before_data','after_data','created_at'},
    'schema_migrations': {'version'},
}


def verify(store):
    status = {'persistence_mode':store.mode,'database_reachable':False,
              'postgis_available':False,'schema_ready':False,
              'geometry_ready':False,'spatial_query_ok':False,'ready':False,
              'message':'Database unavailable'}
    try:
        with store.connect() as c:
            with timed('verify.database_reachable'):
                c.execute('SELECT 1')
            status['database_reachable'] = True
            if not store.url:
                with timed('verify.sqlite_schema'):
                    tables={r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'")}
                    required={**REQUIRED,'source_features':{'id','source_id','payload'}}
                    status['schema_ready']=all(name in tables and columns <= {r[1] for r in c.execute(f'PRAGMA table_info({name})')} for name,columns in required.items())
                status['ready']=status['schema_ready']
                status['message']='Local SQLite demo persistence; no PostGIS functionality'
                return status
            with timed('verify.postgis_extension'):
                status['postgis_available']=bool(c.execute("SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname='postgis')").fetchone()[0])
            columns={}
            with timed('verify.schema_columns'):
                for table,col in c.execute('SELECT table_name,column_name FROM information_schema.columns WHERE table_schema=current_schema()'):
                    columns.setdefault(table,set()).add(col)
            status['schema_ready']=all(cols <= columns.get(table,set()) for table,cols in REQUIRED.items())
            if status['schema_ready']:
                with timed('verify.schema_migration'):
                    status['schema_ready']=bool(c.execute("SELECT 1 FROM schema_migrations WHERE version='002_review_audit.sql'").fetchone())
            if status['postgis_available']:
                with timed('verify.geometry_column'):
                    column=c.execute("SELECT type,srid,coord_dimension FROM geometry_columns WHERE f_table_schema=current_schema() AND f_table_name='source_features' AND f_geometry_column='geometry'").fetchone()
                status['geometry_ready']=bool(column and column[0]=='GEOMETRY' and column[1]==32643 and column[2]==2)
                if status['geometry_ready']:
                    with timed('verify.geometry_validity'):
                        bad=c.execute('SELECT count(*) FROM source_features WHERE ST_SRID(geometry)<>32643 OR NOT ST_IsValid(geometry) OR ST_IsEmpty(geometry)').fetchone()[0]
                    status['geometry_ready']=bad==0
                with timed('verify.spatial_query'):
                    status['spatial_query_ok']=bool(c.execute('SELECT ST_Intersects(ST_SetSRID(ST_MakePoint(1,1),32643),ST_MakeEnvelope(0,0,2,2,32643))').fetchone()[0])
            status['ready']=all(status[k] for k in ('database_reachable','postgis_available','schema_ready','geometry_ready','spatial_query_ok'))
            status['message']='PostgreSQL/PostGIS verified' if status['ready'] else 'Database reachable; PostGIS, geometry or schema verification incomplete'
    except Exception:
        status['message']='Database verification failed; connection or schema is unavailable'
    return status
