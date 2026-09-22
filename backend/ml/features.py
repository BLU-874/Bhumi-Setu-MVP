"""Shared training/inference features. Prepared geometries must be EPSG:32643.

Distances are metres; areas square metres; similarities and IoU are 0..1.
Missing attributes/observations are None, never fabricated negative evidence.
Quality booleans describe original validity and recorded repair respectively.
"""
from shapely.geometry import shape
from rapidfuzz import fuzz
from domain.matching import normalize_attributes, attribute_similarity, _survey_key, _is_present

FEATURE_NAMES = ['intersection_over_union', 'centroid_distance_m', 'boundary_distance_m',
    'parcel_area_sqm', 'building_area_sqm', 'area_difference_pct',
    'survey_number_similarity', 'owner_similarity', 'attribute_similarity',
    'survey_exact_normalized_match', 'gnss_inside_parcel', 'gnss_related_survey_match',
    'parcel_geometry_valid', 'building_geometry_valid',
    'parcel_geometry_repaired', 'building_geometry_repaired']


def extract(parcel, building, gnss=()):
    for feature in (parcel, building):
        if feature.get('quality', {}).get('analysis_crs') != 'EPSG:32643':
            raise ValueError('ML features require prepared EPSG:32643 geometry')
    a, b = shape(parcel['geometry']), shape(building['geometry'])
    aa, bb = [normalize_attributes(f['properties']) for f in (parcel, building)]
    aa, bb = [{k: v if _is_present(v) else None for k, v in attrs.items()} for attrs in (aa, bb)]
    sa, sb = _survey_key(aa['survey_no']), _survey_key(bb['survey_no'])
    observation = next((g for g in gnss if a.contains(shape(g['geometry']))), None)
    related = _survey_key(observation['properties'].get('related_survey_no')) if observation else None
    values = [a.intersection(b).area / a.union(b).area, a.centroid.distance(b.centroid),
        a.boundary.distance(b.boundary), a.area, b.area, abs(a.area-b.area)/max(a.area,b.area)*100,
        fuzz.ratio(sa,sb)/100 if sa and sb else None,
        fuzz.ratio(str(aa['owner']).lower(),str(bb['owner']).lower())/100 if aa['owner'] and bb['owner'] else None,
        attribute_similarity(aa,bb) if any(aa[k] is not None and bb[k] is not None for k in aa) else None,
        int(sa==sb) if sa and sb else None, 1 if observation else None,
        int(sa==related) if sa and related else None,
        int(parcel['quality']['original_valid']),int(building['quality']['original_valid']),
        int(parcel['quality']['repaired']),int(building['quality']['repaired'])]
    return dict(zip(FEATURE_NAMES,values))


def vector(features):
    if set(features) != set(FEATURE_NAMES):
        raise ValueError('ML feature names do not match the model contract')
    return [float('nan') if features[k] is None else float(features[k]) for k in FEATURE_NAMES]
