import {useEffect,useMemo,useState} from 'react';
import {MapContainer,TileLayer,GeoJSON,useMap} from 'react-leaflet';
import L from 'leaflet';
import type {Layers,Results,ResultFeature} from '../types';
import type {Feature,FeatureCollection} from 'geojson';
import 'leaflet/dist/leaflet.css';

const colors={matched:'#13a469',needs_review:'#d69913',conflict:'#d65454'};
function Bounds({data,selected}:{data:FeatureCollection;selected:Feature|null}){
 const map=useMap();
 useEffect(()=>{const bounds=L.geoJSON(selected||data).getBounds();if(bounds.isValid())map.fitBounds(bounds,{padding:selected?[65,65]:[28,28],maxZoom:selected?19:17,animate:false});},[map,data,selected]);
 useEffect(()=>{const observer=new ResizeObserver(()=>map.invalidateSize());observer.observe(map.getContainer());return()=>observer.disconnect();},[map]);
 return null;
}
export default function MapView({layers,results,visible,onSelect,selected,basemap=false,satellite=true,reference}:{layers:Layers;results:Results;visible:Record<string,boolean>;onSelect:(f:ResultFeature)=>void;selected:ResultFeature|null;basemap?:boolean;satellite?:boolean;reference?:{processed:FeatureCollection;original:FeatureCollection;selected:Feature|null;onSelect:(f:Feature)=>void;location:string}}){
 const [tileError,setTileError]=useState(false);
 useEffect(()=>setTileError(false),[basemap,satellite]);
 const bounds=useMemo(()=>reference?.processed||layers.cadastral,[layers.cadastral,reference?.processed]);
 return <MapContainer center={reference?[23.04,72.756]:[18.5204,73.8567]} zoom={16} scrollWheelZoom={false} className="leaflet-map" aria-label={reference?`${reference.location} reference map`:'Pune synthetic study area map'}>
  {satellite&&<TileLayer attribution='Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community' url="https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={19} eventHandlers={{tileerror:()=>setTileError(true)}}/>}
  {basemap&&!satellite&&<TileLayer attribution='&copy; OpenStreetMap contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19}/>}
  {tileError&&<div className="basemap-message" role="status">Satellite imagery unavailable. Source vectors remain visible.</div>}
  <Bounds data={bounds} selected={reference?.selected||selected}/>
  {reference?<>{visible.buildings&&<GeoJSON data={reference.processed} style={{color:'#1973d2',weight:2,fillOpacity:.2}} onEachFeature={(f,layer)=>layer.on('click',()=>reference.onSelect(f))}/>}
  {visible.original&&<GeoJSON data={reference.original} style={{color:'#bd7626',weight:2,dashArray:'6 4',fillOpacity:0}} onEachFeature={(f,layer)=>layer.on('click',()=>reference.onSelect(f))}/>}</>:<>
  {visible.cadastral&&<GeoJSON data={layers.cadastral} style={{color:'#f2ca52',weight:1.5,fillOpacity:.03}}/>}
  {visible.buildings&&<GeoJSON key={layers.buildingSourceId} data={layers.buildings} style={{color:'#58cbe5',weight:1.5,fillOpacity:.1}}/>}
  {visible.droneBuildings&&layers.droneBuildings&&<GeoJSON key={`drone-${layers.buildingSourceId}`} data={layers.droneBuildings} style={{color:'#0e948e',weight:2,fillColor:'#2cc9b9',fillOpacity:.35}}/>}
  {visible.gnss&&<GeoJSON data={layers.gnss} pointToLayer={(_,latlng)=>L.circleMarker(latlng,{radius:3.5,color:'#f05b54',fillColor:'#f05b54',weight:1,fillOpacity:1})}/>}
  {visible.results&&results.features.length>0&&<GeoJSON key={`${results.run_id}-${selected?.properties.parcel_id||''}-${results.features.map(f=>f.properties.parcel_id+f.properties.decision_status).join(',')}`} data={results} style={f=>({color:f?.properties.parcel_id===selected?.properties.parcel_id?'#42d4ed':colors[(f as ResultFeature).properties.status],weight:f?.properties.parcel_id===selected?.properties.parcel_id?4:1.5,fillColor:colors[(f as ResultFeature).properties.status],fillOpacity:f?.properties.decision_status==='resolved'?.04:.12,dashArray:f?.properties.decision_status==='resolved'?'5 4':undefined})} onEachFeature={(f,layer)=>{layer.on('click',()=>onSelect(f as ResultFeature));layer.on('add',()=>{const el=(layer as L.Path).getElement();if(el){el.setAttribute('role','button');el.setAttribute('tabindex','0');el.setAttribute('aria-label',`Parcel ${f.properties.parcel_id}, ${f.properties.status.replace('_',' ')}`);el.addEventListener('keydown',event=>{const key=(event as KeyboardEvent).key;if(key==='Enter'||key===' '){event.preventDefault();onSelect(f as ResultFeature);}});}});const label=document.createElement('span');label.textContent=`${f.properties.parcel_id} · ${f.properties.confidence}%`;layer.bindTooltip(label);}}/>}
 </>}
 </MapContainer>;
}
