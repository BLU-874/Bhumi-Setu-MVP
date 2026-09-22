import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {Link} from 'react-router-dom';
import {ArrowDown,ArrowUpRight,Layers3,Plus} from 'lucide-react';
import {motion,useMotionTemplate,useScroll,useTransform,type MotionValue} from 'framer-motion';
import {HERO_IMAGES,type HeroImage} from './hero-images';
import './modern-hero.css';

function useReducedMotionPreference(){
  const [reduced,setReduced]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(()=>{
    const query=window.matchMedia('(prefers-reduced-motion: reduce)');
    const update=()=>setReduced(query.matches);
    update();
    query.addEventListener('change',update);
    return()=>query.removeEventListener('change',update);
  },[]);
  return reduced;
}

type ParallaxImgProps = {
  image: HeroImage;
  className: string;
  progress: MotionValue<number>;
  start: number;
  end: number;
  enter: number;
  converge: number;
  reduced: boolean;
  number: string;
};

function ParallaxImg({image,className,progress,start,end,enter,converge,reduced,number}:ParallaxImgProps){
  const y=useTransform(progress,[enter,.76],[start,end]);
  const x=useTransform(progress,[.73,.88],[0,converge]);
  const scale=useTransform(progress,[enter,Math.max(enter+.085,.53),.87],[1.04,1,.88]);
  const opacity=useTransform(progress,[enter,enter+.085,.75,.88],[0,1,1,0]);
  const visibility=useTransform(progress,value=>value<enter||value>.9?'hidden':'visible');
  const transform=useMotionTemplate`translate3d(calc(${x}px * var(--parallax-factor)), calc(${y}px * var(--parallax-factor)), 0) scale(${scale})`;
  const [failed,setFailed]=useState(false);
  return <motion.figure className={`scroll-source ${className}`} style={reduced?{transform:'none',opacity:1,visibility:'visible'}:{transform,opacity,visibility}}>
    <div className="scroll-source-image">{failed?<div className="hero-image-fallback">{image.label} image unavailable</div>:<img src={image.src} alt={image.alt} loading="lazy" decoding="async" style={{objectPosition:image.position}} onError={()=>setFailed(true)}/>}</div>
    <figcaption><span className="scroll-source-number">{number}</span><div><h2>{image.label}</h2><p>{image.descriptor}</p><small>{image.context}</small></div></figcaption>
  </motion.figure>;
}

function ImageCredits(){
  return <details className="hero-image-credits"><summary>About the temporary imagery</summary>
    <p>Source images illustrate different kinds of geospatial evidence and are not corresponding datasets or verified land records. The reconciliation image is an actual Bhumi-Setu synthetic benchmark capture; its scores describe demonstration evidence, not measured production accuracy.</p>
    <ul>{Object.entries(HERO_IMAGES).map(([key,image])=><li key={key}><a href={image.sourceUrl} target="_blank" rel="noreferrer">{image.label} <ArrowUpRight size={12}/></a><span>{image.credit} · <a href={image.licenseUrl} target="_blank" rel="noreferrer">{image.license}</a>. Display crops may vary by viewport.</span></li>)}</ul>
  </details>;
}

export function SmoothScrollHero(){
  const ref=useRef<HTMLElement>(null);
  const reduced=useReducedMotionPreference();
  const {scrollYProgress}=useScroll({target:ref,offset:['start start','end end']});
  // Keep clip-path, background sizing and opacity on the same normalized JS
  // timeline. Native ViewTimeline acceleration uses different cover ranges.
  const progress=useTransform(scrollYProgress,value=>value);
  const clip1=useTransform(progress,[0,.43],[25,0]);
  const clip2=useTransform(progress,[0,.43],[75,100]);
  const clipPath=useMotionTemplate`polygon(${clip1}% ${clip1}%, ${clip2}% ${clip1}%, ${clip2}% ${clip2}%, ${clip1}% ${clip2}%)`;
  const zoom=useTransform(progress,[0,.66],[1.18,1]);
  const backgroundSize=useMotionTemplate`calc(var(--center-cover-width) * ${zoom}) auto`;
  const scale=useTransform(progress,[0,.66],[1.04,1]);
  const imageOpacity=useTransform(progress,[0,.48,.8],[1,1,0]);
  const introOpacity=useTransform(progress,[0,.07,.23],[1,1,0]);
  const introY=useTransform(progress,[0,.23],[0,-70]);
  const introVisibility=useTransform(progress,value=>value>.24?'hidden':'visible');
  const contextOpacity=useTransform(progress,[0,.15,.46,.66],[0,1,1,0]);
  const payoffOpacity=useTransform(progress,[.78,.9],[0,1]);
  const payoffY=useTransform(progress,[.78,.92],[45,0]);
  const payoffVisibility=useTransform(progress,value=>value<.78?'hidden':'visible');
  const [centerFailed,setCenterFailed]=useState(false);
  const [centerRatio,setCenterRatio]=useState(16/11);
  // Preload only the center. The four supporting images use native lazy loading.
  useEffect(()=>{const img=new Image();img.onerror=()=>setCenterFailed(true);img.onload=()=>setCenterRatio(img.naturalWidth/img.naturalHeight);img.src=HERO_IMAGES.center.src;return()=>{img.onerror=null;img.onload=null;};},[]);
  return <>
    <section ref={ref} className={`cinematic-hero${reduced?' is-reduced':''}`} aria-labelledby="cinematic-title" style={{'--center-cover-width':`max(100vw, ${100*centerRatio}svh)`} as CSSProperties}>
      <div id="hero-story" className="hero-story-anchor"/>
      <div className="cinematic-stage">
        <motion.div className="cinematic-center" role="img" aria-label={HERO_IMAGES.center.alt}
          style={{backgroundImage:centerFailed?'none':`url(${HERO_IMAGES.center.src})`,backgroundPosition:HERO_IMAGES.center.position,
            clipPath:reduced?'none':clipPath,backgroundSize:reduced?'cover':backgroundSize,scale:reduced?1:scale,opacity:reduced?1:imageOpacity}}>
          {centerFailed&&<div className="hero-image-fallback">Satellite image unavailable. Explore the workspace to inspect project data.</div>}
        </motion.div>
        <div className="cinematic-shade"/>
        <motion.div className="cinematic-intro" style={reduced?{opacity:1,y:0,visibility:'visible'}:{opacity:introOpacity,y:introY,visibility:introVisibility}}>
          <p className="cinematic-eyebrow">INTELLIGENT GEOSPATIAL RECONCILIATION</p>
          <h1 id="cinematic-title">One parcel.<br/><span>Three realities.</span></h1>
          <p className="cinematic-support">Turn fragmented land data<br/>into one trusted picture.</p>
          <p className="cinematic-description">Bhumi-Setu reconciles cadastral, drone-derived and GNSS geospatial data using machine learning, spatial evidence and human review.</p>
          <div className="cinematic-actions"><Link to="/map" className="cinematic-button">Explore Workspace <ArrowUpRight size={18}/></Link><a href="#hero-story">See How It Works <ArrowDown size={16}/></a></div>
        </motion.div>
        <motion.div className="cinematic-location" style={reduced?undefined:{opacity:contextOpacity}}><span>01 / A WIDER PERSPECTIVE</span><p>Different sources.<br/>The same questions.</p></motion.div>
        <div className="cinematic-sources" aria-label="Geospatial source story">
          <ParallaxImg image={HERO_IMAGES.cadastral} className="source-cadastral" progress={progress} enter={.25} start={160} end={-45} converge={180} reduced={reduced} number="01"/>
          <ParallaxImg image={HERO_IMAGES.drone} className="source-drone" progress={progress} enter={.35} start={240} end={-30} converge={-180} reduced={reduced} number="02"/>
          <ParallaxImg image={HERO_IMAGES.gnss} className="source-gnss" progress={progress} enter={.46} start={140} end={-35} converge={60} reduced={reduced} number="03"/>
          <ParallaxImg image={HERO_IMAGES.reconciliation} className="source-reconciliation" progress={progress} enter={.56} start={200} end={-20} converge={-100} reduced={reduced} number="04"/>
        </div>
        <motion.div className="cinematic-payoff" style={reduced?{opacity:1,y:0,visibility:'visible'}:{opacity:payoffOpacity,y:payoffY,visibility:payoffVisibility}}>
          <div className="converging-sources"><span>CADASTRAL</span><Plus size={12}/><span>DRONE AI</span><Plus size={12}/><span>GNSS</span></div>
          <div className="payoff-brand"><Layers3 size={23}/><span>BHUMI-SETU</span></div>
          <h2>One trusted<br/><em>picture.</em></h2>
          <p>Machine learning ranks. Evidence explains.<br/>People make the decision.</p>
          <Link to="/map" className="cinematic-button">Explore Workspace <ArrowUpRight size={18}/></Link>
        </motion.div>
        <motion.div className="cinematic-scroll-cue" style={reduced?undefined:{opacity:introOpacity,visibility:introVisibility}}><span>SCROLL TO BRING IT TOGETHER</span><ArrowDown size={16}/></motion.div>
        <motion.div className="cinematic-progress" style={{scaleX:reduced?0:progress}} aria-hidden="true"/>
      </div>
    </section>
    <ImageCredits/>
  </>;
}
