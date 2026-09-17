import logging
from threading import Lock
from typing import Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from services.sources import prepare_source, display_layer
from services.reconciliation import execute

router = APIRouter(prefix='/api')
run_lock = Lock()


def store(request):
    return request.app.state.store


@router.get('/health')
def health(request: Request):
    db = store(request)
    try:
        db.sources()
    except Exception:
        raise HTTPException(503,'Database unavailable')
    return {'status':'ok','storage_mode':db.mode,'postgis_connected':bool(db.url),'synthetic':True}


@router.get('/sources')
def sources(request: Request):
    return store(request).sources()


@router.get('/sources/{source_id}')
def source(source_id: str, request: Request):
    item = next((s for s in store(request).sources() if s['id']==source_id),None)
    if not item:
        raise HTTPException(404,'Source not found')
    return item


class SourceInput(BaseModel):
    name: str = Field(min_length=1,max_length=120)
    kind: Literal['cadastral','buildings','gnss']
    source_crs: Literal['EPSG:4326','EPSG:32643']
    collection: dict


@router.post('/sources', status_code=201)
def add_source(payload: SourceInput, request: Request):
    try:
        meta, features = prepare_source(payload.kind,payload.name,payload.source_crs,payload.collection)
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
def layer(kind: Literal['cadastral','buildings','gnss'],request: Request,source_id: str | None=None):
    sid = source_id or kind
    meta = source(sid,request)
    if meta['kind'] != kind:
        raise HTTPException(422,'Source type mismatch')
    return display_layer(store(request),sid)


@router.get('/results')
def results(request: Request,run_id: str | None=None):
    completed = [r for r in store(request).runs() if r['status']=='completed']
    selected = run(run_id,request) if run_id else (completed[0] if completed else None)
    return {'type':'FeatureCollection', 'features':store(request).results(selected['id']) if selected else [],
            'run_id':selected['id'] if selected else None,'summary':selected.get('summary') if selected else None}


@router.post('/harmonize')
def compatibility(request: Request):
    created = start_run(request)
    return results(request,created['id'])
