import type {Health,Source,Run,Results,Layers,ReviewCase,AuditEvent,DatabaseStatus} from '../types';
const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/,'');
async function json<T>(path:string,options:RequestInit={}):Promise<T>{
  const response=await fetch(`${BASE}${path}`,{...options,headers:{'Content-Type':'application/json',...options.headers}});
  if(!response.ok){const body=await response.json().catch(()=>null);throw new Error(typeof body?.detail==='string'?body.detail:`Request failed (${response.status})`);}
  return response.json();
}
export const api={
  health:()=>json<Health & DatabaseStatus>('/api/health'),verify:()=>json<DatabaseStatus>('/api/database/verify'),sources:()=>json<Source[]>('/api/sources'),runs:()=>json<Run[]>('/api/runs'),
  results:()=>json<Results>('/api/results'),run:()=>json<Run>('/api/runs',{method:'POST',body:'{}'}),
  reviewCases:(runId?:string)=>json<{cases:ReviewCase[];total:number;run_id:string|null}>(`/api/review-cases${runId?`?run_id=${encodeURIComponent(runId)}`:''}`),
  decide:(id:string,body:{decision:'accept'|'reject'|'investigate';reviewer:string;note?:string|null;expected_version:number})=>json<ReviewCase>(`/api/review-cases/${id}`,{method:'PATCH',body:JSON.stringify(body)}),
  audit:(runId?:string,recordId?:string)=>json<{events:AuditEvent[];total:number}>(`/api/audit?${new URLSearchParams({...runId?{run_id:runId}:{},...recordId?{record_id:recordId}:{}})}`),
  layers:async():Promise<Layers>=>{const [cadastral,buildings,gnss]=await Promise.all(['cadastral','buildings','gnss'].map(k=>json<Layers['cadastral']>(`/api/layers/${k}`)));return {cadastral,buildings,gnss};}
};
