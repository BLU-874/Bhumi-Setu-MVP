import json
from copy import deepcopy
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from shapely.geometry import shape, mapping, Polygon, Point

from domain.normalization import reproject
from main import create_app
from persistence.store import Store
from services.sources import prepare_source

FIXTURE = Path(__file__).resolve().parents[2] / 'frontend/public/fixtures/staged-drone.geojson'
SUBTYPE = 'ai_derived_drone_footprint'


def payload():
    fc = json.loads(FIXTURE.read_text(encoding='utf-8'))
    return dict(name=fc['name'], kind='buildings', source_crs=fc['source_crs'],
                source_type=SUBTYPE, collection=fc)


def test_contract_crs_geometry_and_missing_provenance():
    data = payload()
    meta, features = prepare_source(**data)
    assert meta['kind'] == 'buildings' and meta['source_type'] == SUBTYPE
    assert meta['demonstration'] is True and meta['feature_count'] == 6
    assert all(v is None for v in meta['provenance'].values())
    assert meta['quality']['crs_transformed_features'] == 6
    for raw, prepared in zip(data['collection']['features'], features):
        assert prepared['properties'] == raw['properties']
        assert prepared['quality']['analysis_crs'] == 'EPSG:32643'
        assert shape(prepared['geometry']).is_valid
        recovered = reproject(prepared['geometry'], 'EPSG:32643', 'EPSG:3857')
        assert shape(recovered).hausdorff_distance(shape(raw['geometry'])) < .0001
        assert abs(shape(prepared['geometry']).area - raw['properties']['area_sqm']) < .01
        assert prepared['canonical']['survey_no'] is None
        assert prepared['canonical']['owner'] is None
        assert prepared['properties']['segmentation_probability'] is None


@pytest.mark.parametrize('key,value', [
    ('footprint_id', ''), ('model_artifact_sha256', 'invented'),
    ('segmentation_probability', 1.2), ('segmentation_probability', -.1),
    ('segmentation_probability', True), ('segmentation_probability', .7),
    ('confidence_method', 'invented'), ('ownerName', 'Imagined owner'),
    ('survey_no', 'SR-101'), ('parcel_id', 'P1'), ('confidence', 99),
    ('area_sqm', -5), ('model_name', '   '),
])
def test_invalid_contract_rejected(key, value):
    data = payload()
    data['collection']['features'][0]['properties'][key] = value
    with pytest.raises(ValueError):
        prepare_source(**data)


def test_mixed_sources_duplicate_ids_and_wrong_geometry_rejected():
    data = payload()
    data['collection']['features'][0]['properties'].pop('source_type')
    with pytest.raises(ValueError, match='only AI-derived'):
        prepare_source(**data)
    data = payload()
    data['kind'] = 'cadastral'
    with pytest.raises(ValueError):
        prepare_source(**data)
    data = payload()
    data['collection']['features'][1]['properties']['footprint_id'] = 'staged-drone-0001'
    with pytest.raises(ValueError, match='Duplicate'):
        prepare_source(**data)
    data = payload()
    data['collection']['features'][0]['geometry'] = mapping(Point(0, 0))
    with pytest.raises(ValueError):
        prepare_source(**data)


def test_repair_and_explicit_probability_contract():
    data = payload()
    feature = data['collection']['features'][0]
    x, y, _, _ = shape(feature['geometry']).bounds
    feature['geometry'] = mapping(Polygon([(x,y),(x+10,y+10),(x,y+10),(x+10,y),(x,y)]))
    # Unit-test values validate transport, not measured model performance.
    feature['properties'].update(segmentation_probability=.6, confidence_method='test_mean_pixel_probability')
    data.pop('source_type')  # subtype can also be inferred from feature properties
    meta, features = prepare_source(**data)
    assert meta['source_type'] == SUBTYPE
    assert features[0]['quality']['repaired']
    assert shape(features[0]['geometry']).is_valid
    assert features[0]['properties']['segmentation_probability'] == .6


def test_api_selection_provenance_review_audit_and_restart(tmp_path, monkeypatch):
    monkeypatch.setenv('ML_ENABLED', 'true')
    path = tmp_path / 'derived.sqlite3'
    data = payload()
    # Explicit test provenance verifies transport, with no model loading or inference claim.
    provenance = dict(model_name='test-extractor', model_version='test-v1',
                      model_artifact_sha256='a'*64, inference_run_id='test-run', derived_from='test-imagery')
    for feature in data['collection']['features']:
        feature['properties'].update(provenance)
    db = Store(url='', path=path)
    with TestClient(create_app(db)) as client:
        response = client.post('/api/sources', json=data)
        assert response.status_code == 201, response.text
        source = response.json()
        sid = source['id']
        assert source['provenance'] == provenance
        assert source in client.get('/api/sources').json()
        assert client.get(f'/api/sources/{sid}').json() == source
        display = client.get(f'/api/layers/buildings?source_id={sid}').json()
        assert len(display['features']) == 6
        assert 73 < shape(display['features'][0]['geometry']).bounds[0] < 75
        invalid = deepcopy(data)
        invalid['collection']['features'][0]['properties']['owner'] = 'Not supported'
        assert client.post('/api/sources', json=invalid).status_code == 422
        assert len(client.get('/api/sources').json()) == 4
        response = client.post('/api/runs', json={'buildings': sid})
        assert response.status_code == 201, response.text
        run = response.json()
        assert run['source_ids']['buildings'] == sid
        result = client.get('/api/results', params={'run_id': run['id']}).json()
        paired = [f['properties'] for f in result['features'] if f['properties']['matched_footprint_id']]
        assert len(paired) == 6
        for props in paired:
            assert props['matched_footprint_id'].startswith('staged-drone-')
            assert props['footprint_properties']['source_type'] == SUBTYPE
            assert all(props['footprint_properties'][k] == v for k, v in provenance.items())
            assert props['footprint_properties']['segmentation_probability'] is None
            assert props['deterministic_confidence'] == props['confidence']
            assert props['model_available'] and 0 <= props['ml_match_probability'] <= 1
            assert not props['attribute_evidence']['owner']['available']
            assert not props['attribute_evidence']['survey_no']['available']
        cases = client.get('/api/review-cases', params={'run_id': run['id']}).json()['cases']
        derived_cases = [c for c in cases if c['feature']['properties']['matched_footprint_id']]
        for decision, case in zip(('accept', 'reject', 'investigate'), derived_cases):
            response = client.patch(f"/api/review-cases/{case['id']}", json={
                'decision': decision, 'reviewer': 'test-officer', 'expected_version': 0})
            assert response.status_code == 200, response.text
            saved = response.json()
            assert saved['feature']['properties']['footprint_properties']['model_name'] == 'test-extractor'
            assert saved['version'] == 1
            assert client.patch(f"/api/review-cases/{case['id']}", json={
                'decision': decision, 'reviewer': 'test-officer', 'expected_version': 0}).status_code == 409
        audit = client.get('/api/audit', params={'run_id': run['id']}).json()
        assert {'review.accept','review.reject','review.investigate'} <= {e['action'] for e in audit['events']}
        # A standard run still uses the original sources and Phase 5.1 fields.
        standard = client.post('/api/runs', json={}).json()
        assert standard['source_ids'] == dict(cadastral='cadastral', buildings='buildings', gnss='gnss')
        standard_result = client.get('/api/results').json()
        assert any(f['properties']['matched_footprint_id'] == 'B0001' for f in standard_result['features'])
        monkeypatch.setenv('ML_ENABLED', 'false')
        assert client.post('/api/runs', json={'buildings': sid}).status_code == 201
        fallback = client.get('/api/results').json()
        for enabled, disabled in zip(result['features'], fallback['features']):
            a, b = enabled['properties'], disabled['properties']
            assert not b['model_available']
            assert a['confidence'] == b['confidence']
            assert a['matched_footprint_id'] == b['matched_footprint_id']
    with TestClient(create_app(Store(url='', path=path))) as restarted:
        assert restarted.get(f'/api/sources/{sid}').json() == source
        assert restarted.get('/api/audit', params={'run_id': run['id']}).json() == audit
        reviewed = restarted.get(f"/api/review-cases/{derived_cases[0]['id']}").json()
        assert reviewed['decision'] == 'accepted'
        assert reviewed['feature']['properties']['footprint_properties']['derived_from'] == 'test-imagery'
