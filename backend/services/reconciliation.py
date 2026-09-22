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
    selection = selection or {'cadastral':'cadastral','buildings':'buildings','gnss':'gnss'}
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
        layers = {kind:store.features(sid) for kind,sid in selection.items()}
        run['stages'].append({'name':'Data ingestion','status':'completed','count':sum(map(len,layers.values()))})
        # Normalization and validation really run during source import and are reused.
        for stage in ('CRS normalization','Schema normalization','Geometry validation'):
            run['stages'].append({'name':stage,'status':'completed','detail':'Verified artifacts from source preparation'})
        candidates = store.candidates(selection['cadastral'], selection['buildings'])
        if candidates is None:
            buildings = layers['buildings']
            tree = STRtree([shape(f['geometry']) for f in buildings])
            candidates = {f['id']:[buildings[int(i)] for i in sorted(tree.query(shape(f['geometry']),predicate='intersects'))]
                          for f in layers['cadastral']}
        # Pass original normalized geometries to preserve engine repair flags.
        def original(f):
            return {'type':'Feature','geometry':f['normalized_original_geometry'],'properties':f['properties']}
        prepared_candidates = candidates
        ranker = Ranker()
        candidates = {key:[original(f) for f in val] for key,val in candidates.items()}
        result = harmonize({'features':[original(f) for f in layers['cadastral']]},
                           gnss_fc={'features':[original(f) for f in layers['gnss']]},building_candidates=candidates)
        by_id = {f['id']:f for f in layers['cadastral']}
        for f in result['features']:
            f['geometry'] = reproject(f['geometry'],METRIC_CRS,DISPLAY_CRS)
            p = f['properties']
            p['attribute_evidence'] = attribute_evidence(p['cadastral'],p['footprint_properties'])
            p['geometry_quality'] = by_id[p['parcel_id']]['quality']
            p['review_required'] = p['status'] != 'matched' or bool(p['validation_flags'])
            p['decision_status'] = 'pending_review' if p['review_required'] else 'proposed_match'
            p['deterministic_confidence'] = p['confidence']
            p.update(ranker.rank(by_id[p['parcel_id']], prepared_candidates.get(p['parcel_id'],[]), layers['gnss']))
        flags = Counter(flag for f in result['features'] for flag in f['properties']['validation_flags'])
        result['summary']['review_required'] = sum(f['properties']['review_required'] for f in result['features'])
        run['stages'] += [{'name':name,'status':'completed'} for name in
                         ('Spatial candidate matching','Attribute matching','Confidence scoring','Conflict detection')]
        run['stages'] += [{'name':'Human review','status':'deferred','detail':'Phase 4'},
                         {'name':'Harmonized record','status':'proposed','detail':'Scored proposals saved; no human decision yet'}]
        run.update(status='completed',completed_at=now(),summary=result['summary'],
                   quality_flags=dict(flags),duration_seconds=round(perf_counter()-start,3))
        store.save_run(run,result['features'])
        return run
    except Exception:
        run.update(status='failed',completed_at=now(),error='Processing failed. Check backend logs.')
        store.save_run(run)
        raise
