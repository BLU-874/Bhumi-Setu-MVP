import {useEffect,useMemo} from 'react';
import {MapContainer,TileLayer,GeoJSON,useMap} from 'react-leaflet';
import L from 'leaflet';
import type {Layers,Results,ResultFeature} from '../types';
import type {FeatureCollection} from 'geojson';
import 'leaflet/dist/leaflet.css';

const colors={matched:'#13a469',needs_review:'#d69913',conflict:'#d65454'};
function Bounds({data,selected}:{data:FeatureCollection;selected:ResultFeature|null}){
 const map=useMap();
 useEffect(()=>{const bounds=L.geoJSON(selected||data).getBounds();if(bounds.isValid())map.fitBounds(bounds,{padding:selected?[65,65]:[28,28],maxZoom:selected?19:17,animate:false});},[map,data,selected]);
 useEffect(()=>{const observer=new ResizeObserver(()=>map.invalidateSize());observer.observe(map.getContainer());return()=>observer.disconnect();},[map]);
 return null;
}
export default function MapView({layers,results,visible,onSelect,selected,basemap=false}:{layers:Layers;results:Results;visible:Record<string,boolean>;onSelect:(f:ResultFeature)=>void;selected:ResultFeature|null;basemap?:boolean}){
 const bounds=useMemo(()=>layers.cadastral,[layers.cadastral]);
 return <MapContainer center={[18.5204,73.8567]} zoom={16} scrollWheelZoom={false} className="leaflet-map" aria-label="Pune synthetic study area map">
  {basemap&&<TileLayer attribution='&copy; OpenStreetMap contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19}/>}
  <Bounds data={bounds} selected={selected}/>
  {visible.cadastral&&<GeoJSON data={layers.cadastral} style={{color:'#528fae',weight:1,fillOpacity:.07}}/>}
  {visible.buildings&&<GeoJSON data={layers.buildings} style={{color:'#657384',weight:1,dashArray:'3 3',fillOpacity:.13}}/>}
  {visible.gnss&&<GeoJSON data={layers.gnss} pointToLayer={(_,latlng)=>L.circleMarker(latlng,{radius:3,color:'#1973d2',weight:1,fillOpacity:1})}/>}
  {visible.results&&results.features.length>0&&<GeoJSON key={`${results.run_id}-${selected?.properties.parcel_id||''}`} data={results} style={f=>({color:colors[(f as ResultFeature).properties.status],weight:f?.properties.parcel_id===selected?.properties.parcel_id?4:1.5,fillColor:colors[(f as ResultFeature).properties.status],fillOpacity:.38})} onEachFeature={(f,layer)=>{layer.on('click',()=>onSelect(f as ResultFeature));const label=document.createElement('span');label.textContent=`${f.properties.parcel_id} · ${f.properties.confidence}%`;layer.bindTooltip(label);}}/>}
 </MapContainer>;
}
