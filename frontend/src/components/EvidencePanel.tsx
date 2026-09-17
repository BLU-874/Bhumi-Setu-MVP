import {X,MapPin,ShieldCheck,AlertTriangle} from 'lucide-react';
import type {ResultFeature} from '../types';
const text=(v:unknown)=>v===null||v===undefined||v===''?'Not supplied':String(v);
export default function EvidencePanel({feature,onClose}:{feature:ResultFeature;onClose:()=>void}){
 const p=feature.properties,e=p.confidence_explanation,g=p.geometry_quality;
 return <aside className="evidence" aria-label="Parcel evidence"><div className="section-top"><div><span className="eyebrow">RECORD EVIDENCE</span><h2>{p.parcel_id}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close evidence"><X size={19}/></button></div>
 <div className="evidence-score"><span className={`status ${p.status}`}>{p.status.replace('_',' ')}</span><strong>{p.confidence}<small>/ 100</small></strong><span>Evidence score · not measured accuracy</span></div>
 <p className="muted">{text(p.cadastral.survey_no)} · Candidate {p.matched_footprint_id||'not found'}</p>
 <h3><MapPin size={15}/> Spatial evidence</h3><div className="evidence-row"><span>Intersection over union</span><b>{p.geometry_overlap_pct}%</b></div><div className="meter"><i style={{width:`${p.geometry_overlap_pct}%`}}/></div>
 <h3>Attribute evidence</h3>{Object.entries(p.attribute_evidence).map(([k,v])=><div className="attribute-row" key={k}><div><b>{k.replace('_',' ')}</b><strong>{v.available?`${v.similarity_pct}%`:'Limited evidence'}</strong></div><small>{text(v.source)} <span>→</span> {text(v.candidate)}</small></div>)}
 <h3><ShieldCheck size={15}/> GNSS observation</h3><p>{p.gnss_verified?`Contained point: ${p.gnss_point_id}`:'No contained observation. No score penalty.'}</p>{p.validation.gnss_related_survey_matches===false&&<p className="warning-text">Survey identifier disagrees. The preserved containment boost still applies; review is required.</p>}
 <h3>Geometry validation</h3><div className="geometry-trail"><span>{g.original_valid?'Valid source':'Invalid source'}</span><span>→</span><span>{g.repaired?'Repaired':'Checked'}</span><span>→</span><b>{g.result_valid?'Valid':'Invalid'}</b></div>
 <h3>Confidence calculation</h3><div className="calculation"><div><span>Geometry × 65%</span><b>+{e.geometry_contribution}</b></div><div><span>Attributes × 35%</span><b>+{e.attribute_contribution}</b></div><div><span>GNSS containment</span><b>+{e.gnss_boost}</b></div><div className="total"><span>Final confidence</span><b>{e.final_confidence}</b></div></div>
 <h3><AlertTriangle size={15}/> Validation flags</h3>{p.validation_flags.length?<ul className="flags">{p.validation_flags.map(f=><li key={f}>{f}</li>)}</ul>:<p className="success-text">No validation flags detected.</p>}
 <div className="review-note"><b>{p.recommendation}</b><p>{p.review_required?'This proposal requires human review.':'High-confidence proposal; no legal decision has been made.'} Review actions and decision persistence arrive in Phase 4.</p></div></aside>
}
