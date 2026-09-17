"""CRS and field normalization adapted from the prototype's PyProj approach."""
from functools import lru_cache
from math import isfinite

from pyproj import CRS, Transformer
from shapely.geometry import mapping, shape
from shapely.ops import transform
from shapely.validation import explain_validity

from domain.matching import fix_topology, normalize_attributes

METRIC_CRS = 'EPSG:32643'
DISPLAY_CRS = 'EPSG:4326'


@lru_cache(maxsize=32)
def crs(name):
    return CRS(name)


@lru_cache(maxsize=32)
def transformer(source, target):
    return Transformer.from_crs(crs(source), crs(target), always_xy=True)


def reproject(geometry, source, target):
    if crs(source) == crs(target):
        return geometry
    result = transform(transformer(source, target).transform, shape(geometry))
    if result.is_empty or not all(isfinite(x) for x in result.bounds):
        raise ValueError('CRS transformation produced empty or non-finite geometry')
    return mapping(result)


def prepare_feature(feature, source_crs, kind):
    if not isinstance(feature, dict) or feature.get('type') != 'Feature':
        raise ValueError('Each record must be a GeoJSON Feature')
    if not isinstance(feature.get('geometry'), dict):
        raise ValueError('Feature geometry is required')
    if not isinstance(feature.get('properties'), dict):
        raise ValueError('Feature properties must be an object')
    raw = feature['geometry']
    metric = shape(reproject(raw, source_crs, METRIC_CRS))
    valid = metric.is_valid
    repaired = fix_topology(metric) if kind != 'gnss' else metric
    if repaired.is_empty or not repaired.is_valid:
        raise ValueError('Geometry cannot be safely repaired')
    if kind == 'gnss' and repaired.geom_type != 'Point':
        raise ValueError('GNSS features must be points')
    if kind != 'gnss' and repaired.geom_type not in ('Polygon', 'MultiPolygon'):
        raise ValueError('Parcel and footprint features must be polygons')
    properties = feature.get('properties', {})
    canonical = normalize_attributes(properties)
    area = canonical.get('area')
    if area is not None:
        try:
            valid_area = isfinite(float(area)) and float(area) > 0
        except (TypeError, ValueError):
            valid_area = False
        if not valid_area:
            raise ValueError('Declared area must be a positive finite number or null')
    return {
        'type': 'Feature', 'properties': properties,
        'geometry': mapping(repaired),
        'original_geometry': raw,
        'normalized_original_geometry': mapping(metric),
        'canonical': canonical,
        'quality': {
            'original_valid': valid, 'repaired': not valid,
            'result_valid': repaired.is_valid,
            'reason': explain_validity(metric),
            'source_crs': source_crs, 'analysis_crs': METRIC_CRS,
            'transformed': crs(source_crs) != crs(METRIC_CRS),
            'missing_fields': [k for k, v in canonical.items()
                               if v is None or str(v).strip().lower() in ('', 'unknown', 'n/a')]
                               if kind != 'gnss' else [],
        },
    }
