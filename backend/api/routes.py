import logging
from threading import Lock
from typing import Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from services.sources import prepare_source, display_layer, display_collection
from services.reference_dataset import SOURCE_ID as REFERENCE_ID, prepared_reference, source_geometry_layer
from services.reconciliation import execute
from persistence.verification import verify
from persistence.store import ReviewConflict
from data.study_area import STUDY_AREA

router = APIRouter(prefix='/api')
run_lock = Lock()


@router.get('/study-area')
def study_area():
    return STUDY_AREA


def store(request):
    return request.app.state.store


@router.get('/health')
def health(request: Request):
    db = store(request)
    checked = verify(db)
    return {'status':'ok' if checked['database_reachable'] else 'degraded', 'storage_mode':db.mode, 'synthetic':True,
            'postgis_connected':checked['postgis_available'], **checked}


@router.get('/database/verify')
def database_verify(request: Request):
    return verify(store(request))


@router.get('/sources')
def sources(request: Request, dataset_type: Literal['synthetic_benchmark','real_world_reference'] | None = None):
    if dataset_type == 'real_world_reference':
        return [prepared_reference()[0]]
    return store(request).sources()


@router.get('/sources/{source_id}')
def source(source_id: str, request: Request):
    if source_id == REFERENCE_ID:
        return prepared_reference()[0]
    item = next((s for s in store(request).sources() if s['id']==source_id),None)
    if not item:
        raise HTTPException(404,'Source not found')
    return item


class SourceInput(BaseModel):
    name: str = Field(min_length=1,max_length=120)
    kind: Literal['cadastral','buildings','gnss']
    source_crs: Literal['EPSG:4326','EPSG:32643','EPSG:3857']
    source_type: Literal['ai_derived_drone_footprint'] | None = None
    collection: dict


@router.post('/sources', status_code=201)
def add_source(payload: SourceInput, request: Request):
    try:
        meta, features = prepare_source(payload.kind,payload.name,payload.source_crs,payload.collection,
                                        source_type=payload.source_type)
    except (ValueError,KeyError,TypeError,IndexError) as exc:
        raise HTTPException(422,str(exc))
    store(request).add_source(meta,features)
    return meta


class RunInput(BaseModel):
    cadastral: str = 'cadastral'
    buildings: str = 'buildings'
    gnss: str = 'gnss'


@router.post('/runs',status_code=201)
def start_run(request: Request,payload: RunInput | None = None):
    if REFERENCE_ID in (payload or RunInput()).model_dump().values():
        raise HTTPException(422,'Lalpur reference data has no verified cadastral/GNSS correspondence; reconciliation is unavailable')
    if not run_lock.acquire(blocking=False):
        raise HTTPException(409,'A harmonization run is already processing')
    try:
        return execute(store(request),(payload or RunInput()).model_dump())
    except ValueError as exc:
        raise HTTPException(422,str(exc))
    except Exception:
        logging.exception('Harmonization failed')
        raise HTTPException(500,'Harmonization failed; see backend logs')
    finally:
        run_lock.release()


@router.get('/runs')
def runs(request: Request):
    return store(request).runs()


@router.get('/runs/{run_id}')
def run(run_id: str,request: Request):
    item = next((r for r in store(request).runs() if r['id']==run_id),None)
    if not item:
        raise HTTPException(404,'Run not found')
    return item


@router.get('/layers/{kind}')
def layer(kind: Literal['cadastral','buildings','gnss'],request: Request,source_id: str | None=None,
          representation: Literal['processed','source']='processed'):
    sid = source_id or kind
    meta = source(sid,request)
    if meta['kind'] != kind:
        raise HTTPException(422,'Source type mismatch')
    if sid == REFERENCE_ID:
        return source_geometry_layer() if representation == 'source' else display_collection(prepared_reference()[1])
    if representation == 'source':
        raise HTTPException(422,'Source comparison is available for the bundled reference dataset')
    return display_layer(store(request),sid)


@router.get('/results')
def results(request: Request,run_id: str | None=None):
    completed = [r for r in store(request).runs() if r['status']=='completed']
    selected = run(run_id,request) if run_id else (completed[0] if completed else None)
    return {'type':'FeatureCollection', 'features':store(request).results(selected['id']) if selected else [],
            'run_id':selected['id'] if selected else None,'summary':selected.get('summary') if selected else None}


def selected_run_id(request: Request, run_id: str | None):
    if run_id:
        if not next((r for r in store(request).runs() if r['id']==run_id),None):
            raise HTTPException(404,'Run not found')
        return run_id
    completed=[r for r in store(request).runs() if r['status']=='completed']
    if not completed:
        raise HTTPException(404,'No completed harmonization run')
    return completed[0]['id']


@router.get('/review-cases')
def review_cases(request: Request, run_id: str | None=None, status: str | None=None):
    cases=store(request).review_cases(selected_run_id(request,run_id))
    if status:
        if status not in {'pending','investigating','resolved'}:
            raise HTTPException(422,'Invalid review status')
        cases=[c for c in cases if c['status']==status]
    return {'cases':cases,'total':len(cases),'run_id':run_id or cases[0]['run_id'] if cases else run_id}


@router.get('/review-cases/{case_id}')
def review_case(case_id: str, request: Request):
    case=store(request).review_case(case_id)
    if not case:
        raise HTTPException(404,'Review case not found')
    return case


class DecisionInput(BaseModel):
    decision: Literal['accept','reject','investigate']
    reviewer: str = Field(min_length=1,max_length=120)
    note: str | None = Field(default=None,max_length=2000)
    expected_version: int = Field(ge=0)


@router.patch('/review-cases/{case_id}')
def decide_review(case_id: str, payload: DecisionInput, request: Request):
    try:
        return store(request).decide(case_id,payload.decision,payload.reviewer,payload.note,payload.expected_version)
    except LookupError as exc:
        raise HTTPException(404,str(exc))
    except ReviewConflict as exc:
        raise HTTPException(409,str(exc))
    except ValueError as exc:
        raise HTTPException(422,str(exc))


@router.get('/audit')
def audit(request: Request, run_id: str | None=None, record_id: str | None=None, limit: int=100, offset: int=0):
    if not 1 <= limit <= 500 or offset < 0:
        raise HTTPException(422,'Invalid pagination')
    return store(request).audit(run_id,record_id,limit,offset)


class AuditLogInput(BaseModel):
    run_id: str
    record_id: str
    actor: str = Field(default='Officer', min_length=1, max_length=120)
    action: str = Field(min_length=1, max_length=100)
    metadata: dict | None = None


@router.post('/audit-events', status_code=201)
def record_audit_event(payload: AuditLogInput, request: Request):
    try:
        return store(request).log_audit_event(
            payload.run_id, payload.record_id, payload.actor, payload.action, payload.metadata
        )
    except LookupError as exc:
        raise HTTPException(404, str(exc))
    except ValueError as exc:
        raise HTTPException(422, str(exc))


@router.post('/harmonize')
def compatibility(request: Request):
    created = start_run(request)
    return results(request,created['id'])
