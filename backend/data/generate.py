"""Deterministic synthetic study area near Pune; never official land records.

Built in metres, with varied block sizes, street gaps and rotated footprints.
Footprints intentionally represent parcel-scale comparison polygons, not evidence
that a building boundary and a legal parcel boundary are the same real entity.
"""
import json
import random
from pathlib import Path

from pyproj import Transformer
from shapely.affinity import rotate, scale, translate
from shapely.geometry import Point, Polygon, box, mapping

from domain.normalization import reproject
from data.study_area import STUDY_AREA

SEED = 26013
LABEL = 'Synthetic demonstration dataset'
SCENARIOS = (['strong_match'] * 8 + ['attribute_variation'] * 2 +
             ['partial_overlap'] * 3 + ['geometric_conflict', 'missing_building',
              'gnss_mismatch', 'invalid_geometry', 'duplicate_survey',
              'missing_attributes', 'area_discrepancy'])
OWNERS = ['Rajesh Kumar', 'Sunita Deshmukh', 'Anita Kulkarni', 'Ganesh Pawar',
          'Meena Shinde', 'Ramesh Patil', 'Kavita Jadhav', 'Vikram Joshi']


def generate(origin_lon=None, origin_lat=None):
    rng = random.Random(SEED)
    lon = STUDY_AREA['origin_lon'] if origin_lon is None else origin_lon
    lat = STUDY_AREA['origin_lat'] if origin_lat is None else origin_lat
    origin_x, origin_y = Transformer.from_crs(4326, 32643, always_xy=True).transform(lon, lat)
    layers = {k: {'type': 'FeatureCollection', 'features': []} for k in ('cadastral', 'buildings', 'gnss')}
    layers['gnss']['crs'] = {'type': 'name', 'properties': {'name': 'urn:ogc:def:crs:EPSG::32643'}}
    layers['buildings']['crs'] = {'type': 'name', 'properties': {'name': 'urn:ogc:def:crs:EPSG::32643'}}
    survey_list = []
    for i in range(500):
        row, col = divmod(i, 25)
        x = origin_x + col * 64 + (col // 5) * 18 + rng.uniform(-2, 2)
        y = origin_y + row * 62 + (row // 4) * 22 + rng.uniform(-2, 2)
        width, height = rng.uniform(23, 34), rng.uniform(22, 32)
        geom = box(x, y, x + width, y + height)
        scenario = SCENARIOS[i % len(SCENARIOS)]
        survey = f'SR-{1001+i}'
        if scenario == 'duplicate_survey':
            survey = survey_list[-1]
        survey_list.append(survey)
        owner = OWNERS[i % len(OWNERS)]
        area = round(geom.area, 1)
        cgeom = geom
        if scenario == 'invalid_geometry':
            # Self-crossing bow-tie. make_valid produces a valid MultiPolygon.
            cgeom = Polygon([(x,y),(x+width,y+height),(x,y+height),(x+width,y),(x,y)])
        cp = {'parcel_id': f'P{i+1:04}', 'survey_no': survey, 'owner': owner,
              'area_sqm': area, 'ward': f'Synthetic ward {row//4+1}',
              'scenario': scenario, 'source': LABEL}
        if scenario == 'missing_attributes':
            cp['owner'] = None
            cp['area_sqm'] = None
        layers['cadastral']['features'].append({'type': 'Feature', 'properties': cp,
            'geometry': reproject(mapping(cgeom), 'EPSG:32643', 'EPSG:4326')})
        if scenario != 'missing_building':
            bg = rotate(scale(geom, .98, .98), rng.uniform(-1,1), origin='centroid')
            bp = {'footprint_id': f'B{i+1:04}', 'SurveyNumber': survey,
                  'ownerName': owner, 'areaSqM': round(area*rng.uniform(.97,1.03),1),
                  'source': LABEL, 'capture_date': '2026-07-15'}
            if scenario == 'attribute_variation':
                bp['SurveyNumber'] = survey.replace('SR-', 'SurveyNo')
                bp['ownerName'] = owner[0] + '. ' + owner.split()[-1]
            if scenario == 'partial_overlap':
                bg = translate(bg, width*.38, height*.15)
            if scenario == 'geometric_conflict':
                bg = translate(scale(bg,.55,.55), width*.8, height*.7)
                bp.update(ownerName='Unknown', SurveyNumber='N/A')
            if scenario == 'area_discrepancy':
                bp['areaSqM'] = round(area*1.8,1)
            if scenario == 'missing_attributes':
                bp['ownerName'] = 'Unknown'
                bp['areaSqM'] = None
            layers['buildings']['features'].append({'type':'Feature','geometry':mapping(bg),'properties':bp})
        # Exactly 350 observations, including all deliberate survey mismatches.
        if i % 10 < 7:
            pt = Point(x+width*.45+rng.uniform(-.5,.5), y+height*.55+rng.uniform(-.5,.5))
            layers['gnss']['features'].append({'type':'Feature','geometry':mapping(pt),
                'properties': {'point_id':f'G{i+1:04}',
                    'related_survey_no': 'SR-99999' if scenario == 'gnss_mismatch' else survey,
                    'accuracy_m':round(rng.uniform(.02,.08),3),
                    'capture_date':'2026-07-20', 'source':LABEL}})
    return layers


if __name__ == '__main__':
    target = Path(__file__).parent / 'generated'
    target.mkdir(exist_ok=True)
    for name, fc in generate().items():
        (target / f'{name}.geojson').write_text(json.dumps(fc), encoding='utf-8')
        print(f'{name}: {len(fc["features"])} features')
