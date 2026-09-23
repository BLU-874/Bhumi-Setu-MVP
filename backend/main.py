import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from persistence.store import ROOT, Store
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
    app.add_middleware(CORSMiddleware,
        allow_origins=os.getenv('CORS_ORIGINS','http://localhost:5173,http://127.0.0.1:5173').split(','),
        allow_methods=['GET','POST','PATCH','OPTIONS'],allow_headers=['Content-Type'])
    app.include_router(router)

    @app.get('/')
    def root():
        return {'service':'BHUMI-SETU','docs':'/docs','health':'/api/health'}
    return app


app = create_app()
