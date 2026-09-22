import {useEffect,useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import WorkspaceModes from '../components/WorkspaceModes';
import ReferenceWorkspace from '../components/ReferenceWorkspace';
import {SlidersHorizontal,MousePointer2} from 'lucide-react';
import type {Layers,Results,ResultFeature} from '../types';
import MapView from '../components/MapView';
import EvidencePanel from '../components/EvidencePanel';
import RunControl,{type RunControls} from '../components/RunControl';
function SyntheticWorkspace({layers,results,embedded=false,controls}:{layers:Layers|null;results:Results;embedded?:boolean;controls?:RunControls}){
 const [visible,setVisible]=useState({cadastral:true,buildings:true,gnss:true,results:true,droneBuildings:true});
 const [selected,setSelected]=useState<ResultFeature|null>(null);
 const [fullEvidence,setFullEvidence]=useState(!embedded);
 const select=(feature:ResultFeature)=>{setSelected(feature);setFullEvidence(!embedded);};
 const [filter,setFilter]=useState('all');const [basemap,setBasemap]=useState(false);const [satellite,setSatellite]=useState(true);
 const Heading=embedded?'h2':'h1';
 useEffect(()=>{setSelected(null);setFullEvidence(!embedded);setFilter('all');},[embedded,results.run_id]);
 const filtered={...results,features:results.features.filter(f=>filter==='all'||f.properties.status===filter)};
 return <>{controls&&<RunControl controls={controls} results={results} embedded={embedded}/>}<div className="page-heading compact"><div><span className="eyebrow">SPATIAL WORKSPACE</span><Heading>See the evidence on the ground.</Heading><p>Synthetic Pune study area · Select a result parcel to inspect its match.</p></div><label className="select-label">Result filter<select value={filter} onChange={e=>{setFilter(e.target.value);setSelected(null);}}><option value="all">All results</option><option value="matched">Matched</option><option value="needs_review">Needs review</option><option value="conflict">Conflict</option></select></label></div>
 <div className={`gis-layout ${selected?'has-evidence':''}`}><section className="map-panel"><div className="map-toolbar"><span><SlidersHorizontal size={15}/> Layers</span>{Object.entries(visible).filter(([k])=>k!=='droneBuildings'||layers?.droneBuildings).map(([k,v])=><label key={k}><input type="checkbox" checked={v} onChange={()=>setVisible({...visible,[k]:!v})}/>{k==='droneBuildings'?'AI-derived drone buildings':k==='results'?'Results':k==='gnss'?'GNSS':k[0].toUpperCase()+k.slice(1)}</label>)}<label><input type="checkbox" checked={satellite} onChange={()=>{setSatellite(!satellite);setBasemap(false);}}/>Satellite basemap</label><label><input type="checkbox" checked={basemap} onChange={()=>{setBasemap(!basemap);setSatellite(false);}}/>Street basemap</label></div><div className="workspace-map">{layers?<MapView layers={layers} results={filtered} visible={visible} onSelect={select} selected={selected} basemap={basemap} satellite={satellite}/>:<div className="empty">Loading map layers…</div>}<div className="map-caption">SYNTHETIC OVERLAYS / NOT OFFICIAL BOUNDARIES <span>WGS84 · EPSG:4326</span></div></div><div className="map-bottom"><span><MousePointer2 size={14}/> {results.features.length?'Click a colored parcel for evidence':'Run harmonization to see scored proposals'}</span><div className="legend"><span className="matched">Matched</span><span className="needs_review">Review</span><span className="conflict">Conflict</span></div></div></section>{selected&&(fullEvidence?<EvidencePanel feature={selected} onClose={()=>setSelected(null)}/>:<aside className="evidence result-preview" aria-label="Parcel preview"><span className="eyebrow">SELECTED PARCEL</span><h2>{selected.properties.parcel_id}</h2><span className={`status ${selected.properties.status}`}>{selected.properties.status.replace('_',' ')}</span><dl><dt>Deterministic confidence</dt><dd>{selected.properties.confidence} / 100</dd><dt>ML rank</dt><dd>{selected.properties.ml_rank??'Not available'}</dd><dt>GNSS status</dt><dd>{selected.properties.gnss_verified?'Contained observation':'No contained observation'}</dd></dl><button className="primary" onClick={()=>setFullEvidence(true)}>View evidence</button><button className="secondary" onClick={()=>setSelected(null)}>Clear selection</button></aside>)}</div>
 <div className="planned-map-layers">{['Municipal GIS','Utilities','Drone / ORI imagery'].map(label=><label key={label}><input type="checkbox" disabled/>{label} · Planned</label>)}</div>
 {!selected&&results.features.length>0&&<section className="panel"><div className="section-top"><h2>Inspect a record</h2><span className="muted">{filtered.features.length} results in current filter</span></div><div className="record-list">{filtered.features.slice(0,20).map(f=><button onClick={()=>select(f)} key={f.properties.parcel_id}><b>{f.properties.parcel_id}</b><span className={`status ${f.properties.status}`}>{f.properties.confidence}%</span><small>{f.properties.validation_flags[0]||'No validation flags'}</small></button>)}</div></section>}</>;
}

export default function Workspace(props:{layers:Layers|null;results:Results;embedded?:boolean;controls?:RunControls;storyMode?:boolean}){
 const [params,setParams]=useSearchParams();
 const real=params.get('mode')==='real_world_reference';
 return <>{!props.storyMode&&<div className="workspace-introduction"><span className="eyebrow">EXPLORE THE WORKSPACE</span><p>Select your sources, run reconciliation, and inspect the evidence.</p></div>}<WorkspaceModes mode={real?'real_world_reference':'synthetic_benchmark'} onChange={mode=>setParams({mode})}/>
 <div hidden={real}><SyntheticWorkspace {...props}/></div>{real&&<ReferenceWorkspace embedded={props.embedded}/>}</>;
}
