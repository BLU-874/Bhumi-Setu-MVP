"""Preserve prototype scoring; normalize and repair before candidate filtering."""
from collections import Counter
from datetime import datetime, timezone
from time import perf_counter
from uuid import uuid4

from shapely.geometry import shape
from shapely.strtree import STRtree
from rapidfuzz import fuzz

from domain.matching import harmonize, normalize_attributes
from domain.normalization import reproject, METRIC_CRS, DISPLAY_CRS
from ml.predict import Ranker
from persistence.timing import event, record, duration, timed, persistence_metrics


def now():
    return datetime.now(timezone.utc).isoformat()


def attribute_evidence(a, b):
    a, b = normalize_attributes(a), normalize_attributes(b or {})
    result = {}
    for field in ('survey_no','owner','area'):
        x,y = a.get(field),b.get(field)
        available = bool(x and y)
        score = None
        if available:
            if field == 'survey_no':
                clean = lambda s: ''.join(c for c in str(s) if c.isalnum()).lower()
                score = fuzz.ratio(clean(x),clean(y))
            elif field == 'owner':
                score = 0 if str(y).strip().lower() in ('unknown','n/a','') else fuzz.ratio(str(x).lower(),str(y).lower())
            else:
                try:
                    xnum,ynum = float(x),float(y)
                    score = (1-min(abs(xnum-ynum)/max(xnum,ynum),1))*100
                except (TypeError,ValueError,ZeroDivisionError):
                    available = False
        result[field] = {'source':x,'candidate':y,'available':available,
                         'similarity_pct':round(score,1) if score is not None else None}
    return result


def execute(store, selection=None):
    started = perf_counter()
    metrics = {'persistence_operation_count': 0, 'persistence_db_seconds': 0.0,
               'audit_operation_count': 0}
    token = persistence_metrics.set(metrics)
    outcome = 'failed'
    event('execute.start')
    try:
        result = _execute(store, selection, metrics)
        outcome = result['status']
        return result
    finally:
        operations = metrics['persistence_operation_count']
        metrics['average_db_call_ms'] = round(metrics['persistence_db_seconds'] * 1000 / operations, 3) if operations else 0
        record('execute.total', started, outcome=outcome, **metrics)
        persistence_metrics.reset(token)


def _execute(store, selection, metrics):
    selection = selection or {'cadastral':'cadastral','buildings':'buildings','gnss':'gnss'}
    event('execute.source_loading.start')
    with timed('execute.source_loading'):
        sources = {s['id']:s for s in store.sources()}
    for kind, sid in selection.items():
        if sid not in sources or sources[sid]['kind'] != kind:
            raise ValueError(f'Select an available {kind} source')
    run = {'id':str(uuid4()),'status':'running','started_at':now(),
           'source_ids':selection,'engine_version':'rules-v1-metric',
           'storage_mode':store.mode,'stages':[],
           'policy':{'geometry_weight':.65,'attribute_weight':.35,'gnss_boost':8,'matched_threshold':75,'review_threshold':40}}
    start = perf_counter()
    store.save_run(run)
    try:
        layers = {}
        for kind, sid in selection.items():
            loaded_at = perf_counter()
            event(f'execute.load.{kind}.start')
            try:
                layers[kind] = store.features(sid)
                metrics[{'cadastral':'cadastral_count', 'buildings':'building_count', 'gnss':'gnss_count'}[kind]] = len(layers[kind])
            finally:
                record(f'execute.load.{kind}', loaded_at, feature_count=len(layers.get(kind, [])))
        run['stages'].append({'name':'Data ingestion','status':'completed','count':sum(map(len,layers.values()))})
        # Normalization and validation really run during source import and are reused.
        for stage in ('CRS normalization','Schema normalization','Geometry validation'):
            run['stages'].append({'name':stage,'status':'completed','detail':'Verified artifacts from source preparation'})
        event('execute.candidate_generation.start')
        with timed('execute.candidate_generation'):
            candidates = store.candidates(selection['cadastral'], selection['buildings'])
            if candidates is None:
                buildings = layers['buildings']
                with timed('execute.candidates.strtree_build'):
                    tree = STRtree([shape(f['geometry']) for f in buildings])
                with timed('execute.candidates.strtree_query_loop'):
                    candidates = {f['id']:[buildings[int(i)] for i in sorted(tree.query(shape(f['geometry']),predicate='intersects'))]
                                  for f in layers['cadastral']}
            metrics['candidate_count'] = sum(len(value) for value in candidates.values())
        event('execute.candidates.count', candidate_count=metrics['candidate_count'])
        # Pass original normalized geometries to preserve engine repair flags.
        def original(f):
            return {'type':'Feature','geometry':f['normalized_original_geometry'],'properties':f['properties']}
        prepared_candidates = candidates
        event('execute.ml_initialize.start')
        with timed('execute.ml_initialize'):
            ranker = Ranker()
        candidates = {key:[original(f) for f in val] for key,val in candidates.items()}
        event('execute.deterministic_matching.start')
        with timed('execute.deterministic_matching'):
            result = harmonize({'features':[original(f) for f in layers['cadastral']]},
                               gnss_fc={'features':[original(f) for f in layers['gnss']]},building_candidates=candidates)
        event('execute.result_construction.start')
        construction_seconds = 0.0
        ml_seconds = 0.0
        ml_calls = 0
        ml_candidate_count = 0
        event('execute.ml_ranking.start')
        by_id = {f['id']:f for f in layers['cadastral']}
        for f in result['features']:
            constructed_at = perf_counter()
            f['geometry'] = reproject(f['geometry'],METRIC_CRS,DISPLAY_CRS)
            p = f['properties']
            p['attribute_evidence'] = attribute_evidence(p['cadastral'],p['footprint_properties'])
            p['geometry_quality'] = by_id[p['parcel_id']]['quality']
            p['review_required'] = p['status'] != 'matched' or bool(p['validation_flags'])
            p['decision_status'] = 'pending_review' if p['review_required'] else 'proposed_match'
            p['deterministic_confidence'] = p['confidence']
            construction_seconds += perf_counter() - constructed_at
            ranked_at = perf_counter()
            try:
                ranking = ranker.rank(by_id[p['parcel_id']], prepared_candidates.get(p['parcel_id'],[]), layers['gnss'])
            finally:
                ml_seconds += perf_counter() - ranked_at
                ml_calls += 1
            updated_at = perf_counter()
            p.update(ranking)
            ml_candidate_count += len(ranking['ml_candidates'])
            construction_seconds += perf_counter() - updated_at
            if ml_calls % 100 == 0:
                duration('execute.ml_ranking.progress', ml_seconds, ml_call_count=ml_calls,
                         ml_candidate_count=ml_candidate_count)
        duration('execute.ml_ranking', ml_seconds, ml_call_count=ml_calls, ml_candidate_count=ml_candidate_count)
        metrics.update(ml_call_count=ml_calls, ml_candidate_count=ml_candidate_count)
        constructed_at = perf_counter()
        flags = Counter(flag for f in result['features'] for flag in f['properties']['validation_flags'])
        result['summary']['review_required'] = sum(f['properties']['review_required'] for f in result['features'])
        run['stages'] += [{'name':name,'status':'completed'} for name in
                         ('Spatial candidate matching','Attribute matching','Confidence scoring','Conflict detection')]
        run['stages'] += [{'name':'Human review','status':'deferred','detail':'Phase 4'},
                         {'name':'Harmonized record','status':'proposed','detail':'Scored proposals saved; no human decision yet'}]
        run.update(status='completed',completed_at=now(),summary=result['summary'],
                   quality_flags=dict(flags),duration_seconds=round(perf_counter()-start,3))
        construction_seconds += perf_counter() - constructed_at
        duration('execute.result_construction', construction_seconds, result_count=len(result['features']))
        metrics.update(matched_count=result['summary']['matched'], review_count=result['summary']['needs_review'],
                       conflict_count=result['summary']['conflict'])
        event('execute.persistence.start')
        with timed('execute.persistence'):
            store.save_run(run,result['features'])
        return run
    except Exception:
        run.update(status='failed',completed_at=now(),error='Processing failed. Check backend logs.')
        store.save_run(run)
        raise
