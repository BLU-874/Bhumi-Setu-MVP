import json
from copy import deepcopy

import joblib
import pytest
from fastapi.testclient import TestClient
from shapely.geometry import box, mapping

from domain.normalization import prepare_feature
from ml.features import FEATURE_NAMES, extract, vector
from ml.build_dataset import build, ARTIFACTS
from ml.train import train
from ml.evaluate import evaluate
from ml.predict import Ranker
from main import create_app
from persistence.store import Store


def pair():
    p=prepare_feature({'type':'Feature','geometry':mapping(box(0,0,10,10)),
        'properties':{'parcel_id':'P','survey_no':'SR-1','owner':'Owner','area_sqm':100}},'EPSG:32643','cadastral')
    b=prepare_feature({'type':'Feature','geometry':mapping(box(0,0,10,10)),
        'properties':{'footprint_id':'B','SurveyNumber':'SR-1','ownerName':'Owner','areaSqM':100}},'EPSG:32643','buildings')
    p['id']='P'; b['id']='B'
    return p,b


def test_feature_extraction_and_missing_evidence():
    p,b=pair()
    f=extract(p,b)
    assert list(f)==FEATURE_NAMES
    assert f['intersection_over_union']==1 and f['centroid_distance_m']==0
    assert f['parcel_area_sqm']==100 and f['survey_exact_normalized_match']==1
    assert f['gnss_inside_parcel'] is None and f['gnss_related_survey_match'] is None
    b['properties']['ownerName']='Unknown'
    assert extract(p,b)['owner_similarity'] is None
    b['quality']['analysis_crs']='EPSG:4326'
    with pytest.raises(ValueError,match='EPSG:32643'):
        extract(p,b)


@pytest.fixture(scope='module')
def rows():
    return build()


def test_labels_negatives_and_geographic_split(rows):
    assert len(rows)>500
    assert sum(r['label'] for r in rows)==475
    assert all(r['label']==int(r['footprint_id'][1:]==r['parcel_id'][1:]) for r in rows)
    assert all(r['label']==0 for r in rows if r['scenario']=='missing_building')
    assert {'nearby','attribute_similar'} <= {s for r in rows for s in r['negative_sources']}
    assert not {'parcel_id','footprint_id','scenario','confidence','label'} & set(FEATURE_NAMES)
    partitions={s:{key:{r[key] for r in rows if r['split']==s} for key in ('parcel_id','footprint_id')}
        for s in ('train','validation','test')}
    for a,b in [('train','validation'),('train','test'),('validation','test')]:
        for key in ('parcel_id','footprint_id'):
            assert not partitions[a][key] & partitions[b][key]
    saved=json.loads((ARTIFACTS/'dataset.json').read_text(encoding='utf-8'))
    assert rows==saved


def test_training_serialization_evaluation_and_inference(rows,tmp_path):
    (tmp_path/'dataset.json').write_text(json.dumps(rows),encoding='utf-8')
    metadata=train(tmp_path)
    assert 'test_metrics' not in metadata
    assert set(metadata['validation_metrics'])=={'baseline','match_ranker'}
    measured=evaluate(tmp_path)
    assert measured['test']['hist_gradient_boosting']['positive_examples']>0
    ranker=Ranker(tmp_path/'match_ranker.joblib')
    p,b=pair()
    prediction=ranker.rank(p,[b],[])
    assert prediction['model_available'] and 0<=prediction['ml_match_probability']<=1
    assert prediction['ml_candidates'][0]['features']==extract(p,b)
    assert prediction['ml_ranked_candidate_id']=='B' and prediction['ml_rank']==1
    wrong=deepcopy(b)
    wrong['id']='wrong'
    wrong['geometry']=mapping(box(100,100,110,110))
    ranked=ranker.rank(p,[wrong,b],[])['ml_candidates']
    assert ranked[0]['candidate_id']=='B'
    assert ranked[0]['ml_match_probability']>ranked[1]['ml_match_probability']
    assert [r['ml_rank'] for r in ranked]==[1,2]


def test_feature_contract_and_corrupt_missing_fallback(tmp_path):
    with pytest.raises(ValueError,match='feature names'):
        vector({'wrong':1})
    p,b=pair()
    assert Ranker(tmp_path/'missing.joblib').rank(p,[b],[])['model_available'] is False
    bad=tmp_path/'bad.joblib'
    bad.write_bytes(b'not a model')
    assert Ranker(bad).model is None
    bundle=joblib.load(ARTIFACTS/'match_ranker.joblib')
    bundle['feature_names']=list(reversed(FEATURE_NAMES))
    joblib.dump(bundle,bad)
    assert Ranker(bad).model is None


def test_api_ml_and_disabled_deterministic_parity(tmp_path,monkeypatch):
    with TestClient(create_app(Store(url='',path=tmp_path/'ml.sqlite3'))) as client:
        monkeypatch.setenv('ML_ENABLED','true')
        assert client.post('/api/runs',json={}).status_code==201
        enabled=client.get('/api/results').json()['features']
        assert all(f['properties']['model_available'] for f in enabled)
        assert any(f['properties']['ml_match_probability'] is not None for f in enabled)
        monkeypatch.setenv('ML_ENABLED','false')
        assert client.post('/api/runs',json={}).status_code==201
        disabled=client.get('/api/results').json()['features']
        for a,b in zip(enabled,disabled):
            pa,pb=a['properties'],b['properties']
            assert pb['model_available'] is False
            for key in ('confidence','matched_footprint_id','status','validation_flags','review_required'):
                assert pa[key]==pb[key]
            assert pa['deterministic_confidence']==pa['confidence']
