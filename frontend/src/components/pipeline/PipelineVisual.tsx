import {useMemo} from 'react';
import {Link} from 'react-router-dom';
import {motion, AnimatePresence} from 'framer-motion';
import {
  Layers3,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileCheck2,
  ShieldCheck,
  History,
  Compass,
  ArrowRight,
  ArrowUpRight,
  Database,
  Crosshair,
  UserCheck,
  Check
} from 'lucide-react';
import type {Layers, Results} from '../../types';
import {HERO_IMAGES} from '../ui/hero-images';

interface PipelineVisualProps {
  activeStage: number;
  layers?: Layers | null;
  results?: Results;
  stageIndex?: number; // Optional override for mobile sequential rendering
}

export default function PipelineVisual({
  activeStage,
  layers,
  results,
  stageIndex,
}: PipelineVisualProps) {
  const currentStage = stageIndex !== undefined ? stageIndex : activeStage;

  // Extract real record if available for live data injection
  const realRecord = useMemo(() => {
    return results?.features?.find(f => f.properties?.matched_footprint_id)?.properties || results?.features?.[0]?.properties;
  }, [results]);

  const summary = results?.summary || {
    matched: 42,
    needs_review: 11,
    conflict: 3,
    total_parcels: 56,
  };

  return (
    <div className="pipeline-visual-canvas" role="region" aria-label="Pipeline stage visual">
      {/* Top Chrome Bar */}
      <div className="visual-chrome">
        <div className="visual-chrome-left">
          <span className="visual-chrome-dot" />
          <span>BHUMI-SETU ENGINE</span>
          <span style={{color: '#D5E1DF'}}>·</span>
          <span className="visual-chrome-mode">
            {currentStage === 0 && 'STAGE 01 — SOURCE INGEST'}
            {currentStage === 1 && 'STAGE 02 — CRS & SCHEMA NORMALIZATION'}
            {currentStage === 2 && 'STAGE 03 — SPATIAL RECONCILIATION'}
            {currentStage === 3 && 'STAGE 04 — EXPLAINABLE EVIDENCE'}
            {currentStage === 4 && 'STAGE 05 — TRIAGE RESULTS'}
            {currentStage === 5 && 'STAGE 06 — HUMAN ESCALATION'}
            {currentStage === 6 && 'STAGE 07 — OFFICER DECISION'}
            {currentStage === 7 && 'STAGE 08 — APPEND-ONLY AUDIT'}
            {currentStage === 8 && 'STAGE 09 — TRUSTED CADASTRE'}
          </span>
        </div>
        <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
          <span style={{color: '#718080'}}>WGS84 / UTM 43N</span>
          <Compass size={13} style={{color: '#007C83'}} />
        </div>
      </div>

      {/* Main Viewport */}
      <div className="visual-viewport-body">
        <AnimatePresence mode="wait">
          {currentStage === 0 && (
            <motion.div
              key="stage-01"
              className="visual-stage-container"
              initial={{opacity: 0, scale: 0.98}}
              animate={{opacity: 1, scale: 1}}
              exit={{opacity: 0, scale: 0.98}}
              transition={{duration: 0.35, ease: 'easeInOut'}}
            >
              <div className="v-sources-grid">
                <div className="v-source-card">
                  <div className="v-source-card-image">
                    <img src={HERO_IMAGES.cadastral.src} alt="Cadastral Map" />
                  </div>
                  <div className="v-source-card-meta">
                    <span className="cadastral">01 / CADASTRAL</span>
                    <h4>Legacy Land Records</h4>
                    <p>Scanned registry maps, survey boundaries, and municipal land revenue plots.</p>
                  </div>
                </div>

                <div className="v-source-card">
                  <div className="v-source-card-image">
                    <img src={HERO_IMAGES.drone.src} alt="High-resolution Drone Imagery" />
                  </div>
                  <div className="v-source-card-meta">
                    <span className="drone">02 / DRONE AI</span>
                    <h4>Observed Footprints</h4>
                    <p>Sub-decimeter orthophoto imagery with AI-extracted building rooftop footprints.</p>
                  </div>
                </div>

                <div className="v-source-card">
                  <div className="v-source-card-image">
                    <img src={HERO_IMAGES.gnss.src} alt="Terrestrial GNSS Survey" />
                  </div>
                  <div className="v-source-card-meta">
                    <span className="gnss">03 / GNSS</span>
                    <h4>Ground Truth Points</h4>
                    <p>Centimeter-grade RTK GNSS survey observations validating physical corner monuments.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {currentStage === 1 && (
            <motion.div
              key="stage-02"
              className="visual-stage-container"
              initial={{opacity: 0, scale: 0.98}}
              animate={{opacity: 1, scale: 1}}
              exit={{opacity: 0, scale: 0.98}}
              transition={{duration: 0.35, ease: 'easeInOut'}}
            >
              <div className="v-normalize-box">
                <div className="v-grid-canvas">
                  <span className="v-grid-axis-label" style={{top: 10, left: 12}}>Y: 2125400 N</span>
                  <span className="v-grid-axis-label" style={{bottom: 10, right: 12}}>X: 432100 E</span>
                  <svg width="100%" height="100%" style={{position: 'absolute', inset: 0}}>
                    <defs>
                      <pattern id="grid-pattern" width="30" height="30" patternUnits="userSpaceOnUse">
                        <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(213,225,223,0.7)" strokeWidth="1" />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid-pattern)" />
                    
                    {/* Unaligned legacy dashed boundary — Cadastral/Survey colour */}
                    <path
                      d="M 80 180 L 190 140 L 260 250 L 120 280 Z"
                      fill="rgba(164,124,82,0.06)"
                      stroke="#A47C52"
                      strokeWidth="1.5"
                      strokeDasharray="5,4"
                    />
                    <text x="75" y="160" fill="#718080" fontSize="10" fontFamily="monospace">Legacy Survey (EPSG:24378)</text>

                    {/* Transform arrow — institutional teal */}
                    <path
                      d="M 270 200 Q 320 180 370 190"
                      fill="none"
                      stroke="#007C83"
                      strokeWidth="1.5"
                    />
                    <polygon points="370,186 378,190 370,194" fill="#007C83" />

                    {/* Aligned normalized boundary — Government teal */}
                    <path
                      d="M 390 150 L 510 130 L 560 260 L 420 270 Z"
                      fill="rgba(0,124,131,0.07)"
                      stroke="#007C83"
                      strokeWidth="2"
                    />
                    <text x="390" y="118" fill="#005F63" fontSize="10" fontFamily="monospace">Normalized UTM 43N (WGS84)</text>

                    {/* Snapping nodes — Matched green */}
                    <circle cx="390" cy="150" r="4" fill="#16845B" />
                    <circle cx="510" cy="130" r="4" fill="#16845B" />
                    <circle cx="560" cy="260" r="4" fill="#16845B" />
                    <circle cx="420" cy="270" r="4" fill="#16845B" />
                  </svg>
                </div>

                <div className="v-normalize-pipelines">
                  <div className="v-norm-pill">
                    <b>CRS REPROJECTION</b>
                    <small>Auto-detects EPSG:24378 / EPSG:3857 and transforms to canonical UTM 43N.</small>
                  </div>
                  <div className="v-norm-pill">
                    <b>TOPOLOGY REPAIR</b>
                    <small>Corrects self-intersections, slivers, duplicate vertices, and winding order.</small>
                  </div>
                  <div className="v-norm-pill">
                    <b>SCHEMA HARMONIZATION</b>
                    <small>Standardizes land revenue codes, survey IDs, and GIS feature geometry.</small>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {currentStage === 2 && (
            <motion.div
              key="stage-03"
              className="visual-stage-container"
              initial={{opacity: 0, scale: 0.98}}
              animate={{opacity: 1, scale: 1}}
              exit={{opacity: 0, scale: 0.98}}
              transition={{duration: 0.35, ease: 'easeInOut'}}
            >
              <div className="v-reconcile-scene">
                <div className="v-spatial-overlay">
                  <svg width="100%" height="100%" viewBox="0 0 600 340" style={{maxHeight: '100%'}}>
                    {/* Cadastral Parcel Polygon — Institutional cadastral brown */}
                    <polygon
                      points="120,60 480,50 510,270 150,290"
                      fill="rgba(164,124,82,0.06)"
                      stroke="#A47C52"
                      strokeWidth="2"
                    />
                    <text x="130" y="78" fill="#8B6234" fontSize="11" fontFamily="monospace">Cadastral Parcel #104 (Survey No: 42/B)</text>

                    {/* Extracted Drone Footprint Polygon — Government teal */}
                    <polygon
                      points="210,95 410,85 430,225 230,235"
                      fill="rgba(0,124,131,0.10)"
                      stroke="#007C83"
                      strokeWidth="2"
                    />
                    <text x="220" y="113" fill="#005F63" fontSize="11" fontFamily="monospace">Drone AI Footprint #BLD-882</text>

                    {/* Spatial Intersection highlight — selection teal */}
                    <polygon
                      points="210,95 410,85 430,225 230,235"
                      fill="rgba(0,167,167,0.10)"
                      stroke="#00A7A7"
                      strokeWidth="1"
                      strokeDasharray="5,4"
                    />

                    {/* GNSS Ground Point Observation — GNSS dark teal */}
                    <circle cx="320" cy="160" r="28" fill="rgba(23,74,77,0.08)" stroke="#174A4D" strokeWidth="1.5" strokeDasharray="4,3" />
                    <circle cx="320" cy="160" r="5" fill="#174A4D" />
                    <circle cx="320" cy="160" r="2" fill="#F5F7F7" />
                    <text x="336" y="163" fill="#174A4D" fontSize="11" fontFamily="monospace">GNSS Monument PT-09 (±0.02m)</text>

                    {/* Calculation info panel — institutional white card */}
                    <g transform="translate(168, 268)">
                      <rect width="268" height="44" rx="4" fill="#FFFFFF" stroke="#D5E1DF" strokeWidth="1" />
                      <text x="14" y="18" fill="#718080" fontSize="9" fontFamily="monospace">CALCULATING INTERSECTION IoU</text>
                      <text x="14" y="33" fill="#172121" fontSize="11" fontFamily="monospace">Area Overlap: 86.4% · Centroid: 1.4m</text>
                    </g>
                  </svg>
                </div>

                <div className="v-reconcile-metric-bar">
                  <div className="v-metric-item">
                    <small>GEOMETRY WEIGHT</small>
                    <strong>65%</strong>
                  </div>
                  <div className="v-metric-item">
                    <small>ATTRIBUTE SIMILARITY</small>
                    <strong>35%</strong>
                  </div>
                  <div className="v-metric-item">
                    <small>GNSS CONTAINMENT</small>
                    <strong>+15 Boost</strong>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {currentStage === 3 && (
            <motion.div
              key="stage-04"
              className="visual-stage-container"
              initial={{opacity: 0, scale: 0.98}}
              animate={{opacity: 1, scale: 1}}
              exit={{opacity: 0, scale: 0.98}}
              transition={{duration: 0.35, ease: 'easeInOut'}}
            >
              <div className="v-evidence-card">
                <div className="v-evidence-header">
                  <div>
                    <span style={{marginRight: '8px'}}>PARCEL EVIDENCE</span>
                    <b>{realRecord ? `Record: ${realRecord.parcel_id}` : 'Record: parcel-104 (Synthetic Benchmark)'}</b>
                  </div>
                  <span>EXPLAINABLE PROPOSAL</span>
                </div>

                <div className="v-evidence-scores">
                  <div className="v-score-box">
                    <small>ML MATCH PROBABILITY</small>
                    <strong>
                      {realRecord?.ml_match_probability != null
                        ? `${(realRecord.ml_match_probability * 100).toFixed(1)}%`
                        : '92.4%'}
                    </strong>
                    <p>Supervised gradient ranking over geometric & spatial vector features.</p>
                  </div>

                  <div className="v-score-box">
                    <small>DETERMINISTIC CONFIDENCE</small>
                    <strong style={{color: '#007C83'}}>
                      {realRecord?.confidence != null ? `${realRecord.confidence} / 100` : '86 / 100'}
                    </strong>
                    <p>Weighted evidence: Geometry 65% + Attributes 35% with GNSS containment bonus.</p>
                  </div>
                </div>

                <div className="v-evidence-rows">
                  <div className="v-evidence-row">
                    <span>Geometry Overlap</span>
                    <b>{realRecord?.geometry_overlap_pct != null ? `${realRecord.geometry_overlap_pct}% IoU` : '87.4% IoU'}</b>
                  </div>
                  <div className="v-evidence-row">
                    <span>Attribute Similarity</span>
                    <b>{realRecord?.attribute_match_pct != null ? `${realRecord.attribute_match_pct}% matching` : '82.0% matching'}</b>
                  </div>
                  <div className="v-evidence-row">
                    <span>GNSS Physical Ground Observation</span>
                    <b style={{color: '#16845B'}}>
                      {realRecord ? (realRecord.gnss_verified ? 'Verified (Inside boundary)' : 'Not verified') : 'Verified (Inside boundary)'}
                    </b>
                  </div>
                  <div className="v-evidence-row">
                    <span>Validation Rule Flags</span>
                    <b>{realRecord ? `${realRecord.validation_flags.length} flags` : '0 flags (Valid topology)'}</b>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {currentStage === 4 && (
            <motion.div
              key="stage-05"
              className="visual-stage-container"
              initial={{opacity: 0, scale: 0.98}}
              animate={{opacity: 1, scale: 1}}
              exit={{opacity: 0, scale: 0.98}}
              transition={{duration: 0.35, ease: 'easeInOut'}}
            >
              <div className="v-results-container">
                <div className="v-outcome-cards">
                  <div className="v-outcome-card matched">
                    <div className="v-outcome-badge">
                      <CheckCircle2 size={12} /> MATCHED
                    </div>
                    <h3>{summary.matched}</h3>
                    <p>High confidence (&ge; 75%). Unambiguous boundary overlap & attribute agreement.</p>
                  </div>

                  <div className="v-outcome-card needs_review">
                    <div className="v-outcome-badge">
                      <AlertTriangle size={12} /> NEEDS REVIEW
                    </div>
                    <h3>{summary.needs_review}</h3>
                    <p>Borderline confidence (50–74%) or minor boundary offset. Sent to review queue.</p>
                  </div>

                  <div className="v-outcome-card conflict">
                    <div className="v-outcome-badge">
                      <XCircle size={12} /> CONFLICT
                    </div>
                    <h3>{summary.conflict}</h3>
                    <p>Contradictory records, multi-candidate overlap or owner name collision.</p>
                  </div>
                </div>

                <div className="v-results-map-preview">
                  <svg width="100%" height="100%" viewBox="0 0 600 240" style={{maxHeight: '100%'}}>
                    {/* Parcels classified by reconciliation status — institutional semantic colours */}
                    <polygon points="50,40 180,30 200,120 70,130" fill="rgba(22,132,91,0.10)" stroke="#16845B" strokeWidth="1.8" />
                    <text x="72" y="85" fill="#16845B" fontSize="10" fontFamily="monospace">MATCHED #101</text>

                    <polygon points="210,35 360,25 380,125 230,135" fill="rgba(196,134,22,0.10)" stroke="#C48616" strokeWidth="1.8" />
                    <text x="228" y="85" fill="#C48616" fontSize="10" fontFamily="monospace">NEEDS REVIEW #102</text>

                    <polygon points="390,30 540,40 520,130 370,120" fill="rgba(22,132,91,0.10)" stroke="#16845B" strokeWidth="1.8" />
                    <text x="405" y="85" fill="#16845B" fontSize="10" fontFamily="monospace">MATCHED #103</text>

                    <polygon points="60,145 200,140 190,225 50,230" fill="rgba(196,71,71,0.10)" stroke="#C44747" strokeWidth="1.8" />
                    <text x="70" y="190" fill="#C44747" fontSize="10" fontFamily="monospace">CONFLICT #104</text>

                    <polygon points="220,145 370,140 380,225 230,230" fill="rgba(22,132,91,0.10)" stroke="#16845B" strokeWidth="1.8" />
                    <text x="248" y="190" fill="#16845B" fontSize="10" fontFamily="monospace">MATCHED #105</text>

                    <polygon points="390,145 530,140 540,225 400,230" fill="rgba(196,134,22,0.10)" stroke="#C48616" strokeWidth="1.8" />
                    <text x="406" y="190" fill="#C48616" fontSize="10" fontFamily="monospace">NEEDS REVIEW #106</text>
                  </svg>
                </div>
              </div>
            </motion.div>
          )}

          {currentStage === 5 && (
            <motion.div
              key="stage-06"
              className="visual-stage-container"
              initial={{opacity: 0, scale: 0.98}}
              animate={{opacity: 1, scale: 1}}
              exit={{opacity: 0, scale: 0.98}}
              transition={{duration: 0.35, ease: 'easeInOut'}}
            >
              <div className="v-review-container">
                <div className="v-review-queue-header">
                  <span>ESCALATED CASSETTES (3 PENDING)</span>
                  <div style={{fontSize: '11px', color: '#90a89a'}}>Auto-routed to Officer Desk</div>
                </div>

                <div className="v-review-list">
                  <div className="v-review-item is-selected">
                    <div>
                      <div className="v-review-item-id">parcel-104 · Survey No. 42/B</div>
                      <div className="v-review-item-meta">Footprint: BLD-882 · 68% confidence · Multi-candidate footprint overlap</div>
                    </div>
                    <span className="v-badge-pill pending">Needs Review</span>
                  </div>

                  <div className="v-review-item">
                    <div>
                      <div className="v-review-item-id">parcel-109 · Survey No. 51</div>
                      <div className="v-review-item-meta">Footprint: BLD-903 · 52% confidence · Minor setback discrepancy</div>
                    </div>
                    <span className="v-badge-pill pending">Needs Review</span>
                  </div>

                  <div className="v-review-item">
                    <div>
                      <div className="v-review-item-id">parcel-112 · Survey No. 88</div>
                      <div className="v-review-item-meta">Footprint: None matched · 34% confidence · Boundary conflict</div>
                    </div>
                    <span className="v-badge-pill" style={{background: '#351815', color: '#e87b70', borderColor: '#732f29'}}>Conflict</span>
                  </div>
                </div>

                <div className="v-review-triage-options">
                  <div className="v-triage-btn accept">
                    <b>ACCEPT</b>
                    <small style={{display: 'block', fontSize: '9px', marginTop: '2px'}}>Confirm Proposal</small>
                  </div>
                  <div className="v-triage-btn reject">
                    <b>REJECT</b>
                    <small style={{display: 'block', fontSize: '9px', marginTop: '2px'}}>Discard Pairing</small>
                  </div>
                  <div className="v-triage-btn investigate">
                    <b>INVESTIGATE</b>
                    <small style={{display: 'block', fontSize: '9px', marginTop: '2px'}}>Request Field RTK</small>
                  </div>
                </div>

                <div className="v-review-footer-action">
                  <Link to="/review" className="v-open-review-btn">
                    Open Review Queue <ArrowUpRight size={13} />
                  </Link>
                </div>
              </div>
            </motion.div>
          )}

          {currentStage === 6 && (
            <motion.div
              key="stage-07"
              className="visual-stage-container"
              initial={{opacity: 0, scale: 0.98}}
              animate={{opacity: 1, scale: 1}}
              exit={{opacity: 0, scale: 0.98}}
              transition={{duration: 0.35, ease: 'easeInOut'}}
            >
              <div className="v-decision-box">
                <div className="v-decision-record-view">
                  <dl>
                    <div>
                      <dt>CASE RECORD</dt>
                      <dd>parcel-104 (Survey 42/B)</dd>
                    </div>
                    <div>
                      <dt>ASSIGNED OFFICER</dt>
                      <dd>officer-01 (Revenue Division)</dd>
                    </div>
                    <div>
                      <dt>PROPOSED FOOTPRINT</dt>
                      <dd>BLD-882 (IoU: 86.4%)</dd>
                    </div>
                    <div>
                      <dt>GNSS VERIFICATION</dt>
                      <dd>Point PT-09 Contained</dd>
                    </div>
                  </dl>
                </div>

                <div className="v-decision-status-change">
                  <span className="v-badge-pill pending">Pending Review</span>
                  <ArrowRight size={18} style={{color: '#007C83'}} />
                  <span className="v-badge-pill resolved">Accepted & Bound</span>
                </div>

                <div className="v-decision-signature">
                  <p style={{margin: '0 0 6px', color: '#4F5C5C', fontStyle: 'italic'}}>
                    "GNSS ground marker confirms building footprint centroid aligns with legal boundary plot 42/B. Accepted proposal."
                  </p>
                  <div style={{display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: '10px'}}>
                    <span>Decision: <b style={{color: '#16845B'}}>ACCEPT</b></span>
                    <span>Version lock: <b>v.2 (concurrency-safe)</b></span>
                  </div>
                </div>

                <div className="v-review-footer-action">
                  <Link to="/review" className="v-open-review-btn">
                    Review uncertain cases <ArrowUpRight size={13} />
                  </Link>
                </div>
              </div>
            </motion.div>
          )}

          {currentStage === 7 && (
            <motion.div
              key="stage-08"
              className="visual-stage-container"
              initial={{opacity: 0, scale: 0.98}}
              animate={{opacity: 1, scale: 1}}
              exit={{opacity: 0, scale: 0.98}}
              transition={{duration: 0.35, ease: 'easeInOut'}}
            >
              <div className="v-audit-timeline">
                <div className="v-audit-node">
                  <div className="v-audit-marker"><Check size={11} /></div>
                  <div className="v-audit-content">
                    <div className="v-audit-content-head">
                      <b>DECISION_RECORDED</b>
                      <span>2026-09-20 00:02:14</span>
                    </div>
                    <p>Officer <strong>officer-01</strong> confirmed binding acceptance of pairing for parcel-104.</p>
                  </div>
                </div>

                <div className="v-audit-node">
                  <div className="v-audit-marker"><Check size={11} /></div>
                  <div className="v-audit-content">
                    <div className="v-audit-content-head">
                      <b>CASE_ESCALATED</b>
                      <span>2026-09-20 00:01:42</span>
                    </div>
                    <p>Status changed from <em>automated_evaluation</em> to <em>needs_review</em> (Confidence 68%).</p>
                  </div>
                </div>

                <div className="v-audit-node">
                  <div className="v-audit-marker"><Check size={11} /></div>
                  <div className="v-audit-content">
                    <div className="v-audit-content-head">
                      <b>RECONCILIATION_RUN</b>
                      <span>2026-09-20 00:01:10</span>
                    </div>
                    <p>Run <strong>run-syn-202609</strong> executed: 56 parcels evaluated against drone footprints.</p>
                  </div>
                </div>

                <div className="v-audit-node">
                  <div className="v-audit-marker"><Check size={11} /></div>
                  <div className="v-audit-content">
                    <div className="v-audit-content-head">
                      <b>SOURCES_INGESTED</b>
                      <span>2026-09-20 00:00:55</span>
                    </div>
                    <p>Normalized Cadastral, Drone AI, and GNSS observations loaded into analytical CRS.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {currentStage === 8 && (
            <motion.div
              key="stage-09"
              className="visual-stage-container"
              initial={{opacity: 0, scale: 0.98}}
              animate={{opacity: 1, scale: 1}}
              exit={{opacity: 0, scale: 0.98}}
              transition={{duration: 0.35, ease: 'easeInOut'}}
            >
              <div className="v-trusted-composite">
                <div className="v-trusted-map-scene">
                  <svg width="100%" height="100%" viewBox="0 0 600 320" style={{maxHeight: '100%'}}>
                    {/* Cadastral boundary — institutional cadastral brown */}
                    <polygon
                      points="100,50 490,40 520,280 130,290"
                      fill="rgba(164,124,82,0.06)"
                      stroke="#A47C52"
                      strokeWidth="2"
                    />
                    
                    {/* Reconciled building footprint — Government teal */}
                    <polygon
                      points="190,90 410,80 430,230 210,240"
                      fill="rgba(0,124,131,0.10)"
                      stroke="#007C83"
                      strokeWidth="2"
                    />

                    {/* GNSS verified ground truth marker — GNSS dark teal */}
                    <circle cx="310" cy="155" r="22" fill="rgba(23,74,77,0.08)" stroke="#174A4D" strokeWidth="1.5" />
                    <circle cx="310" cy="155" r="5" fill="#174A4D" />
                    <circle cx="310" cy="155" r="2" fill="#F5F7F7" />

                    {/* Official certification badge — institutional white card */}
                    <g transform="translate(365, 210)">
                      <rect width="200" height="72" rx="4" fill="#FFFFFF" stroke="#D5E1DF" strokeWidth="1" />
                      <rect width="200" height="4" rx="2" fill="#007C83" />
                      <circle cx="28" cy="42" r="16" fill="#EEF7F6" stroke="#007C83" strokeWidth="1.5" />
                      <text x="28" y="47" fill="#007C83" fontSize="13" textAnchor="middle" fontWeight="bold">✓</text>
                      <text x="54" y="32" fill="#172121" fontSize="11" fontFamily="Manrope, sans-serif" fontWeight="700">RECONCILED</text>
                      <text x="54" y="47" fill="#4F5C5C" fontSize="9" fontFamily="monospace">PARCEL ID: #104</text>
                      <text x="54" y="60" fill="#007C83" fontSize="8" fontFamily="monospace">AUTHENTICATED & AUDITED</text>
                    </g>
                  </svg>
                </div>

                <div className="v-trusted-certification">
                  <div className="v-cert-badge">
                    <ShieldCheck size={28} />
                    <div>
                      <strong>One Reconciled Cadastre Picture</strong>
                      <small>3 Convergent Sources · Complete Mathematical Evidence · Human Decided · Immutable Audit</small>
                    </div>
                  </div>
                  <span style={{fontFamily: 'monospace', fontSize: '10px', color: '#16845B', fontWeight: 600}}>STATE: RESOLVED</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
