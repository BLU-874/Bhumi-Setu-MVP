"""Fixed first-model protocol: train on training wards only, inspect validation.
No parameter search, threshold tuning or test-set access during training.
"""
import json
import hashlib
from datetime import datetime, timezone
import joblib
import sklearn
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from threadpoolctl import threadpool_limits
from ml.features import FEATURE_NAMES, vector
from ml.build_dataset import ARTIFACTS, DATASET_VERSION, DISCLAIMER
from ml.evaluate import metrics

SEED=26013


def train(directory=ARTIFACTS):
    raw=(directory/'dataset.json').read_bytes()
    rows=json.loads(raw)
    training=[r for r in rows if r['split']=='train']
    validation=[r for r in rows if r['split']=='validation']
    models={'baseline':make_pipeline(SimpleImputer(strategy='median',add_indicator=True,keep_empty_features=True),
        StandardScaler(),LogisticRegression(max_iter=1000,random_state=SEED)),
        'match_ranker':HistGradientBoostingClassifier(max_iter=100,max_leaf_nodes=15,
            l2_regularization=1,early_stopping=False,random_state=SEED)}
    version='synthetic-hgb-v1-'+hashlib.sha256(raw).hexdigest()[:12]
    validation_metrics={}
    for name,model in models.items():
        with threadpool_limits(limits=1):
            model.fit([vector(r['features']) for r in training],[r['label'] for r in training])
        validation_metrics[name]=metrics(model,validation)
        joblib.dump({'model':model,'feature_names':FEATURE_NAMES,'version':version,
            'sklearn_version':sklearn.__version__},directory/f'{name}.joblib')
    metadata={'model_type':'HistGradientBoostingClassifier','model_version':version,
        'training_dataset_label':DISCLAIMER,'dataset_generation_version':DATASET_VERSION,
        'dataset_sha256':hashlib.sha256(raw).hexdigest(),'feature_names':FEATURE_NAMES,
        'training_timestamp':datetime.now(timezone.utc).isoformat(),'random_seed':SEED,
        'sklearn_version':sklearn.__version__,'split_strategy':'Geographic wards 1-3 train / 4 validation / 5 test; both pair members partitioned',
        'counts':{s:len([r for r in rows if r['split']==s]) for s in ('train','validation','test')},
        'validation_metrics':validation_metrics,'selection':'Predeclared HGB first model; baseline comparison; fixed threshold 0.5; no tuning'}
    (directory/'feature_names.json').write_text(json.dumps(FEATURE_NAMES,indent=2),encoding='utf-8')
    (directory/'model_metadata.json').write_text(json.dumps(metadata,indent=2),encoding='utf-8')
    return metadata

if __name__=='__main__':
    print(json.dumps(train(),indent=2))
