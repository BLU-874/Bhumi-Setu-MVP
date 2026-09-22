import {useEffect,useState} from 'react';
import {ArrowRight,Check,LoaderCircle} from 'lucide-react';
import {Link} from 'react-router-dom';
import type {Results,Run,Source} from '../types';
export type RunControls={sources:Source[];buildingSource:string;setBuildingSource:(id:string)=>void;running:boolean;run:Run|null;onRun:()=>Promise<void>;error:string};
const stages=['Normalizing sources','Generating candidates','Matching geometry','Comparing attributes','ML ranking','Detecting conflicts'];
export default function RunControl({controls,results,embedded=false}:{controls:RunControls;results:Results;embedded?:boolean}){
 const {sources,buildingSource,setBuildingSource,running,run,onRun,error}=controls;
 const [stage,setStage]=useState(0);
 useEffect(()=>{setStage(0);if(!running)return;const id=setInterval(()=>setStage(i=>Math.min(i+1,stages.length-1)),900);return()=>clearInterval(id);},[running]);
 const summary=results.summary;
 const built=sources.find(s=>s.id===buildingSource);
 const canRun=!!built&&sources.some(s=>s.id==='cadastral')&&sources.some(s=>s.id==='gnss');
 return <section className="run-control" aria-label="Harmonization controls">
  <div className="run-source-row"><div><span className="eyebrow">SOURCE SELECTION</span><div className="source-checks">{[['cadastral','Cadastral'],[buildingSource,'Building / drone-derived footprints'],['gnss','GNSS observations']].map(([id,label])=><span key={id}>{sources.some(s=>s.id===id)?<Check size={14}/>:null}{label}{!sources.some(s=>s.id===id)&&' — unavailable'}</span>)}</div><p>Controlled synthetic sources. Layer visibility changes the display, not the run inputs.</p></div>
   <details className="run-source-picker"><summary>Choose building source</summary><label>Reconciliation building source<select value={buildingSource} disabled={running} onChange={e=>setBuildingSource(e.target.value)}>{sources.filter(s=>s.kind==='buildings').map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><Link to="/data-sources">Manage sources / import staged fixture</Link></details>
   <button className="primary run-primary" disabled={running||!canRun} onClick={()=>void onRun()}>{running?<LoaderCircle className="spin" size={17}/>:<ArrowRight size={17}/>}Run harmonization</button>
  </div><p className="source-run-note">Next run: {built?.name||'Sources unavailable'}{run?.source_ids?.buildings&&run.source_ids.buildings!==buildingSource?' · Map shows the previous run until the selected source is processed.':''}</p>
  {running&&<div className="run-progress" role="status"><b>Processing selected sources</b><p>Workflow illustration · waiting for the backend to confirm completion.</p><ol>{stages.map((name,i)=><li key={name} className={i===stage?'active':''}>{i===stage?<LoaderCircle size={13} className="spin"/>:<span className="progress-dot"/>}{name}</li>)}</ol>{results.run_id&&<small>Previous saved results remain visible while the new run processes.</small>}</div>}
  {!running&&error&&<p className="warning-text" role="alert">{error} · Completion is not confirmed. Retry when the backend is available.</p>}
  {!running&&summary&&<div className="run-results" aria-label="Harmonization results"><div><span className="eyebrow">{error?'LAST SAVED RESULTS':'HARMONIZATION COMPLETE'}</span><small>Saved run {results.run_id?.slice(0,8)}</small></div>{(['matched','needs_review','conflict'] as const).map(key=><div key={key} data-status={key}><strong>{summary[key]}</strong><span>{key==='needs_review'?'Needs review':key==='conflict'?'Conflicts':'Matched'}</span></div>)}{embedded?<a className="continue-review" href="#human-review">Continue to review <ArrowRight size={16}/></a>:<Link className="continue-review" to="/review">Continue to review <ArrowRight size={16}/></Link>}</div>}
  {!running&&run&&<details className="confirmed-stages"><summary>Backend-confirmed processing</summary><ul>{run.stages.map(s=><li key={s.name}>{s.name} <b>{s.status}</b></li>)}</ul><p>{results.features.some(f=>f.properties.model_available)?'ML ranking is available in this run; inspect each candidate for its returned rank and probability.':'ML ranking is unavailable in these results; deterministic evidence remains available.'}</p></details>}
 </section>;
}
