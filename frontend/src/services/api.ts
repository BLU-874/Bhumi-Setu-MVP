import type {Health,Source,Run,Results,Layers,ReviewCase,AuditEvent,DatabaseStatus,ReferenceSource} from '../types';
export type LayerName = 'cadastral' | 'buildings' | 'gnss' | 'droneBuildings';
export type LoadState = { status: 'loading' | 'loaded' | 'empty' | 'error'; message?: string };
export type WorkspaceLoadState = Record<LayerName | 'results' | 'sources' | 'runs' | 'health', LoadState>;
type LayerSelection = { buildingSourceId: string; sources: Source[] };
const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/,'');
async function json<T>(path:string,options:RequestInit={}):Promise<T>{
  const headers = new Headers(options.headers);
  if(options.body != null && !headers.has('Content-Type')) headers.set('Content-Type','application/json');
  const response=await fetch(`${BASE}${path}`,{...options,headers});
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
  layers:(selection: Promise<LayerSelection>)=>{
    // Share requests only within this load; nothing is cached across loads.
    const requests = new Map<string, Promise<Layers['cadastral']>>();
    const request = (kind: 'cadastral' | 'buildings' | 'gnss', id = kind as string) => {
      const path = `/api/layers/${kind}${id === kind ? '' : `?source_id=${encodeURIComponent(id)}`}`;
      let pending = requests.get(path);
      if (!pending) {
        pending = json<Layers['cadastral']>(path);
        requests.set(path, pending);
        // A request may finish before source selection. Its consumer still receives errors.
        void pending.catch(() => {});
      }
      return pending;
    };
    const cadastral = request('cadastral');
    const benchmark = request('buildings');
    const gnss = request('gnss');
    const selected = selection.then(({buildingSourceId,sources}) => ({
      buildingSourceId,
      sources,
      isDrone: sources.find(s => s.id === buildingSourceId)?.source_type === 'ai_derived_drone_footprint'
    }));
    return {
      cadastral,
      gnss,
      buildings: selected.then(({buildingSourceId,isDrone}) =>
        buildingSourceId === 'buildings' || isDrone ? benchmark : request('buildings',buildingSourceId)),
      droneBuildings: selected.then(({buildingSourceId,sources,isDrone}) => {
        const droneId = isDrone ? buildingSourceId : sources.find(s => s.source_type === 'ai_derived_drone_footprint')?.id;
        return droneId ? request('buildings',droneId) : undefined;
      })
    };
  }
};
