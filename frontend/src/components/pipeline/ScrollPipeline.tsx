import {useState, useCallback} from 'react';
import type {Layers, Results} from '../../types';
import type {RunControls} from '../RunControl';
import PipelineStage, {type StageData} from './PipelineStage';
import PipelineVisual from './PipelineVisual';
import './scroll-pipeline.css';

interface ScrollPipelineProps {
  layers?: Layers | null;
  results?: Results;
  controls?: RunControls;
}

const STAGES: StageData[] = [
  {
    id: 'stage-sources',
    num: '01',
    eyebrow: '01 / SOURCES',
    headline: 'Different sources.',
    headlineHighlight: 'One place.',
    description:
      'Bhumi-Setu brings heterogeneous geospatial sources into a common analytical space: legacy cadastral maps, high-resolution aerial drone footprints, and centimeter-accurate GNSS survey benchmarks.',
    tags: ['Legacy Cadastre', 'Drone Orthophotos', 'RTK GNSS'],
    accentTags: ['Heterogeneous Ingest'],
    evidenceStrip: {
      tag: 'CONVERGENCE',
      title: '3 Independent Spatial Realities',
      body: 'Synthesizing historical revenue plots, physical observed structures, and geodetic ground truth into a unified coordinate environment.',
    },
  },
  {
    id: 'stage-normalize',
    num: '02',
    eyebrow: '02 / NORMALIZE',
    headline: 'Before they can agree, they need to speak the same language.',
    description:
      'Standardizing coordinate reference systems, repairing invalid polygon topology, and aligning metadata schemas so disparate records can be analyzed side by side without spatial distortion.',
    tags: ['EPSG:24378 → UTM 43N', 'Topological Repair', 'Schema Mapping'],
    accentTags: ['CRS', 'Geometry', 'Schema'],
    evidenceStrip: {
      tag: 'GEOMETRY HYGIENE',
      title: 'Zero Self-Intersections & Standardized Projections',
      body: 'Transforming legacy surveyor grids into canonical WGS84 coordinates while healing slivers, duplicate vertices, and winding orders.',
    },
  },
  {
    id: 'stage-reconciliation',
    num: '03',
    eyebrow: '03 / RECONCILIATION',
    headline: 'Which records describe the same place?',
    description:
      'Spacially intersecting parcels, building footprints, and GNSS ground observations. Multi-dimensional scoring computes geometric boundary overlap, property attribute similarity, and geodetic containment.',
    tags: ['Intersection over Union', 'Centroid Distance', 'Containment Buffers'],
    accentTags: ['Geometry 65%', 'Attributes 35%', 'GNSS Boost'],
    evidenceStrip: {
      tag: 'SPATIAL FORMULA',
      title: 'Evidence-Weighted Match Engine',
      body: 'Deterministic confidence combines 65% geometric IoU with 35% attribute similarity, applying a verified boost when GNSS survey markers fall inside the parcel.',
    },
  },
  {
    id: 'stage-evidence',
    num: '04',
    eyebrow: '04 / EVIDENCE',
    headline: 'Every decision has evidence.',
    description:
      'AI ranks candidate matches, while deterministic geometry and attributes explain their exact relationship. Topological validation surfaces disagreements before any human officer decides.',
    tags: ['Explainable AI', 'Feature Ranking', 'Boundary Verification'],
    accentTags: ['Supervised ML', 'Deterministic IoU', 'Audit Flags'],
    evidenceStrip: {
      tag: 'EXPLAINABLE SCORING',
      title: 'Geometry + Attributes + GNSS + ML Ranking',
      body: 'Transparent breakdown of IoU percentages, survey number matches, owner name string distances, and automated topological validation flags.',
    },
  },
  {
    id: 'stage-results',
    num: '05',
    eyebrow: '05 / RESULTS',
    headline: 'One map. Three outcomes.',
    description:
      'Every parcel is categorized into an unambiguous state based on strict evidence thresholds. Clear semantic coloring guides operational priority for revenue and survey departments.',
    tags: ['High Confidence', 'Escalation Thresholds', 'Priority Routing'],
    accentTags: ['Matched (Green)', 'Needs Review (Amber)', 'Conflict (Coral)'],
    evidenceStrip: {
      tag: 'CLASSIFICATION',
      title: 'Actionable Triage Semantics',
      body: 'High confidence matches proceed automatically. Ambiguous overlaps or boundary disputes escalate directly to designated revenue officers.',
    },
  },
  {
    id: 'stage-review',
    num: '06',
    eyebrow: '06 / REVIEW',
    headline: "Uncertainty doesn't disappear.",
    subHeadline: 'It gets escalated.',
    description:
      'When automation encounters boundary ambiguities, multi-candidate building footprints, or attribute discrepancies, records are routed to an interactive officer review queue with full spatial evidence.',
    tags: ['Officer Queue', 'Multi-Candidate Inspection', 'Dispute Routing'],
    accentTags: ['Accept', 'Reject', 'Investigate'],
    cta: {
      label: 'Review uncertain cases',
      to: '/review',
    },
    evidenceStrip: {
      tag: 'HUMAN OVERSIGHT',
      title: 'Preserved Ambiguity, Not Guesswork',
      body: 'Officers can inspect candidate alternatives side-by-side on the map, confirm valid matches, discard erroneous links, or order field re-surveys.',
    },
  },
  {
    id: 'stage-decision',
    num: '07',
    eyebrow: '07 / HUMAN DECISION',
    headline: 'Automation proposes. People decide.',
    description:
      'Binding legal reconciliation requires human accountability. Officers record decisions accompanied by officer identity credentials, justification notes, and concurrency-safe version locks.',
    tags: ['Officer Accountability', 'Legal Standing', 'Version Locking'],
    accentTags: ['Binding Sign-off', 'Reviewer Notes'],
    cta: {
      label: 'Open Review Queue',
      to: '/review',
    },
    evidenceStrip: {
      tag: 'LEGAL CERTAINTY',
      title: 'State Transition & Officer Signature',
      body: 'Decisions update state from pending to resolved with immutable notes. Machine learning models never override officer authority.',
    },
  },
  {
    id: 'stage-audit',
    num: '08',
    eyebrow: '08 / AUDIT',
    headline: 'Nothing disappears after the decision.',
    description:
      'Every ingest, transformation, candidate score, escalation, and human decision is permanently recorded in an append-only audit trail. Historic states, officer IDs, and timestamps are immutable.',
    tags: ['Append-Only Ledger', 'Historic State Replay', 'Traceability'],
    accentTags: ['Decision → Reviewer → Timestamp → Before → After'],
    evidenceStrip: {
      tag: 'IMMUTABLE TRAIL',
      title: 'Complete Lifecycle Provenance',
      body: 'From raw cadastral maps to final officer sign-off, every modification retains full cryptographic and temporal provenance.',
    },
  },
  {
    id: 'stage-trusted',
    num: '09',
    eyebrow: '09 / TRUSTED PICTURE',
    headline: 'FROM FRAGMENTED DATA',
    headlineHighlight: 'TO ONE TRACEABLE DECISION.',
    description:
      'Many sources converge into one reconciled picture, backed by mathematical evidence, human review, and permanent auditability. One authoritative source of spatial truth.',
    tags: ['Unified Cadastre', 'Interoperable GIS', 'Sovereign Land Record'],
    accentTags: ['Reconciled', 'Audited', 'Verified'],
    evidenceStrip: {
      tag: 'TRUSTED CADASTRE',
      title: 'The Single Source of Spatial Truth',
      body: 'Providing administrators, citizens, and surveyors with reliable, traceable, and defensible land intelligence across India.',
    },
  },
];

export default function ScrollPipeline({layers, results, controls}: ScrollPipelineProps) {
  const [activeStage, setActiveStage] = useState(0);

  const handleStageIntersect = useCallback((index: number) => {
    setActiveStage(index);
  }, []);

  const scrollToStage = (stageId: string) => {
    const el = document.getElementById(stageId);
    if (el) {
      el.scrollIntoView({behavior: 'smooth', block: 'center'});
    }
  };

  return (
    <section id="pipeline" className="pipeline-section" aria-label="Bhumi-Setu End-to-End Pipeline">
      <div id="how-it-works" style={{position: 'absolute', top: 0}} />
      {/* 01 — 09 Subtle Progress Bar Header */}
      <div className="pipeline-progress-header">
        <nav className="pipeline-progress-track" aria-label="Pipeline Stage Progress">
          {STAGES.map((s, idx) => (
            <button
              key={s.id}
              className={`pipeline-step-pill ${activeStage === idx ? 'is-active' : ''}`}
              onClick={() => scrollToStage(s.id)}
              aria-current={activeStage === idx ? 'step' : undefined}
            >
              <span className="step-num">{s.num}</span>
              <span>{s.eyebrow.split('/')[1]?.trim() || s.eyebrow}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="pipeline-wrapper">
        <div className="pipeline-grid">
          {/* Left Column: Narrative Stages */}
          <div className="pipeline-narrative-column">
            {STAGES.map((stage, idx) => (
              <PipelineStage
                key={stage.id}
                stage={stage}
                index={idx}
                isActive={activeStage === idx}
                onIntersect={handleStageIntersect}
              >
                {/* Embedded fallback visual for mobile sequential view */}
                <PipelineVisual
                  activeStage={activeStage}
                  stageIndex={idx}
                  layers={layers}
                  results={results}
                />
              </PipelineStage>
            ))}
          </div>

          {/* Right Column: Sticky Visual Canvas for Desktop */}
          <div className="pipeline-visual-column" aria-hidden="false">
            <PipelineVisual
              activeStage={activeStage}
              layers={layers}
              results={results}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
