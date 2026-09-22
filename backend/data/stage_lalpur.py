"""Explicit, bounded staging utility: read reference files; write only this repo's fixture.

No GDAL, imagery decoding, inference, or external packages are required.
This narrow reader excludes multipart records rather than guessing ring topology.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import subprocess

SOURCE_FILE = 'sample_data/ShapeFiles/LalPur/Gujarat_Build_Up_Area_Type.shp'
OUTPUT = Path(__file__).parent / 'reference' / 'lalpur-buildings.geojson'


def records(root):
    shp = (root / SOURCE_FILE).read_bytes()
    dbf = (root / SOURCE_FILE).with_suffix('.dbf').read_bytes()
    count, header, length = struct.unpack_from('<IHH', dbf, 4)
    fields = []
    for offset in range(32, header - 1, 32):
        field = dbf[offset:offset + 32]
        fields.append((field[:11].split(b'\0')[0].decode(), field[16]))
    offset = 100
    for index in range(count):
        number, words = struct.unpack_from('>II', shp, offset)
        body = shp[offset + 8:offset + 8 + words * 2]
        offset += 8 + words * 2
        start = header + index * length
        if dbf[start:start+1] == b'*':
            continue
        row, cursor = {}, start + 1
        for name, size in fields:
            row[name] = dbf[cursor:cursor+size].decode('utf-8').strip()
            cursor += size
        if row['village_na'] != 'Lalpur':
            continue
        assert row['d_pan_name'] == 'Ahmedabad' and row['state_code'] == '24'
        assert struct.unpack_from('<I', body)[0] == 5
        parts, points = struct.unpack_from('<II', body, 36)
        if parts != 1:
            yield number, row, None
            continue
        ring = [list(struct.unpack_from('<dd', body, 48+i*16)) for i in range(points)]
        assert ring[0] == ring[-1]
        yield number, row, {'type':'Polygon', 'coordinates':[ring]}


def stage(root):
    all_records = sorted(records(root), key=lambda row: int(row[1]['objectid']))
    selected = [record for record in all_records if record[2] is not None][:24]
    commit = subprocess.check_output(['git','-C',str(root),'rev-parse','HEAD'], text=True).strip()
    files = [SOURCE_FILE.replace('.shp', ext) for ext in ('.shp','.shx','.dbf','.prj','.cpg')]
    files += ['sample_data/ECW/ortho_lalpur(511638)_3857.ecw']
    hashes = {name: hashlib.sha256((root/name).read_bytes()).hexdigest() for name in files}
    dataset = {
        'id':'lalpur-reference-v1', 'name':'Lalpur, Ahmedabad — Real-World Dataset',
        'dataset_type':'real_world_reference', 'location':'Lalpur, Ahmedabad, Gujarat',
        'source_type':'real_world_orthophoto_building_data',
        'imagery_source':'ProjectVaayu reference dataset', 'synthetic':False,
        'benchmark_eligible':False, 'cadastral_truth_available':False,
        'reconciliation_ground_truth_available':False, 'gnss_available':False,
        'representation':'staged_subset_of_original_vector_annotations',
        'source_crs':'EPSG:3857', 'repository':'https://github.com/Kabeer2004/ProjectVaayu',
        'repository_commit':commit, 'source_file':SOURCE_FILE, 'source_file_sha256':hashes[SOURCE_FILE],
        'source_files_sha256':hashes, 'source_prj':(root/SOURCE_FILE).with_suffix('.prj').read_text(),
        'selection':'First 24 single-part Lalpur records by numeric objectid; exact coordinates, no simplification',
        'available_lalpur_buildings':len(all_records), 'staged_buildings':len(selected),
        'imagery_status':'Reference ECW exists; not bundled or rendered',
        'roads_status':'Reference polygon shapefile exists; not staged in the current building-source schema',
        'annotation_origin':'README describes supplied shapefiles as manually created annotations; not new model predictions',
        'license_status':'No explicit code/data licence found in the reference repository; redistribution permission is unverified',
        'model_name':None, 'model_version':None, 'inference_run_id':None,
        'segmentation_probability':None,
    }
    features = []
    for number, row, geometry in selected:
        features.append({'type':'Feature','geometry':geometry,'properties':{
            'footprint_id':f"vaayu-building-{row['objectid']}", 'source_feature_id':row['objectid'],
            'source_record_number':number, 'source_village':row['village_na'],
            'source_district':row['d_pan_name'], 'source_village_code':row['village_co'],
            'source_type':dataset['source_type'], 'dataset_id':dataset['id'],
            'source_file':SOURCE_FILE, 'source_file_sha256':hashes[SOURCE_FILE],
            'model_name':None, 'model_version':None, 'model_artifact_sha256':None,
            'inference_run_id':None, 'segmentation_probability':None,
            'confidence_method':'not_available', 'derived_from':SOURCE_FILE}})
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps({'type':'FeatureCollection','dataset':dataset,'features':features},
                                 ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(f'Staged {len(features)} of {len(all_records)} Lalpur buildings: {OUTPUT}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--reference', type=Path, required=True)
    stage(parser.parse_args().reference)
