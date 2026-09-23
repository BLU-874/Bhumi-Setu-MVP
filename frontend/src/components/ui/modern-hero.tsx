import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {Link} from 'react-router-dom';
import {ArrowDown,ArrowUpRight,Plus} from 'lucide-react';
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

function HeroGeospatialTexture({progress,reduced}:{progress:MotionValue<number>;reduced:boolean}){
  const opacity=useTransform(progress,[.18,.45,.75,.96],[0,.42,.75,.55]);
  const scale=useTransform(progress,[.18,.9],[1.03,1]);
  return <motion.div className="cinematic-geospatial-texture" aria-hidden="true" style={reduced?{opacity:.3,transform:'none'}:{opacity,scale}}>
    <svg className="geospatial-texture-svg" viewBox="0 0 1920 1080" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id="survey-grid-ticks" width="240" height="240" patternUnits="userSpaceOnUse">
          <path d="M 120 114 L 120 126 M 114 120 L 126 120" stroke="rgba(136, 199, 215, 0.28)" strokeWidth="0.8"/>
        </pattern>
      </defs>
      <rect width="1920" height="1080" fill="url(#survey-grid-ticks)"/>
      <g className="texture-contours" stroke="rgba(136, 199, 215, 0.22)" strokeWidth="0.9" fill="none">
        <path d="M -80 260 C 240 210 460 330 760 250 C 1060 170 1340 300 1640 230 C 1820 190 2000 240 2080 210"/>
        <text x="320" y="248" fill="rgba(136, 199, 215, 0.35)" fontSize="9" fontFamily="monospace" letterSpacing="0.5">570 m</text>
        <text x="1460" y="248" fill="rgba(136, 199, 215, 0.35)" fontSize="9" fontFamily="monospace" letterSpacing="0.5">570 m</text>
        <path d="M -80 370 C 220 310 480 430 780 350 C 1080 280 1320 400 1620 330 C 1820 290 2000 350 2080 310"/>
        <text x="640" y="360" fill="rgba(136, 199, 215, 0.35)" fontSize="9" fontFamily="monospace" letterSpacing="0.5">580 m</text>
        <path d="M -80 490 C 260 430 520 540 820 470 C 1110 400 1360 520 1660 440 C 1860 400 2020 460 2080 420" strokeWidth="1.3" stroke="rgba(136, 199, 215, 0.30)"/>
        <text x="420" y="475" fill="rgba(136, 199, 215, 0.42)" fontSize="9.5" fontFamily="monospace" fontWeight="600" letterSpacing="0.5">590 m [INDEX]</text>
        <text x="1260" y="435" fill="rgba(136, 199, 215, 0.42)" fontSize="9.5" fontFamily="monospace" fontWeight="600" letterSpacing="0.5">590 m</text>
        <path d="M -80 610 C 280 550 500 660 800 590 C 1100 520 1380 640 1680 560 C 1880 510 2020 580 2080 540"/>
        <text x="960" y="555" fill="rgba(136, 199, 215, 0.35)" fontSize="9" fontFamily="monospace" letterSpacing="0.5">600 m</text>
        <path d="M -80 730 C 240 670 520 780 820 710 C 1130 640 1350 750 1660 680 C 1850 630 2010 700 2080 650"/>
        <text x="520" y="725" fill="rgba(136, 199, 215, 0.35)" fontSize="9" fontFamily="monospace" letterSpacing="0.5">610 m</text>
      </g>
      <g className="texture-cadastral" fill="none">
        <polygon points="140,160 380,140 420,340 200,370" stroke="rgba(140, 205, 195, 0.24)" strokeWidth="1" strokeDasharray="5,4"/>
        <rect x="138" y="158" width="4" height="4" fill="rgba(140, 205, 195, 0.45)"/>
        <rect x="378" y="138" width="4" height="4" fill="rgba(140, 205, 195, 0.45)"/>
        <rect x="418" y="338" width="4" height="4" fill="rgba(140, 205, 195, 0.45)"/>
        <rect x="198" y="368" width="4" height="4" fill="rgba(140, 205, 195, 0.45)"/>
        <text x="210" y="250" fill="rgba(140, 205, 195, 0.35)" fontSize="9" fontFamily="monospace">PARCEL 104-A</text>
        <line x1="420" y1="340" x2="560" y2="420" stroke="rgba(140, 205, 195, 0.25)" strokeWidth="0.9" strokeDasharray="3,3"/>
        <circle cx="560" cy="420" r="3" fill="none" stroke="rgba(140, 205, 195, 0.5)" strokeWidth="1"/>
        <text x="495" y="375" fill="rgba(180, 220, 215, 0.35)" fontSize="8" fontFamily="monospace">AZ: 52°14' · 148.5m</text>
        <polygon points="1520,130 1810,110 1850,330 1570,350" stroke="rgba(140, 205, 195, 0.24)" strokeWidth="1" strokeDasharray="5,4"/>
        <text x="1620" y="230" fill="rgba(140, 205, 195, 0.35)" fontSize="9" fontFamily="monospace">PARCEL 108-C</text>
        <polygon points="210,690 470,670 440,880 190,890" stroke="rgba(140, 205, 195, 0.24)" strokeWidth="1" strokeDasharray="5,4"/>
        <text x="280" y="780" fill="rgba(140, 205, 195, 0.35)" fontSize="9" fontFamily="monospace">PARCEL 112-F</text>
        <polygon points="1490,640 1780,620 1820,840 1530,860" stroke="rgba(140, 205, 195, 0.24)" strokeWidth="1" strokeDasharray="5,4"/>
        <text x="1590" y="750" fill="rgba(140, 205, 195, 0.35)" fontSize="9" fontFamily="monospace">PARCEL 115-B</text>
      </g>
      <g className="texture-benchmarks" stroke="rgba(180, 220, 215, 0.3)" strokeWidth="0.8" fill="none">
        <polygon points="960,180 970,198 950,198" fill="none" stroke="rgba(180, 220, 215, 0.45)" strokeWidth="1"/>
        <circle cx="960" cy="192" r="1.5" fill="rgba(180, 220, 215, 0.6)"/>
        <text x="978" y="195" fill="rgba(180, 220, 215, 0.4)" fontSize="8.5" fontFamily="monospace">BM-264 · EL: 592.14m</text>
        <text x="960" y="1040" textAnchor="middle" fill="rgba(180, 220, 215, 0.35)" fontSize="9" fontFamily="monospace" letterSpacing="1">
          WGS 84 / UTM ZONE 43N (EPSG:32643) · CADASTRAL HARMONIZATION REFERENCE FRAME
        </text>
      </g>
      <g className="texture-neatline" stroke="rgba(180, 220, 215, 0.25)" strokeWidth="0.8">
        <line x1="40" y1="20" x2="40" y2="1060"/>
        <line x1="1880" y1="20" x2="1880" y2="1060"/>
        <line x1="40" y1="20" x2="1880" y2="20"/>
        <line x1="40" y1="1060" x2="1880" y2="1060"/>
        <path d="M 32 20 L 48 20 M 40 12 L 40 28"/>
        <path d="M 1872 20 L 1888 20 M 1880 12 L 1880 28"/>
        <path d="M 32 1060 L 48 1060 M 40 1052 L 40 1068"/>
        <path d="M 1872 1060 L 1888 1060 M 1880 1052 L 1880 1068"/>
      </g>
    </svg>
  </motion.div>;
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
  const imageOpacity=useTransform(progress,[0,.48,.82,.95],[1,1,.35,0]);
  const introOpacity=useTransform(progress,[0,.07,.23],[1,1,0]);
  const introY=useTransform(progress,[0,.23],[0,-70]);
  const introVisibility=useTransform(progress,value=>value>.24?'hidden':'visible');
  const contextOpacity=useTransform(progress,[0,.15,.46,.66],[0,1,1,0]);

  // Payoff and logo emergence transforms
  const payoffOpacity=useTransform(progress,[.58,.76,.9],[0,.65,1]);
  const payoffY=useTransform(progress,[.58,.9],[40,0]);
  const payoffVisibility=useTransform(progress,value=>value<.56?'hidden':'visible');

  // Logo scales up significantly (~2.6x: 0.38 -> 1.0) to become the visual identity of the hero
  const logoOpacity=useTransform(progress,[.58,.74,.88],[0,.7,1]);
  const logoScale=useTransform(progress,[.58,.75,.92],[.38,.68,1]);
  const logoY=useTransform(progress,[.58,.9],[25,0]);

  // Payoff headline and actions resolve right beneath the prominent logo
  const payoffContentOpacity=useTransform(progress,[.78,.9],[0,1]);
  const payoffContentY=useTransform(progress,[.78,.92],[28,0]);

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
        <HeroGeospatialTexture progress={progress} reduced={reduced}/>
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
          <motion.div className="converging-sources" style={reduced?undefined:{opacity:payoffContentOpacity}}><span>CADASTRAL</span><Plus size={12}/><span>DRONE AI</span><Plus size={12}/><span>GNSS</span></motion.div>
          <motion.div className="hero-resolving-brand" style={reduced?{opacity:1,transform:'none'}:{opacity:logoOpacity,scale:logoScale,y:logoY}}>
            <img src="/images/bhumi-setu-logo-light.svg" alt="Bhumi-Setu" className="hero-resolving-logo-img" loading="eager" decoding="async"/>
          </motion.div>
          <motion.div className="payoff-content-group" style={reduced?undefined:{opacity:payoffContentOpacity,y:payoffContentY}}>
            <h2>One trusted<br/><em>picture.</em></h2>
            <p>Machine learning ranks. Evidence explains.<br/>People make the decision.</p>
            <Link to="/map" className="cinematic-button">Explore Workspace <ArrowUpRight size={18}/></Link>
          </motion.div>
        </motion.div>
        <motion.div className="cinematic-scroll-cue" style={reduced?undefined:{opacity:introOpacity,visibility:introVisibility}}><span>SCROLL TO BRING IT TOGETHER</span><ArrowDown size={16}/></motion.div>
        <motion.div className="cinematic-progress" style={{scaleX:reduced?0:progress}} aria-hidden="true"/>
      </div>
    </section>
    <ImageCredits/>
  </>;
}
