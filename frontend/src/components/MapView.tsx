import {useEffect,useMemo,useState} from 'react';
import {MapContainer,TileLayer,GeoJSON,Marker,useMap} from 'react-leaflet';
import L from 'leaflet';
import type {Layers,Results,ResultFeature} from '../types';
import type {Feature,FeatureCollection} from 'geojson';
import 'leaflet/dist/leaflet.css';
import {STUDY_AREA} from '../config/studyArea';

const colors={matched:'#16845B',needs_review:'#C48616',conflict:'#C44747'};

function Bounds({data,selected}:{data:FeatureCollection;selected:Feature|null}){
 const map=useMap();
 useEffect(()=>{
  const bounds=L.geoJSON(selected||data).getBounds();
  if(bounds.isValid()){
   map.fitBounds(bounds,{padding:selected?[65,65]:[28,28],maxZoom:selected?19:17,animate:false});
  }
 },[map,data,selected]);
 useEffect(()=>{
  const observer=new ResizeObserver(()=>map.invalidateSize());
  observer.observe(map.getContainer());
  return()=>observer.disconnect();
 },[map]);
 return null;
}

/** Return the geographic centroid of any GeoJSON Feature geometry */
function getFeatureCentroid(feature: Feature): L.LatLng | null {
 try {
  const layer = L.geoJSON(feature);
  const bounds = layer.getBounds();
  if (bounds.isValid()) return bounds.getCenter();
 } catch { /* ignore */ }
 return null;
}

/**
 * Build a layered SVG divIcon for the selected-parcel X/cross marker.
 * Visual stack (back → front):
 *   1. White outer stroke (halo) — provides contrast on any satellite imagery.
 *   2. Status-coloured inner stroke — communicates conflict/review/match semantics.
 *   3. Small filled circle at the crossing-point anchor.
 * Sizes are fixed in screen pixels so the marker stays readable at all zoom levels.
 */
function makeConflictIcon(statusColor: string): L.DivIcon {
 const size = 44; // total icon canvas (px)
 const half = size / 2;
 const arm = 13; // half-length of each arm from centre
 const outerW = 7; // white halo stroke-width
 const innerW = 3.5; // status-colour stroke-width
 const dotR = 3.5; // centre anchor dot radius

 // Line endpoints for the two diagonals of the X
 const x1a = half - arm; const y1a = half - arm;
 const x1b = half + arm; const y1b = half + arm;
 const x2a = half + arm; const y2a = half - arm;
 const x2b = half - arm; const y2b = half + arm;

 const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Selected parcel marker">
  <!-- white halo behind each arm -->
  <line x1="${x1a}" y1="${y1a}" x2="${x1b}" y2="${y1b}" stroke="white" stroke-width="${outerW}" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="${x2a}" y1="${y2a}" x2="${x2b}" y2="${y2b}" stroke="white" stroke-width="${outerW}" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- white halo behind centre dot -->
  <circle cx="${half}" cy="${half}" r="${dotR + 2}" fill="white"/>
  <!-- status-coloured inner arms -->
  <line x1="${x1a}" y1="${y1a}" x2="${x1b}" y2="${y1b}" stroke="${statusColor}" stroke-width="${innerW}" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="${x2a}" y1="${y2a}" x2="${x2b}" y2="${y2b}" stroke="${statusColor}" stroke-width="${innerW}" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- status-coloured centre anchor dot -->
  <circle cx="${half}" cy="${half}" r="${dotR}" fill="${statusColor}"/>
</svg>`;

 return L.divIcon({
  html: svg,
  className: 'conflict-marker-icon',
  iconSize: [size, size],
  iconAnchor: [half, half],
  popupAnchor: [0, -half],
 });
}

export default function MapView({layers,results,visible,onSelect,selected,basemap=false,satellite=true,reference}:{layers:Layers;results:Results;visible:Record<string,boolean>;onSelect:(f:ResultFeature)=>void;selected:ResultFeature|null;basemap?:boolean;satellite?:boolean;reference?:{processed:FeatureCollection;original:FeatureCollection;selected:Feature|null;onSelect:(f:Feature)=>void;location:string}}){
 const [tileError,setTileError]=useState(false);
 useEffect(()=>setTileError(false),[basemap,satellite]);
 const bounds=useMemo(()=>reference?.processed||layers.cadastral,[layers.cadastral,reference?.processed]);

 // Derive centroid and status colour for the selected-parcel X marker
 const selectedMarker = useMemo(()=>{
  if(!selected) return null;
  const centroid = getFeatureCentroid(selected);
  if(!centroid) return null;
  const status = selected.properties.status;
  const color = colors[status] || '#C48616';
  return {centroid, icon: makeConflictIcon(color)};
 }, [selected]);

 // A single-feature FeatureCollection for the selected-parcel halo layer
 const selectedHaloData = useMemo(()=>{
  if(!selected) return null;
  return {type:'FeatureCollection' as const, features:[selected]};
 }, [selected]);

 return <MapContainer center={reference?[23.04,72.756]:[STUDY_AREA.center_lat,STUDY_AREA.center_lng]} zoom={STUDY_AREA.default_zoom} scrollWheelZoom={false} className="leaflet-map" aria-label={reference?`${reference.location} reference map`:`${STUDY_AREA.name} map`}>
  {satellite&&<TileLayer attribution='Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community' url="https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={19} eventHandlers={{tileerror:()=>setTileError(true)}}/>}
  {basemap&&!satellite&&<TileLayer attribution='&copy; OpenStreetMap contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19}/>}
  {tileError&&<div className="basemap-message" role="status">Satellite imagery unavailable. Source vectors remain visible.</div>}
  <Bounds data={bounds} selected={reference?.selected||selected}/>
  {reference?<>{visible.buildings&&<GeoJSON data={reference.processed} style={{color:'#1973d2',weight:1.8,fillOpacity:.12}} onEachFeature={(f,layer)=>layer.on('click',()=>reference.onSelect(f))}/>}
  {visible.original&&<GeoJSON data={reference.original} style={{color:'#bd7626',weight:1.5,dashArray:'5 4',fillOpacity:0}} onEachFeature={(f,layer)=>layer.on('click',()=>reference.onSelect(f))}/>}</>:<>
  {/* Cadastral Layer: thin neutral/institutional parcel boundary with 0 fill */}
  {visible.cadastral&&<GeoJSON data={layers.cadastral} style={{color:'#7A8B88',weight:1,dashArray:'4 3',fillOpacity:0,opacity:.8}}/>}
  {/* Buildings Layer: thin 1.5px footprint outline with subtle transparent fill */}
  {visible.buildings&&<GeoJSON key={layers.buildingSourceId} data={layers.buildings} style={{color:'#007C83',weight:1.5,fillColor:'#007C83',fillOpacity:.04,opacity:.85}}/>}
  {/* AI-derived drone footprints */}
  {visible.droneBuildings&&layers.droneBuildings&&<GeoJSON key={`drone-${layers.buildingSourceId}`} data={layers.droneBuildings} style={{color:'#0e948e',weight:1.5,fillColor:'#007C83',fillOpacity:.06,opacity:.9}}/>}
  {/* GNSS Layer: small 3.5px point observation markers */}
  {visible.gnss&&<GeoJSON data={layers.gnss} pointToLayer={(_,latlng)=>L.circleMarker(latlng,{radius:3.5,color:'#00383B',fillColor:'#007C83',weight:1.5,fillOpacity:.95})}/>}
  {/* Results Layer: restrained 1.5px status boundary, subtle 0.04 tint, prominent selected highlight */}
  {visible.results&&results.features.length>0&&<GeoJSON key={`${results.run_id}-${selected?.properties.parcel_id||''}-${results.features.map(f=>f.properties.parcel_id+f.properties.decision_status).join(',')}`} data={results} style={f=>{const isSel=f?.properties.parcel_id===selected?.properties.parcel_id;const status=(f as ResultFeature).properties.status;const c=colors[status]||'#C48616';return{color:isSel?'#004F52':c,weight:isSel?4:1.5,fillColor:isSel?'#007C83':c,fillOpacity:isSel?.15:(f?.properties.decision_status==='resolved'?.02:.04),dashArray:f?.properties.decision_status==='resolved'?'4 3':undefined,opacity:isSel?1:.85};}} onEachFeature={(f,layer)=>{layer.on('click',()=>onSelect(f as ResultFeature));layer.on('add',()=>{const el=(layer as L.Path).getElement();if(el){el.setAttribute('role','button');el.setAttribute('tabindex','0');el.setAttribute('aria-label',`Parcel ${f.properties.parcel_id}, ${f.properties.status.replace('_',' ')}`);el.addEventListener('keydown',event=>{const key=(event as KeyboardEvent).key;if(key==='Enter'||key===' '){event.preventDefault();onSelect(f as ResultFeature);}});}});const label=document.createElement('span');label.textContent=`${f.properties.parcel_id} · ${f.properties.confidence}%`;layer.bindTooltip(label);}}/>}
  {/* Selected parcel halo: wider semi-transparent white/light ring rendered BEHIND the marker
      to provide contrast against both dark vegetation and bright rooftops */}
  {visible.results&&selectedHaloData&&<GeoJSON
   key={`halo-${selected?.properties.parcel_id||'none'}`}
   data={selectedHaloData}
   style={{
    color:'rgba(255,255,255,0.55)',
    weight:9,
    fillOpacity:0,
    opacity:1,
    lineCap:'round',
    lineJoin:'round',
   }}
   interactive={false}
  />}
  {/* X/cross marker: SVG divIcon at parcel centroid, layered white halo + status colour */}
  {visible.results&&selectedMarker&&<Marker
   position={selectedMarker.centroid}
   icon={selectedMarker.icon}
   interactive={false}
   aria-hidden={true}
  />}
  </>}
 </MapContainer>;
}
