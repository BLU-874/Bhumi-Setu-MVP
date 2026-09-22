"""Labels use generator correspondence, never deterministic decisions.

Split BEFORE candidate sampling: wards 1-3 train, 4 validation, 5 test.
Both parcels and buildings stay in their geographic partition.
"""
import json
from pathlib import Path
from shapely.geometry import shape
from rapidfuzz import fuzz
from services.sources import demo_sources
from domain.matching import _survey_key
from ml.features import extract

ARTIFACTS = Path(__file__).parent / 'artifacts'
DATASET_VERSION = 'synthetic-pairs-v1'
DISCLAIMER = 'Synthetic training benchmark — not a production accuracy estimate.'


def build():
    layers = {m['kind']: f for m,f in demo_sources()}
    parcels = layers['cadastral']
    gnss_geometries = [(g,shape(g['geometry'])) for g in layers['gnss']]
    splits = {p['id']: ('train' if int(p['properties']['ward'].split()[-1])<=3 else
              'validation' if p['properties']['ward'].endswith('4') else 'test') for p in parcels}
    rows = []
    for p in parcels:
        pool = [b for b in layers['buildings'] if splits['P'+b['id'][1:]]==splits[p['id']]]
        truth = 'B'+p['id'][1:]
        pg = shape(p['geometry'])
        observations = [g for g,geom in gnss_geometries if pg.contains(geom)]
        wrong = [b for b in pool if b['id']!=truth]
        nearby = sorted(wrong,key=lambda b:(pg.distance(shape(b['geometry'])),b['id']))[:4]
        survey = _survey_key(p['canonical']['survey_no']) or ''
        similar = sorted(wrong,key=lambda b:(-fuzz.ratio(survey,_survey_key(b['canonical']['survey_no']) or ''),b['id']))[:2]
        overlapping = [b for b in wrong if pg.intersects(shape(b['geometry']))]
        selected = {b['id']:b for b in nearby+similar+overlapping+[b for b in pool if b['id']==truth]}
        for bid,b in sorted(selected.items()):
            rows.append({'parcel_id':p['id'],'footprint_id':bid,'split':splits[p['id']],
                'scenario':p['properties']['scenario'],'label':int(bid==truth),
                'negative_sources': [] if bid==truth else [name for name,group in
                    [('nearby',nearby),('attribute_similar',similar),('overlapping',overlapping)] if b in group],
                'features':extract(p,b,observations)})
    return rows


def save():
    ARTIFACTS.mkdir(parents=True,exist_ok=True)
    rows=build()
    (ARTIFACTS/'dataset.json').write_text(json.dumps(rows,allow_nan=False),encoding='utf-8')
    print(f'{len(rows)} synthetic candidate pairs saved')

if __name__=='__main__':
    save()
