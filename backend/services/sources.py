from collections import Counter
from uuid import uuid4
from functools import lru_cache

from data.generate import generate, LABEL
from domain.normalization import prepare_feature, reproject, METRIC_CRS, DISPLAY_CRS
from services.derived_footprints import validate_collection, PROVENANCE_FIELDS
from services.reference_dataset import SOURCE_ID as REFERENCE_ID, SOURCE_TYPE as REFERENCE_TYPE

NAMES = {'cadastral':'Cadastral / Revenue Parcels',
         'buildings':'Building Footprints / Drone-ORI representation',
         'gnss':'GNSS / Survey Points'}


def prepare_source(kind, name, source_crs, collection, source_id=None, source_type=None, reference_metadata=None):
    if collection.get('type') != 'FeatureCollection' or not isinstance(collection.get('features'),list):
        raise ValueError('Expected a GeoJSON FeatureCollection')
    if not 1 <= len(collection['features']) <= 5000:
        raise ValueError('Foundation supports 1 to 5,000 features per source')
    reference_marked = [f.get('properties', {}).get('source_type') == REFERENCE_TYPE
                        for f in collection['features'] if isinstance(f, dict) and isinstance(f.get('properties'), dict)]
    if any(reference_marked) and reference_metadata is None:
        raise ValueError('Bundled real-world reference sources are read-only; use the reference source listing')
    if reference_metadata is not None:
        if (kind != 'buildings' or source_id != REFERENCE_ID or source_crs != 'EPSG:3857'
                or len(reference_marked) != len(collection['features']) or not all(reference_marked)
                or reference_metadata.get('location') != 'Lalpur, Ahmedabad, Gujarat'
                or any(reference_metadata.get(k) is not False for k in
                       ('synthetic','benchmark_eligible','cadastral_truth_available','reconciliation_ground_truth_available'))):
            raise ValueError('Invalid Lalpur reference contract')
    collection, source_type = validate_collection(kind, collection, source_type)
    features, ids = [], set()
    field = {'cadastral':'parcel_id','buildings':'footprint_id','gnss':'point_id'}[kind]
    for index, f in enumerate(collection['features']):
        item = prepare_feature(f,source_crs,kind)
        fid = str(item['properties'].get(field) or f'F{index+1:05}')
        if fid in ids:
            raise ValueError(f'Duplicate feature ID: {fid}')
        ids.add(fid)
        item['properties'][field] = fid
        # Canonical cadastral fields are required by the preserved validation engine.
        if kind == 'cadastral':
            for canonical, target in [('survey_no','survey_no'),('owner','owner'),('area','area_sqm')]:
                item['properties'][target] = item['canonical'][canonical]
        item['id'] = fid
        features.append(item)
    surveys = Counter(str(f['canonical'].get('survey_no')) for f in features if f['canonical'].get('survey_no'))
    metadata = {
        'id':source_id or str(uuid4()), 'kind':kind, 'name':name,
        'label': LABEL, 'feature_count':len(features), 'source_crs':source_crs,
        'analysis_crs':METRIC_CRS, 'display_crs':DISPLAY_CRS,
        'fields': sorted({k for f in features for k in f['properties']}),
        'status':'ready', 'quality': {
            'invalid_geometries':sum(not f['quality']['original_valid'] for f in features),
            'repaired_geometries':sum(f['quality']['repaired'] for f in features),
            'valid_after_processing':sum(f['quality']['result_valid'] for f in features),
            'records_missing_attributes':sum(bool(f['quality']['missing_fields']) for f in features),
            'duplicate_survey_records':sum(n for n in surveys.values() if n>1),
            'crs_transformed_features':sum(f['quality']['transformed'] for f in features),
        },
    }
    if source_type:
        metadata['source_type'] = source_type
        metadata['demonstration'] = all(f['properties']['demonstration'] for f in features)
        metadata['label'] = ('Staged synthetic drone-footprint demonstration; not cadastral truth'
                             if metadata['demonstration'] else 'AI-derived drone footprints; not cadastral truth')
        # Per-feature provenance is always retained. Only summarize common values.
        metadata['provenance'] = {
            key: features[0]['properties'][key]
            if all(f['properties'][key] == features[0]['properties'][key] for f in features) else None
            for key in PROVENANCE_FIELDS
        }
    if reference_metadata is not None:
        metadata.update(reference_metadata)
        metadata.update(id=source_id, kind=kind, read_only=True,
                        label='Real-world geospatial reference dataset — staged original vector subset; not cadastral truth')
    return metadata, features


def demo_sources():
    return [prepare_source(kind,NAMES[kind],'EPSG:4326' if kind=='cadastral' else 'EPSG:32643',fc,kind)
            for kind,fc in generate().items()]


def display_collection(features):
    return {'type':'FeatureCollection','features':[
        {'type':'Feature','geometry':reproject(f['geometry'],METRIC_CRS,DISPLAY_CRS),
         'properties':{**f['properties'],'quality':f['quality']}} for f in features]}


@lru_cache(maxsize=12)
def display_layer(store, source_id):
    # Source versions are immutable in Phase 3; each POST gets a fresh UUID.
    return display_collection(store.features(source_id))
