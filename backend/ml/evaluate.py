"""Evaluate frozen artifacts at a predeclared 0.5 classification threshold."""
import json
import hashlib
import joblib
import numpy as np
from sklearn.metrics import precision_score, recall_score, f1_score, roc_auc_score, confusion_matrix
from threadpoolctl import threadpool_limits
from ml.build_dataset import ARTIFACTS, DISCLAIMER
from ml.features import vector


def metrics(model, rows):
    y=np.array([r['label'] for r in rows])
    with threadpool_limits(limits=1):
        probability=model.predict_proba([vector(r['features']) for r in rows])[:,1]
    predicted=probability>=.5
    return {'precision':float(precision_score(y,predicted,zero_division=0)),
        'recall':float(recall_score(y,predicted,zero_division=0)),
        'f1':float(f1_score(y,predicted,zero_division=0)),
        'roc_auc':float(roc_auc_score(y,probability)) if len(set(y))==2 else None,
        'confusion_matrix':confusion_matrix(y,predicted,labels=[0,1]).tolist(),
        'positive_examples':int(sum(y)), 'negative_examples':int(sum(y==0)), 'threshold':.5}


def evaluate(directory=ARTIFACTS):
    raw=(directory/'dataset.json').read_bytes()
    metadata=json.loads((directory/'model_metadata.json').read_text(encoding='utf-8'))
    if hashlib.sha256(raw).hexdigest()!=metadata['dataset_sha256']:
        raise ValueError('Dataset differs from frozen training manifest')
    test=[r for r in json.loads(raw) if r['split']=='test']
    results={'context':DISCLAIMER,'test':{}}
    for name,file in [('logistic_regression','baseline.joblib'),('hist_gradient_boosting','match_ranker.joblib')]:
        results['test'][name]=metrics(joblib.load(directory/file)['model'],test)
    (directory/'metrics.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
    metadata['test_metrics']=results['test']
    (directory/'model_metadata.json').write_text(json.dumps(metadata,indent=2),encoding='utf-8')
    return results

if __name__=='__main__':
    print(json.dumps(evaluate(),indent=2))
