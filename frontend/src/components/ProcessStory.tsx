import {useEffect,useRef,useState} from 'react';
import {motion,useScroll,useTransform,useMotionValueEvent} from 'framer-motion';
const stages=[['INGEST','Cadastral, drone-derived and GNSS sources'],['NORMALIZE','Coordinate systems, schemas and geometry are standardized'],['MATCH','Spatial and attribute evidence generate candidate matches'],['RANK','ML ranks candidates; deterministic evidence quantifies confidence'],['REVIEW','Uncertain or conflicting records are escalated to a human']];
export default function ProcessStory(){
 const ref=useRef<HTMLElement>(null);
 const [reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
 useEffect(()=>{const query=matchMedia('(prefers-reduced-motion: reduce)');const change=()=>setReduced(query.matches);query.addEventListener('change',change);return()=>query.removeEventListener('change',change);},[]);
 const {scrollYProgress}=useScroll({target:ref,offset:['start 85%','end 45%']});
 const progress=useTransform(scrollYProgress,v=>v);
 const [active,setActive]=useState(0);
 useMotionValueEvent(progress,'change',v=>setActive(Math.min(4,Math.floor(v*5))));
 return <section ref={ref} id="how-it-works" className="landing-section workflow-section process-story" aria-label="How Bhumi-Setu works">
  <div className="landing-container"><div className="wide-section-heading"><div><p className="landing-eyebrow">02 / HOW IT WORKS</p><h2>From sources to evidence.<br/>From evidence to a decision.</h2></div><p>Data → Processing → Evidence → Human review</p></div>
  <div className="process-stages"><div className="process-track-mobile" aria-hidden="true"><motion.div style={{scaleY:reduced?1:progress}}/></div><div className="process-track" aria-hidden="true"><motion.div style={{scaleX:reduced?1:progress}}/></div>
  <ol className="landing-pipeline">{stages.map(([name,detail],i)=><li key={name} className={reduced||i<active?'complete':i===active?'current':'upcoming'} aria-current={!reduced&&i===active?'step':undefined}><span className="pipeline-number">{String(i+1).padStart(2,'0')}</span><h3>{name}</h3><p>{detail}</p></li>)}</ol></div>
  <p className="process-footnote">A guide to the workflow. Run harmonization below to process the actual selected sources.</p></div>
 </section>;
}
