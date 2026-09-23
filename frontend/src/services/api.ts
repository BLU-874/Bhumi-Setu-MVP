import type {Health,Source,Run,Results,Layers,ReviewCase,AuditEvent,DatabaseStatus,ReferenceSource} from '../types';
const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/,'');
async function json<T>(path:string,options:RequestInit={}):Promise<T>{
  const response=await fetch(`${BASE}${path}`,{...options,headers:{'Content-Type':'application/json',...options.headers}});
  if(!response.ok){const body=await response.json().catch(()=>null);throw new Error(typeof body?.detail==='string'?body.detail:`Request failed (${response.status})`);}
  return response.json();
}
export const api={
  referenceSources:()=>json<ReferenceSource[]>('/api/sources?dataset_type=real_world_reference'),
  referenceLayer:(id:string,representation:'source'|'processed')=>json<Layers['buildings']>(`/api/layers/buildings?${new URLSearchParams({source_id:id,representation})}`),
  health:()=>json<Health & DatabaseStatus>('/api/health'),verify:()=>json<DatabaseStatus>('/api/database/verify'),sources:()=>json<Source[]>('/api/sources'),runs:()=>json<Run[]>('/api/runs'),
  results:(runId?:string)=>json<Results>(`/api/results${runId?`?run_id=${encodeURIComponent(runId)}`:''}`),run:(buildings='buildings')=>json<Run>('/api/runs',{method:'POST',body:JSON.stringify({buildings})}),
  reviewCases:(runId?:string)=>json<{cases:ReviewCase[];total:number;run_id:string|null}>(`/api/review-cases${runId?`?run_id=${encodeURIComponent(runId)}`:''}`),
  decide:(id:string,body:{decision:'accept'|'reject'|'investigate';reviewer:string;note?:string|null;expected_version:number})=>json<ReviewCase>(`/api/review-cases/${id}`,{method:'PATCH',body:JSON.stringify(body)}),
  audit:(runId?:string,recordId?:string)=>json<{events:AuditEvent[];total:number}>(`/api/audit?${new URLSearchParams({...runId?{run_id:runId}:{},...recordId?{record_id:recordId}:{}})}`),
  logAuditEvent:(body:{run_id:string;record_id:string;actor?:string;action:string;metadata?:Record<string,unknown>})=>json<{status:string;action:string;timestamp:string}>('/api/audit-events',{method:'POST',body:JSON.stringify(body)}),
  importStaged:async()=>{const response=await fetch('/fixtures/staged-drone.geojson');if(!response.ok)throw new Error('Staged fixture unavailable');const collection=await response.json();return json<Source>('/api/sources',{method:'POST',body:JSON.stringify({name:collection.name,kind:'buildings',source_crs:collection.source_crs,source_type:'ai_derived_drone_footprint',collection})});},
  layers:async(buildingSourceId='buildings'):Promise<Layers>=>{const [cadastral,buildings,gnss]=await Promise.all(['cadastral','buildings','gnss'].map(k=>json<Layers['cadastral']>(`/api/layers/${k}`)));let droneBuildings:Layers['buildings']|undefined;try{const all=await json<Source[]>('/api/sources');const drone=all.find(s=>s.source_type==='ai_derived_drone_footprint');if(drone)droneBuildings=await json<Layers['buildings']>(`/api/layers/buildings?source_id=${encodeURIComponent(drone.id)}`);}catch{}if(buildingSourceId==='buildings')return {cadastral,buildings,gnss,droneBuildings,buildingSourceId};const selected=await json<Layers['buildings']>(`/api/layers/buildings?source_id=${encodeURIComponent(buildingSourceId)}`);return selected.features[0]?.properties?.source_type==='ai_derived_drone_footprint'?{cadastral,buildings,gnss,droneBuildings:selected,buildingSourceId}:{cadastral,buildings:selected,gnss,droneBuildings,buildingSourceId};}
};
