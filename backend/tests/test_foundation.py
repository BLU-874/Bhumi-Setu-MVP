import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from shapely.geometry import shape, box, mapping, Point

from data.generate import generate
from domain.matching import harmonize, attribute_similarity
from domain.normalization import reproject
from main import create_app
from persistence.store import Store


@pytest.fixture(scope='module')
def database(tmp_path_factory):
    return Store(url='',path=tmp_path_factory.mktemp('bhumi')/'demo.sqlite3')


@pytest.fixture(scope='module')
def client(database):
    with TestClient(create_app(database)) as c:
        yield c


def test_deterministic_scenarios():
    a,b=generate(),generate()
    assert json.dumps(a,sort_keys=True)==json.dumps(b,sort_keys=True)
    assert {k:len(v['features']) for k,v in a.items()}=={'cadastral':500,'buildings':475,'gnss':350}
    scenarios={f['properties']['scenario'] for f in a['cadastral']['features']}
    assert {'strong_match','attribute_variation','partial_overlap','geometric_conflict',
            'missing_building','gnss_mismatch','invalid_geometry','duplicate_survey',
            'missing_attributes','area_discrepancy'} <= scenarios


def test_crs_roundtrip():
    original=mapping(Point(73.8567,18.5204))
    metric=reproject(original,'EPSG:4326','EPSG:32643')
    assert metric['coordinates'][0]>100000
    result=reproject(metric,'EPSG:32643','EPSG:4326')
    assert shape(original).distance(shape(result))<1e-10


def test_source_metadata_and_quality(client):
    assert client.get('/api/health').json()['storage_mode']=='local_sqlite_demo'
    sources={s['kind']:s for s in client.get('/api/sources').json()}
    assert sources['cadastral']['quality']['invalid_geometries']==25
    assert sources['cadastral']['quality']['repaired_geometries']==25
    assert sources['cadastral']['quality']['valid_after_processing']==500
    assert sources['cadastral']['quality']['records_missing_attributes']==25
    assert sources['cadastral']['quality']['duplicate_survey_records']==50
    assert sources['cadastral']['quality']['crs_transformed_features']==500
    for kind,count in [('cadastral',500),('buildings',475),('gnss',350)]:
        fc=client.get(f'/api/layers/{kind}').json()
        assert len(fc['features'])==count
        for f in fc['features']:
            g=shape(f['geometry'])
            assert g.is_valid and not g.is_empty
            assert 73<g.bounds[0]<75 and 18<g.bounds[1]<20


def test_scoring_contract():
    geom=mapping(box(0,0,10,10))
    c={'features':[{'geometry':geom,'properties':{'parcel_id':'P','survey_no':'SR-101','owner':'Owner','area_sqm':100}}]}
    b={'features':[{'geometry':geom,'properties':{'footprint_id':'B','SurveyNumber':'SR-101','ownerName':'Owner','areaSqM':100}}]}
    result=harmonize(c,b)['features'][0]['properties']
    assert result['confidence']==100 and result['status']=='matched'
    assert result['confidence_explanation']['geometry_contribution']==65
    assert result['confidence_explanation']['attribute_contribution']==35
    missing=harmonize(c,{'features':[]})['features'][0]['properties']
    assert missing['matched_footprint_id'] is None and missing['confidence']==0
    assert missing['status']=='conflict'


def test_run_and_saved_evidence(client,database):
    response=client.post('/api/runs',json={})
    assert response.status_code==201,response.text
    run=response.json()
    assert run['status']=='completed'
    assert client.get(f'/api/runs/{run["id"]}').json()==run
    result=client.get('/api/results').json()
    assert len(result['features'])==500
    summary=result['summary']
    assert sum(summary[k] for k in ('matched','needs_review','conflict'))==500
    assert all(summary[k]>0 for k in ('matched','needs_review','conflict'))
    by_scenario={}
    for f in result['features']:
        p=f['properties']; by_scenario.setdefault(p['cadastral']['scenario'],[]).append(p)
        e=p['confidence_explanation']
        assert p['confidence']==round(min(e['base_confidence']+e['gnss_boost'],100),1)
        assert p['status']==('matched' if p['confidence']>=75 else 'needs_review' if p['confidence']>=40 else 'conflict')
        assert shape(f['geometry']).is_valid
        available=[v['similarity_pct'] for v in p['attribute_evidence'].values() if v['available']]
        if available:
            assert abs(sum(available)/len(available)-p['attribute_match_pct'])<=.11
    assert all(p['matched_footprint_id'] is None for p in by_scenario['missing_building'])
    assert all(p['status']=='matched' for p in by_scenario['strong_match'])
    assert any(p['status']=='needs_review' for p in by_scenario['partial_overlap'])
    assert any(p['validation']['gnss_related_survey_matches'] is False for p in by_scenario['gnss_mismatch'])
    assert all(p['geometry_quality']['repaired'] for p in by_scenario['invalid_geometry'])
    assert all(p['validation']['area_consistent'] is False for p in by_scenario['area_discrepancy'])
    assert all(not p['attribute_evidence']['owner']['available'] for p in by_scenario['missing_attributes'])
    # Persistence must survive a new app/repository instance.
    with TestClient(create_app(Store(url='',path=database.path))) as restarted:
        assert restarted.get('/api/results').json()==result


def test_source_api_and_errors(client):
    assert client.get('/api/sources/no-such-source').status_code==404
    assert client.get('/api/runs/no-such-run').status_code==404
    assert client.post('/api/runs',json={'cadastral':'missing'}).status_code==422
    assert client.post('/api/sources',json={'name':'Empty','kind':'cadastral','source_crs':'EPSG:4326','collection':{'type':'FeatureCollection','features':[]}}).status_code==422
    feature=generate()['cadastral']['features'][0]
    response=client.post('/api/sources',json={'name':'Test source','kind':'cadastral','source_crs':'EPSG:4326','collection':{'type':'FeatureCollection','features':[feature]}})
    assert response.status_code==201,response.text
    sid=response.json()['id']
    assert client.get(f'/api/sources/{sid}').json()['feature_count']==1
    assert len(client.get(f'/api/layers/cadastral?source_id={sid}').json()['features'])==1
