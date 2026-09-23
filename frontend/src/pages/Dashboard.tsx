import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Map,
  ClipboardCheck,
  History,
  Database,
  CheckCircle2,
  AlertTriangle,
  Clock3,
  Layers,
  ShieldCheck,
  Cpu
} from 'lucide-react';
import type { Source, Run, Layers as MapLayers, Results } from '../types';
import { STUDY_AREA } from '../config/studyArea';

interface DashboardProps {
  sources: Source[];
  run: Run | null;
  layers: MapLayers | null;
  results: Results;
  running: boolean;
  onRun: () => void;
}

export default function Dashboard({ sources, run, results }: DashboardProps) {
  const summary = results.summary;

  return (
    <div className="overview-hub">
      {/* 01: Institutional Page Heading */}
      <div className="page-heading overview-page-heading">
        <div>
          <span className="eyebrow">APPLICATION GATEWAY · SYSTEM STATUS</span>
          <h1>System Overview &amp; Operational Hub</h1>
          <p>
            Bhumi-Setu coordinates multi-source land record reconciliation. Primary spatial analysis,
            layer controls, and parcel-level evidence investigation take place directly within the Workspace.
          </p>
        </div>
        <span className="tag">
          <CheckCircle2 size={14} /> Operational
        </span>
      </div>

      {/* 02: Primary Destination Banner — Centers Gravity on the Real Workspace */}
      <section className="hub-primary-banner" aria-label="Primary Workspace Entry">
        <div className="hub-primary-copy">
          <span className="hub-primary-kicker">PRIMARY GIS ENVIRONMENT</span>
          <h2>Reconciled Geospatial Workspace</h2>
          <p>
            Inspect the high-resolution satellite basemap, toggle cadastral and drone footprint vectors,
            execute live harmonization, and inspect parcel-level mathematical and ML evidence dossiers.
          </p>
          <div className="hub-primary-actions">
            <Link to="/map" className="primary hub-cta-btn">
              <Map size={16} />
              <span>Open Workspace</span>
              <ArrowRight size={16} />
            </Link>
            <span className="hub-cta-caption">
              Direct access to the 3-pane interactive reconciliation tool
            </span>
          </div>
        </div>
      </section>

      {/* 03: Core Application Modules Grid — Clear Functional Ownership */}
      <div className="section-top hub-section-heading">
        <div>
          <span className="eyebrow">CORE MODULES</span>
          <h2>Application Capabilities</h2>
        </div>
      </div>

      <div className="hub-modules-grid">
        <article className="hub-module-card">
          <div className="hub-card-header">
            <span className="hub-icon-wrap workspace-icon">
              <Map size={20} />
            </span>
            <span className="hub-badge active">Primary Product</span>
          </div>
          <h3>Interactive Workspace</h3>
          <p>
            Reconcile cadastral boundaries, drone footprints, and GNSS ground benchmarks.
            Inspect deterministic IoU scores, attribute similarity, and candidate rankings.
          </p>
          <div className="hub-card-footer">
            <Link to="/map" className="text-link">
              Launch Workspace <ArrowRight size={14} />
            </Link>
          </div>
        </article>

        <article className="hub-module-card">
          <div className="hub-card-header">
            <span className="hub-icon-wrap review-icon">
              <ClipboardCheck size={20} />
            </span>
            <span className="hub-badge warning">Human Governance</span>
          </div>
          <h3>Review Queue</h3>
          <p>
            Triage uncertain overlaps and boundary disputes. Officers record binding determinations,
            order field verification surveys, and generate downloadable decision records.
          </p>
          <div className="hub-card-footer">
            <Link to="/review" className="text-link">
              Open Review Queue <ArrowRight size={14} />
            </Link>
          </div>
        </article>

        <article className="hub-module-card">
          <div className="hub-card-header">
            <span className="hub-icon-wrap audit-icon">
              <History size={20} />
            </span>
            <span className="hub-badge neutral">Traceability</span>
          </div>
          <h3>Audit Trail</h3>
          <p>
            Tamper-evident append-only ledger recording all data ingests, reconciliation runs,
            officer actions, and cryptographic before/after state transitions.
          </p>
          <div className="hub-card-footer">
            <Link to="/audit" className="text-link">
              Inspect Audit Log <ArrowRight size={14} />
            </Link>
          </div>
        </article>

        <article className="hub-module-card">
          <div className="hub-card-header">
            <span className="hub-icon-wrap data-icon">
              <Database size={20} />
            </span>
            <span className="hub-badge info">Repository</span>
          </div>
          <h3>Geospatial Sources</h3>
          <p>
            Inspect coordinate reference transformations (EPSG:4326 to UTM 43N), schema normalization
            rules, topological repair metrics, and real-world reference datasets.
          </p>
          <div className="hub-card-footer">
            <Link to="/data-sources" className="text-link">
              View Source Catalog <ArrowRight size={14} />
            </Link>
          </div>
        </article>
      </div>

      {/* 04: Current Active System & Run Environment */}
      <section className="panel hub-status-panel" aria-label="System Configuration">
        <div className="section-top">
          <div>
            <span className="eyebrow">ENVIRONMENT CONFIGURATION</span>
            <h2>Active Engine &amp; Reconciliation State</h2>
          </div>
          {run && (
            <span className="run-duration">
              <Clock3 size={13} /> {run.duration_seconds}s execution time
            </span>
          )}
        </div>

        <div className="hub-status-grid">
          <div className="hub-status-item">
            <span className="hub-status-label">Active Study Area</span>
            <strong className="hub-status-value">{STUDY_AREA.name}</strong>
            <small className="hub-status-sub">Pune, Maharashtra · WGS84 / EPSG:4326</small>
          </div>

          <div className="hub-status-item">
            <span className="hub-status-label">Reconciliation Engine</span>
            <strong className="hub-status-value">Deterministic + ML Ranker</strong>
            <small className="hub-status-sub">65% IoU · 35% Attributes · GNSS Boost · RandomForest</small>
          </div>

          <div className="hub-status-item">
            <span className="hub-status-label">Registered Sources</span>
            <strong className="hub-status-value">{sources.length} Layer Sets</strong>
            <small className="hub-status-sub">Cadastral, Drone Footprints, RTK GNSS</small>
          </div>

          <div className="hub-status-item">
            <span className="hub-status-label">Latest Harmonization</span>
            <strong className="hub-status-value">
              {run ? `Run ${run.id.slice(0, 8)} (${run.status})` : 'Awaiting Run'}
            </strong>
            <small className="hub-status-sub">
              {summary
                ? `${summary.matched} Matched · ${summary.needs_review} Review · ${summary.conflict} Conflict`
                : 'No active run saved'}
            </small>
          </div>
        </div>
      </section>
    </div>
  );
}
