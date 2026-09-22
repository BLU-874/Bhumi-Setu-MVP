import type {ReferenceSource} from '../types';
const text=(value:unknown)=>value===null||value===undefined?'Not available':String(value);

export default function FootprintProvenance({properties,referenceSource}:{properties:Record<string,unknown>|null|undefined;referenceSource?:ReferenceSource}){
 if(referenceSource&&properties?.source_type==='real_world_orthophoto_building_data')return <section aria-label="Footprint provenance"><h3>Real source building annotation</h3>
 <p>{referenceSource.name}</p><p>{referenceSource.location}</p>
 {Object.entries({'Source type':referenceSource.source_type,'Representation':'Staged subset of original vector annotations','Source feature ID':properties.source_feature_id,'Source record number':properties.source_record_number,'Source CRS':referenceSource.source_crs,'Analysis CRS':referenceSource.analysis_crs,'Display CRS':referenceSource.display_crs,'Extraction model':properties.model_name,'Model version':properties.model_version,'Inference run':properties.inference_run_id,'Segmentation probability':properties.segmentation_probability}).map(([label,value])=><div className="evidence-row provenance-row" key={label}><span>{label}</span><b>{text(value)}</b></div>)}
 <p>No verified cadastral or GNSS relationship. ML match probability and reconciliation confidence are unavailable for this reference dataset.</p></section>;
 if(properties?.source_type!=='ai_derived_drone_footprint')return null;
 return <section aria-label="Footprint provenance"><h3>AI-derived drone footprint</h3>
 <p className="muted">{properties.demonstration?'Staged synthetic demonstration. No imagery inference was performed.':'Derived geometry is evidence for review.'} Not cadastral truth.</p>
 {(['footprint_id','model_name','model_version','model_artifact_sha256','inference_run_id','derived_from'] as const).map(key=><div className="evidence-row provenance-row" key={key}><span>{({footprint_id:'Footprint',model_name:'Extraction model',model_version:'Extraction model version',model_artifact_sha256:'Model artifact SHA-256',inference_run_id:'Inference run',derived_from:'Parent imagery / artifact'})[key]}</span><b>{text(properties[key])}</b></div>)}
 <div className="evidence-row"><span>Segmentation probability</span><b>{typeof properties.segmentation_probability==='number'?`${(properties.segmentation_probability*100).toFixed(1)}%`:'Not available'}</b></div>
 {properties.segmentation_probability!=null&&<p className="muted">Method: {text(properties.confidence_method)}. Segmentation probability is separate from ML match probability and deterministic confidence.</p>}
 </section>;
}
