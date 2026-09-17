import os

import pytest
from fastapi.testclient import TestClient

from main import create_app
from persistence.store import Store
from persistence.verification import verify


@pytest.fixture()
def client(tmp_path):
    db=Store(url='',path=tmp_path/'review.sqlite3')
    with TestClient(create_app(db)) as c:
        response=c.post('/api/runs',json={})
        assert response.status_code==201
        yield c,response.json()['id']


def test_sqlite_health_and_verification(client):
    c,_=client
    health=c.get('/api/health').json()
    assert health['storage_mode']=='local_sqlite_demo'
    assert health['postgis_connected'] is False
    assert health['postgis_available'] is False
    assert health['schema_ready'] is True
    assert health['ready'] is True
    assert c.get('/api/database/verify').json()['message'].startswith('Local SQLite')


def test_review_decision_persists_and_audits(client):
    c,run_id=client
    pending=c.get(f'/api/review-cases?run_id={run_id}&status=pending').json()
    assert pending['total']>0
    case=pending['cases'][0]
    assert case['status']=='pending' and case['decision'] is None
    updated=c.patch(f"/api/review-cases/{case['id']}",json={
        'decision':'reject','reviewer':'officer-01','note':'Boundary evidence conflicts with source record',
        'expected_version':case['version']})
    assert updated.status_code==200,updated.text
    body=updated.json()
    assert body['status']=='resolved' and body['decision']=='rejected' and body['version']==1
    assert c.get(f"/api/review-cases/{case['id']}").json()['decision']=='rejected'
    audit=c.get(f'/api/audit?run_id={run_id}&record_id={case["record_id"]}').json()
    assert audit['total']==1 and audit['events'][0]['action']=='review.reject'
    assert audit['events'][0]['before']['status']=='pending'
    assert audit['events'][0]['after']['decision']=='rejected'
    with TestClient(create_app(Store(url='',path=c.app.state.store.path))) as restarted:
        assert restarted.get(f"/api/review-cases/{case['id']}").json()['decision']=='rejected'
        assert restarted.get(f'/api/audit?run_id={run_id}').json()['total']==1


def test_decision_changes_append_audit_and_conflicts_are_rejected(client):
    c,run_id=client
    case=c.get(f'/api/review-cases?run_id={run_id}').json()['cases'][0]
    first=c.patch(f"/api/review-cases/{case['id']}",json={'decision':'reject','reviewer':'officer-a','expected_version':0})
    assert first.status_code==200
    second=c.patch(f"/api/review-cases/{case['id']}",json={'decision':'investigate','reviewer':'officer-b','expected_version':1})
    assert second.status_code==200 and second.json()['status']=='investigating'
    stale=c.patch(f"/api/review-cases/{case['id']}",json={'decision':'accept','reviewer':'officer-c','expected_version':0})
    assert stale.status_code==409
    audit=c.get(f'/api/audit?run_id={run_id}&record_id={case["record_id"]}').json()
    assert audit['total']==2
    assert [e['action'] for e in reversed(audit['events'])]==['review.reject','review.investigate']


def test_invalid_and_missing_review_requests(client):
    c,run_id=client
    cases=c.get(f'/api/review-cases?run_id={run_id}').json()['cases']
    case=cases[0]
    assert c.patch(f"/api/review-cases/{case['id']}",json={'decision':'bad','reviewer':'x','expected_version':0}).status_code==422
    assert c.patch('/api/review-cases/no-such-case',json={'decision':'reject','reviewer':'x','expected_version':0}).status_code==404
    assert c.get('/api/review-cases?run_id=no-such-run').status_code==404


@pytest.mark.skipif(not os.getenv('DATABASE_URL'),reason='DATABASE_URL not configured; PostgreSQL verification is intentionally optional')
def test_configured_postgis_verification():
    result=verify(Store())
    assert result['database_reachable'] is True
    assert result['postgis_available'] is True
    assert result['schema_ready'] is True
    assert result['geometry_ready'] is True
    assert result['spatial_query_ok'] is True
