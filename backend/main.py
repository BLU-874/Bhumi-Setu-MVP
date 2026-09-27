import os
import logging
from contextlib import asynccontextmanager
from time import perf_counter
from uuid import uuid4
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from persistence.store import ROOT, Store
from persistence.timing import record, request_id
from services.sources import demo_sources
from data.study_area import STUDY_AREA
from api.routes import router

load_dotenv(ROOT / '.env')


def create_app(database=None):
    db = database or Store()

    @asynccontextmanager
    async def lifespan(app):
        db.initialize()
        if not db.url and not db.sources():
            db.seed(demo_sources())
        else:
            db.sync_study_area(STUDY_AREA)
        app.state.store = db
        yield

    app = FastAPI(title='BHUMI-SETU',description='Explainable rule/evidence-based reconciliation. Synthetic demonstration dataset.',lifespan=lifespan)

    @app.middleware('http')
    async def diagnostic_timing(request: Request, call_next):
        path = request.url.path
        measured = request.method == 'GET' and path in {
            '/api/health', '/api/sources', '/api/runs', '/api/results',
            '/api/layers/cadastral', '/api/layers/buildings', '/api/layers/gnss'
        }
        if not measured:
            return await call_next(request)
        token = request_id.set(uuid4().hex[:12])
        started = perf_counter()
        logging.getLogger('bhumi.performance').warning(
            'perf request_id=%s stage=request.start route=%s', request_id.get(), path)
        try:
            response = await call_next(request)
            return response
        finally:
            record('request.total', started, route=path)
            request_id.reset(token)

    app.add_middleware(CORSMiddleware,
        allow_origins=os.getenv('CORS_ORIGINS','http://localhost:5173,http://127.0.0.1:5173').split(','),
        allow_methods=['GET','POST','PATCH','OPTIONS'],allow_headers=['Content-Type'])
    app.include_router(router)

    @app.get('/')
    def root():
        return {'service':'BHUMI-SETU','docs':'/docs','health':'/api/health'}
    return app


app = create_app()
