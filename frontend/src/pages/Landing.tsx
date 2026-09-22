import {lazy, Suspense, useEffect, useRef, useState} from 'react';
import {Link, useSearchParams} from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Layers3,
  Menu,
  X,
  Compass,
  MapPin
} from 'lucide-react';
import type {Layers, Results} from '../types';
import {SmoothScrollHero} from '../components/ui/modern-hero';
import ScrollPipeline from '../components/pipeline/ScrollPipeline';
import type {RunControls} from '../components/RunControl';
import './landing.css';
import './landing-presentation.css';

const Workspace = lazy(() => import('./Workspace'));

export default function Landing({
  layers,
  results,
  error,
  onRetry,
  controls,
}: {
  layers: Layers | null;
  results: Results;
  error: string;
  onRetry: () => void;
  controls: RunControls;
}) {
  const [params] = useSearchParams();
  const realMode = params.get('mode') === 'real_world_reference';
  const [menu, setMenu] = useState(false);
  const [showWorkspace, setShowWorkspace] = useState(false);
  const preview = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          setShowWorkspace(true);
          observer.disconnect();
        }
      },
      {rootMargin: '350px'}
    );

    if (preview.current) observer.observe(preview.current);
    return () => observer.disconnect();
  }, []);

  const scrollToWorkspace = () => {
    preview.current?.scrollIntoView({behavior: 'smooth'});
  };

  return (
    <div className="landing cinematic-landing">
      <a className="landing-skip" href="#landing-main">
        Skip to content
      </a>

      {/* Persistent Header */}
      <header className="landing-header">
        <Link to="/" className="landing-brand" aria-label="Bhumi-Setu home">
          <Layers3 size={32} />
          <span>
            BHUMI-SETU
            <small>Unified Land. Stronger India.</small>
          </span>
        </Link>

        <button
          className="landing-menu"
          aria-label="Toggle landing navigation"
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
        >
          {menu ? <X /> : <Menu />}
        </button>

        <nav aria-label="Product navigation" className={menu ? 'open' : ''} onClick={() => setMenu(false)}>
          <a href="#pipeline">Pipeline</a>
          <a href="#workspace">Workspace</a>
          <Link to="/overview">Overview</Link>
        </nav>

        <Link to="/map" className="landing-header-cta">
          Open Workspace <ArrowUpRight size={16} />
        </Link>
      </header>

      <main id="landing-main">
        {/* 01 — HERO */}
        <SmoothScrollHero />

        {error && (
          <div className="landing-container">
            <div className="landing-error" role="alert">
              Live workspace data is unavailable. The product overview is still accessible.
              <button onClick={onRetry}>Retry connection</button>
            </div>
          </div>
        )}

        {/* 02 — ONE LARGE SCROLL-DRIVEN PIPELINE (Stages 01 — 09) */}
        <ScrollPipeline layers={layers} results={results} controls={controls} />

        {/* 03 — ACTUAL WORKSPACE TRANSITION & LIVE WORKSPACE */}
        <section className="workspace-transition-banner">
          <div className="landing-container">
            <p className="landing-eyebrow" style={{justifyContent: 'center'}}>
              <span></span> REAL PRODUCT INTERACTION
            </p>
            <h2>Now investigate the map.</h2>
            <p>Select a parcel. Inspect its evidence. Trace its source.</p>
            <button className="workspace-transition-cta" onClick={scrollToWorkspace}>
              EXPLORE WORKSPACE <ArrowRight size={16} />
            </button>
          </div>
        </section>

        <section id="workspace" ref={preview} className="landing-section landing-container workspace-section">
          <div className="wide-section-heading">
            <div>
              <p className="landing-eyebrow">LIVE INTERACTIVE CADASTRE</p>
              <h2>
                The Bhumi-Setu Workspace.<br />
                <span>Direct analysis & verification.</span>
              </h2>
            </div>
            <Link to="/map" className="landing-text-button">
              Open full workspace <ArrowUpRight size={17} />
            </Link>
          </div>

          <div className="workspace-context">
            <p>
              <b>Synthetic Benchmark</b> · Pune Study Area<br />
              <span>Controlled cadastral, building and GNSS sources for reconciliation.</span>
            </p>
            <p>
              <b>Real-World Dataset</b> · Lalpur, Ahmedabad, Gujarat<br />
              <span>Authentic building annotations and provenance. Not a cadastral benchmark.</span>
            </p>
          </div>

          <div className="landing-workspace">
            <div className="workspace-chrome">
              <span>
                <Layers3 size={17} /> BHUMI-SETU <i /> LIVE VECTOR WORKSPACE
              </span>
              <Link to="/data-sources">
                Data sources <ArrowUpRight size={14} />
              </Link>
            </div>

            {showWorkspace ? (
              <Suspense fallback={<p className="workspace-loading">Loading workspace…</p>}>
                <Workspace layers={layers} results={results} controls={controls} embedded />
              </Suspense>
            ) : (
              <div className="workspace-loading">
                Actual source layers, evidence and provenance. The interactive map loads as you approach.
              </div>
            )}
          </div>

          <p className="landing-caption">
            The working application, using source geometry from the backend. Satellite basemap for geographic context; synthetic overlays are not official land boundaries.{' '}
            <Link to="/harmonization">
              Run a comparison <ArrowRight size={14} />
            </Link>
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="landing-footer landing-container">
        <Link to="/" className="landing-brand">
          <Layers3 size={24} />
          <span>
            BHUMI-SETU
            <small>Unified Land. Stronger India.</small>
          </span>
        </Link>
        <p>
          Intelligent Geospatial Reconciliation<br />
          <span>SIH 2026 · MVP</span>
        </p>
        <Link to="/overview">
          Project overview <ArrowUpRight size={15} />
        </Link>
      </footer>
    </div>
  );
}
