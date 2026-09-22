import {useEffect,useState} from 'react';
import type {Feature,FeatureCollection} from 'geojson';
import type {ReferenceSource,Results} from '../types';
import {api} from '../services/api';
import MapView from './MapView';
import FootprintProvenance from './FootprintProvenance';

const empty:FeatureCollection={type:'FeatureCollection',features:[]};
const noResults:Results={...empty,features:[],run_id:null,summary:null};

export default function ReferenceWorkspace({embedded=false}:{embedded?:boolean}){
 const Heading=embedded?'h2':'h1';
 const [source,setSource]=useState<ReferenceSource|null>(null);
 const [processed,setProcessed]=useState<FeatureCollection>(empty),[original,setOriginal]=useState<FeatureCollection>(empty);
 const [selected,setSelected]=useState<Feature|null>(null),[error,setError]=useState('');
 const [visible,setVisible]=useState({buildings:true,original:false});
 const [satellite,setSatellite]=useState(true);
 const load=async()=>{try{
  const sources=await api.referenceSources();
  if(!sources.length)throw new Error('Real-world reference source is unavailable');
  const item=sources[0];
  const [p,o]=await Promise.all([api.referenceLayer(item.id,'processed'),api.referenceLayer(item.id,'source')]);
  setSource(item);setProcessed(p);setOriginal(o);setError('');
 }catch(e){setError((e as Error).message);}};
 useEffect(()=>{void load();},[]);
 return <section className="real-world-workspace" aria-label="Real-world workspace">
 <div className="page-heading"><div><span className="eyebrow">REAL-WORLD DATASET</span><Heading>Lalpur, Ahmedabad, Gujarat</Heading><p>Real-world geospatial reference dataset</p></div><span className="tag">Read-only · Staged vector subset</span></div>
 <div className="notice">Cadastral truth, verified parcel correspondence and GNSS relationships are unavailable. This dataset is not a cadastral reconciliation benchmark.</div>
 {error&&<div className="error-banner" role="alert">{error}<button onClick={()=>void load()}>Retry reference data</button></div>}
 {!source&&!error&&<p role="status">Loading real-world reference data…</p>}
 {source&&<>
 <div className="source-grid reference-cards">
 <article className="source-card"><h2>Orthophoto / imagery source</h2><p>Real source in ProjectVaayu</p><p>{source.imagery_status}</p><small>ECW · EPSG:3857 · No imagery preview or live inference</small></article>
 <article className="source-card"><h2>Building footprints</h2><p>{source.feature_count} real annotation polygons staged from {source.available_lalpur_buildings} Lalpur records.</p><p>Original vector coordinates retained. Normalized and validated by Bhumi-Setu.</p><small>Available locally · No model predictions</small></article>
 <article className="source-card"><h2>Roads</h2><p>{source.roads_status}</p><small>Layer unavailable in this demo</small></article>
 </div>
 <div className={`gis-layout ${selected?'has-evidence':''}`}><section className="map-panel">
 <div className="map-toolbar"><b>Real-world layers</b><label><input type="checkbox" checked={satellite} onChange={()=>setSatellite(!satellite)}/>Satellite basemap</label>
 <label><input type="checkbox" checked={visible.buildings} onChange={e=>setVisible({...visible,buildings:e.target.checked})}/>Building footprints — processed</label>
 <label><input type="checkbox" checked={visible.original} onChange={e=>setVisible({...visible,original:e.target.checked})}/>Original source outlines</label>
 <label><input type="checkbox" checked={false} disabled readOnly/>Roads — not staged</label>
 <label><input type="checkbox" checked={false} disabled readOnly/>Cadastral — unavailable</label>
 <label><input type="checkbox" checked={false} disabled readOnly/>GNSS — unavailable</label>
 </div>
 <div className="workspace-map"><MapView layers={{cadastral:empty,buildings:empty,gnss:empty}} results={noResults}
 visible={visible} satellite={satellite} selected={null} onSelect={()=>{}}
 reference={{processed,original,selected,onSelect:setSelected,location:source.location}}/>
 <div className="map-caption">LALPUR · REAL-WORLD REFERENCE <span>EPSG:4326 display</span></div></div>
 <div className="map-bottom"><span>Select a building for source provenance. Blue: processed · Orange dashed: original.</span></div>
 </section>
 {selected&&<aside className="evidence" aria-label="Real building provenance"><div className="section-top"><h2>{String(selected.properties?.source_feature_id)}</h2><button className="icon-button" aria-label="Close real building provenance" onClick={()=>setSelected(null)}>×</button></div>
 <FootprintProvenance properties={selected.properties} referenceSource={source}/>
 <h3>Geometry processing</h3><p>{selected.properties?.quality?.original_valid?'Valid source geometry':'Source geometry required repair'} → {selected.properties?.quality?.repaired?'Repaired':'Validated'} → EPSG:32643 analysis → EPSG:4326 display.</p>
 </aside>}
 </div>
 <section className="panel"><h2>Original source → processed vector layer</h2><p>The orange outline comes directly from the original vector coordinates, reprojected for display. The blue footprint passes through metric normalization and geometry validation. Valid geometry can look identical: this is not a before/after segmentation result.</p><p>Before/after orthophoto imagery is unavailable. No image has been fabricated.</p>
 <div className="record-list">{processed.features.map(f=><button key={String(f.properties?.footprint_id)} onClick={()=>setSelected(f)}><b>Building {String(f.properties?.source_feature_id)}</b><small>View real source provenance</small></button>)}</div></section>
 <section className="panel reference-provenance"><h2>Dataset provenance</h2><p>{source.annotation_origin}</p><p>{source.selection}</p><p>Reference commit: <code>{source.repository_commit}</code></p><p>Source file: <code>{source.source_file}</code></p><p>SHA-256: <code>{source.source_file_sha256}</code></p><p>{source.license_status}</p></section>
 </>}
 </section>;
}
