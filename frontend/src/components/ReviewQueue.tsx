import {useEffect,useMemo,useRef,useState} from 'react';
import {RefreshCw,ShieldCheck,LoaderCircle,ArrowRight} from 'lucide-react';
import {Link} from 'react-router-dom';
import type {ReviewCase,Layers,Results,AuditEvent} from '../types';
import {api} from '../services/api';
import MapView from './MapView';
import ReviewEvidenceStory from './ReviewEvidenceStory';

export default function ReviewQueue({runId,layers,embedded=false,onDecision}:{runId:string|null;layers?:Layers|null;embedded?:boolean;onDecision?:()=>void}){
 const [cases,setCases]=useState<ReviewCase[]>([]),[selected,setSelected]=useState<ReviewCase|null>(null),[filter,setFilter]=useState('pending');
 const [reviewer,setReviewer]=useState(''),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [events,setEvents]=useState<AuditEvent[]>([]),[auditError,setAuditError]=useState('');
 const generation=useRef(0);
 const load=async()=>{const token=++generation.current;if(!runId){setCases([]);setSelected(null);return;}setLoading(true);try{const response=await api.reviewCases(runId);if(token!==generation.current)return;setCases(response.cases);setSelected(old=>old?response.cases.find(c=>c.id===old.id)||null:null);setError('');}catch(e){if(token===generation.current)setError((e as Error).message);}finally{if(token===generation.current)setLoading(false);}};
 useEffect(()=>{setCases([]);setSelected(null);setMessage('');setNote('');void load();return()=>{generation.current++;};},[runId]);
 useEffect(()=>{let active=true;setEvents([]);setAuditError('');if(selected?.run_id===runId)api.audit(runId||undefined,selected.record_id).then(r=>{if(active)setEvents(r.events);}).catch(e=>{if(active)setAuditError(e.message);});return()=>{active=false;};},[runId,selected?.id,selected?.version]);
 const visible=useMemo(()=>cases.filter(c=>c.run_id===runId&&(filter==='all'||c.status===filter)),[cases,runId,filter]);
 const current=selected?.run_id===runId?selected:null;
 const choose=(item:ReviewCase)=>{if(busy)return;setSelected(item);setNote('');setMessage('');setError('');};
 const mapCases=useMemo(()=>current&&!visible.some(c=>c.id===current.id)?[...visible,current]:visible,[current,visible]);
 const mapResults=useMemo<Results>(()=>({type:'FeatureCollection',run_id:runId,summary:null,features:mapCases.map(c=>({...c.feature,properties:{...c.feature.properties,decision_status:c.status}}))}),[mapCases,runId]);
 const selectedFeature=current?mapResults.features.find(f=>f.properties.parcel_id===current.record_id)||null:null;
 const submit=async(decision:'accept'|'reject'|'investigate')=>{if(!current||busy)return;if(!reviewer.trim()){setError('Enter a reviewer identifier before saving.');return;}const token=generation.current;setBusy(true);setError('');setMessage('');try{const updated=await api.decide(current.id,{decision,reviewer:reviewer.trim(),note:note||null,expected_version:current.version});if(token!==generation.current)return;setCases(all=>all.map(c=>c.id===updated.id?updated:c));setSelected(updated);setMessage('Decision persisted to the backend and added to the audit trail.');setNote('');onDecision?.();}catch(e){if(token===generation.current)setError((e as Error).message);}finally{setBusy(false);}};
 return <div className={`review-experience ${embedded?'embedded-review':''}`} aria-label="Human review workspace">
  <div className="section-top"><div><span className="eyebrow">HUMAN-IN-THE-LOOP</span><h2>Review queue</h2><p>Choose a parcel on the map. Inspect the evidence, then record a decision.</p></div><button className="secondary" disabled={busy||loading} onClick={()=>void load()} aria-label="Refresh review queue"><RefreshCw size={15}/>Refresh</button></div>
  {!runId?<p className="empty-review">Run harmonization to create review cases.</p>:<>
  <div className="review-filters">{['pending','investigating','resolved','all'].map(s=><button key={s} aria-pressed={filter===s} className={filter===s?'active':''} disabled={busy} onClick={()=>setFilter(s)}>{s==='all'?'All':s} <b>{s==='all'?cases.length:cases.filter(c=>c.status===s).length}</b></button>)}</div>
  {loading&&<p role="status">Loading persisted cases...</p>}
  <div className="review-layout map-review-layout"><section className="review-map-column">
   {layers&&<div className="review-map" aria-label="Review parcels map"><MapView layers={layers} results={mapResults} selected={selectedFeature} visible={{cadastral:true,buildings:true,gnss:true,results:true,droneBuildings:true}} onSelect={f=>{const c=mapCases.find(item=>item.record_id===f.properties.parcel_id);if(c)choose(c);}}/></div>}
   <p className="review-map-caption">Synthetic benchmark / satellite context. Amber: needs review; red: conflict; cyan: selected. Dashed outline: decision recorded. Decision state does not alter the original evidence score.</p>
   <div className="case-list" aria-label="Review case selection">{visible.map(c=><button disabled={busy} className={`case-row ${current?.id===c.id?'selected':''}`} key={c.id} onClick={()=>choose(c)}><span><b>{c.record_id}</b><small>{c.feature.properties.matched_footprint_id||'No candidate'} / {c.feature.properties.confidence}% confidence</small></span><span className={`status ${c.feature.properties.status}`}>{c.status==='resolved'?c.decision:c.status}</span></button>)}{!loading&&!visible.length&&<p className="empty-review">No cases in this view.</p>}</div>
  </section>
  <section className="panel review-detail" aria-label="Review evidence story">{current?<>
   <div className="section-top"><div><span className="eyebrow">REVIEW CASE</span><h2>{current.record_id}</h2><p>Survey {String(current.feature.properties.cadastral.survey_no||'not supplied')}</p></div><span className={`status ${current.feature.properties.status}`}>{current.status==='resolved'?current.decision:current.status}</span></div>
   <p className="review-original-status">Proposal: {current.feature.properties.status.replace('_',' ')} / Review: {current.status}</p><ReviewEvidenceStory item={current}/>
   <div className="review-form"><h3>Human decision</h3><label>Reviewer identifier<input maxLength={120} value={reviewer} onChange={e=>setReviewer(e.target.value)} placeholder="e.g. officer-01" disabled={busy}/></label><label>Note or reason<textarea maxLength={2000} value={note} onChange={e=>setNote(e.target.value)} placeholder="Optional context for the decision" disabled={busy}/></label><div className="decision-actions">{(['accept','reject','investigate'] as const).map(decision=><button key={decision} className={`decision ${decision}`} disabled={busy||current.status==='resolved'} onClick={()=>void submit(decision)}>{decision[0].toUpperCase()+decision.slice(1)}</button>)}{busy&&<LoaderCircle className="spin" size={18}/>}</div></div>
   {message&&<div className="decision-confirmation" role="status"><b>Decision recorded</b><p>{message}</p></div>}
   {current.decision&&<div className="persisted-note"><ShieldCheck size={16}/><span><b>{current.decision}</b> by {current.reviewer} on {current.decided_at?new Date(current.decided_at).toLocaleString():''}{current.note&&<small>{current.note}</small>}</span></div>}
   {events[0]&&<div className="decision-receipt"><h3>Latest audit event</h3><dl><dt>Reviewer</dt><dd>{events[0].actor}</dd><dt>Timestamp</dt><dd>{new Date(events[0].timestamp).toLocaleString()}</dd><dt>Previous status</dt><dd>{String(events[0].before.status??'Not supplied')}</dd><dt>New status</dt><dd>{String(events[0].after.status??'Not supplied')}</dd><dt>Reviewer note</dt><dd>{String(events[0].after.note??'No note supplied')}</dd></dl></div>}
   {auditError&&<p role="alert">Audit retrieval failed: {auditError}. Use the audit section to retry.</p>}
   {embedded?<a className="continue-review" href="#audit-trail">View audit trail <ArrowRight size={16}/></a>:<Link className="continue-review" to="/audit">View audit trail <ArrowRight size={16}/></Link>}
  </>:<div className="empty-review"><ShieldCheck size={28}/><h2>Select a case</h2><p>Click a review parcel or choose a case below the map.</p></div>}
  {error&&<div className="warning-text form-message" role="alert">{error}<p>If another reviewer changed the case, refresh the review queue and inspect its latest version before deciding again.</p></div>}
  </section></div></>}
 </div>;
}
