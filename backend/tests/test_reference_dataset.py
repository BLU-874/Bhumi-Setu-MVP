import hashlib
import json
from pathlib import Path

from fastapi.testclient import TestClient
from pyproj import CRS
import pytest
from shapely.geometry import shape

from data.stage_lalpur import records
from main import create_app
from persistence.store import Store
from services.reference_dataset import FIXTURE, SOURCE_ID, prepared_reference


def test_real_metadata_crs_and_normalized_geometry():
    meta, features = prepared_reference()
    raw = json.loads(FIXTURE.read_text(encoding='utf-8'))
    assert meta['location'] == 'Lalpur, Ahmedabad, Gujarat'
    assert meta['dataset_type'] == 'real_world_reference'
    assert meta['source_type'] == 'real_world_orthophoto_building_data'
    assert meta['representation'] == 'staged_subset_of_original_vector_annotations'
    for key in ('synthetic','benchmark_eligible','cadastral_truth_available','reconciliation_ground_truth_available','gnss_available'):
        assert meta[key] is False
    assert meta['read_only'] is True
    assert meta['source_crs'] == 'EPSG:3857'
    assert meta['analysis_crs'] == 'EPSG:32643'
    assert meta['display_crs'] == 'EPSG:4326'
    assert CRS.from_wkt(meta['source_prj']).to_epsg() == 3857
    assert meta['feature_count'] == 24 and meta['available_lalpur_buildings'] == 317
    assert meta['quality']['valid_after_processing'] == 24
    assert meta['quality']['crs_transformed_features'] == 24
    for feature, original in zip(features, raw['features']):
        assert feature['original_geometry'] == original['geometry']
        assert shape(feature['geometry']).is_valid
        assert not shape(feature['geometry']).is_empty
        assert feature['properties'] == original['properties']
        assert feature['canonical']['owner'] is None and feature['canonical']['survey_no'] is None
        assert not {'parcel_id','owner','owner_name','survey_no','point_id','gnss_verified','ml_match_probability','confidence'} & feature['properties'].keys()
        for field in ('model_name','model_version','model_artifact_sha256','inference_run_id','segmentation_probability'):
            assert feature['properties'][field] is None


def test_api_read_only_catalog_and_no_reconciliation(tmp_path):
    store = Store(url='', path=tmp_path/'reference.sqlite3')
    with TestClient(create_app(store)) as client:
        original_sources = client.get('/api/sources').json()
        assert len(original_sources) == 3
        metadata = client.get('/api/sources?dataset_type=real_world_reference').json()
        assert len(metadata) == 1 and metadata[0]['id'] == SOURCE_ID
        assert client.get(f'/api/sources/{SOURCE_ID}').json() == metadata[0]
        args = {'source_id':SOURCE_ID}
        processed = client.get('/api/layers/buildings', params=args).json()
        original = client.get('/api/layers/buildings', params={**args,'representation':'source'}).json()
        assert len(processed['features']) == len(original['features']) == 24
        for feature, before in zip(processed['features'],original['features']):
            g = shape(feature['geometry'])
            assert 72.75 < g.bounds[0] < 72.77 and 23.03 < g.bounds[1] < 23.05
            assert g.hausdorff_distance(shape(before['geometry'])) < 1e-8
            assert feature['properties']['source_feature_id'] == before['properties']['source_feature_id']
        for kind in ('cadastral','gnss'):
            assert client.get(f'/api/layers/{kind}',params=args).status_code == 422
        response = client.post('/api/runs',json={'buildings':SOURCE_ID})
        assert response.status_code == 422 and 'no verified' in response.json()['detail']
        assert client.get('/api/runs').json() == []
        assert client.get('/api/results').json()['features'] == []
        # A read-only reference must not be reimported as a synthetic source.
        raw = json.loads(FIXTURE.read_text(encoding='utf-8'))
        response = client.post('/api/sources',json={'name':'Do not relabel','kind':'buildings',
                               'source_crs':'EPSG:3857','collection':raw})
        assert response.status_code == 422 and 'read-only' in response.json()['detail']
        assert client.get('/api/sources').json() == original_sources
        assert store.sources() == original_sources


def test_exact_reference_provenance_when_repository_available():
    root = Path('D:/ProjectVaayu')
    if not root.exists():
        pytest.skip('Optional read-only original artifact comparison; reference repository absent')
    raw = json.loads(FIXTURE.read_text(encoding='utf-8'))
    for name, digest in raw['dataset']['source_files_sha256'].items():
        assert hashlib.sha256((root/name).read_bytes()).hexdigest() == digest
    originals = {row['objectid']:(number,row,geometry) for number,row,geometry in records(root)}
    for feature in raw['features']:
        number, row, geometry = originals[feature['properties']['source_feature_id']]
        assert feature['geometry'] == geometry
        assert feature['properties']['source_record_number'] == number
        assert row['village_na'] == 'Lalpur' and row['d_pan_name'] == 'Ahmedabad'
