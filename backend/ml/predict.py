"""Only load locally trusted joblib artifacts; never accept an uploaded model."""
import os
import logging
from pathlib import Path
from ml.features import FEATURE_NAMES, extract, vector

DEFAULT_MODEL=Path(__file__).parent/'artifacts'/'match_ranker.joblib'


class Ranker:
    def __init__(self,path=None):
        self.model=None
        self.version=None
        self.reason='Model disabled' if os.getenv('ML_ENABLED','true').lower() in ('false','0','no') else 'Model unavailable'
        if self.reason=='Model disabled':
            return
        try:
            import joblib
            import sklearn
            artifact=joblib.load(path or DEFAULT_MODEL)
            if artifact['feature_names']!=FEATURE_NAMES or artifact['sklearn_version']!=sklearn.__version__:
                raise ValueError('Model feature/runtime contract mismatch')
            self.model=artifact['model']
            if self.model.n_features_in_!=len(FEATURE_NAMES) or list(self.model.classes_)!=[0,1]:
                raise ValueError('Model dimensions/classes mismatch')
            self.version=artifact['version']
        except Exception:
            self.model=None
            logging.warning('ML artifact unavailable or incompatible; deterministic fallback active')

    def rank(self,parcel,candidates,gnss):
        result={'model_available':self.model is not None,'model_version':self.version,
            'ml_ranked_candidate_id':None,'ml_match_probability':None,'ml_rank':None,'ml_candidates':[]}
        if self.model is None:
            result['ml_unavailable_reason']=self.reason
            return result
        if not candidates:
            return result
        try:
            from threadpoolctl import threadpool_limits
            evidence=[extract(parcel,b,gnss) for b in candidates]
            with threadpool_limits(limits=1):
                probabilities=self.model.predict_proba([vector(f) for f in evidence])[:,1]
            ranked=sorted([{'candidate_id':b['id'],'ml_match_probability':float(p),'features':f}
                for b,p,f in zip(candidates,probabilities,evidence)],key=lambda r:(-r['ml_match_probability'],r['candidate_id']))
            for i,r in enumerate(ranked,1):
                r['ml_rank']=i
            result.update(ml_candidates=ranked,ml_ranked_candidate_id=ranked[0]['candidate_id'],
                ml_match_probability=ranked[0]['ml_match_probability'],ml_rank=1)
        except Exception:
            logging.exception('ML inference failed; deterministic result preserved')
            result.update(model_available=False,ml_unavailable_reason='Inference unavailable')
        return result
