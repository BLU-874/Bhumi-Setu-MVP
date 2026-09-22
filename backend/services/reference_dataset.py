"""Bundled read-only source, using the existing normalization and layer contract."""
from functools import lru_cache
import json
from pathlib import Path

from domain.normalization import reproject, DISPLAY_CRS

SOURCE_ID = 'lalpur-reference-v1'
SOURCE_TYPE = 'real_world_orthophoto_building_data'
FIXTURE = Path(__file__).resolve().parents[1] / 'data/reference/lalpur-buildings.geojson'


@lru_cache(maxsize=1)
def prepared_reference():
    from services.sources import prepare_source
    collection = json.loads(FIXTURE.read_text(encoding='utf-8'))
    dataset = collection['dataset']
    metadata, features = prepare_source('buildings', dataset['name'], dataset['source_crs'],
                                        collection, SOURCE_ID, reference_metadata=dataset)
    return metadata, features


def source_geometry_layer():
    _, features = prepared_reference()
    return {'type':'FeatureCollection', 'features':[
        {'type':'Feature', 'geometry':reproject(f['original_geometry'], 'EPSG:3857', DISPLAY_CRS),
         'properties':{**f['properties'], 'quality':f['quality'], 'representation':'original_vector_reprojected_for_display'}}
        for f in features]}
