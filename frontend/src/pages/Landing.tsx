import {lazy, Suspense, useEffect, useRef, useState} from 'react';
import {Link, useSearchParams} from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
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
        <Link to="/" className="landing-brand" aria-label="Bhumi-Setu home" title="भूमि-सेतु | BHUMI-SETU">
          <img
            src="/images/bhumi-setu-logo-light.png"
            alt="भूमि-सेतु | BHUMI-SETU — Land Data. Connected."
            className="landing-brand-logo"
          />
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

        {/* 03 — BHUMI-SETU WORKSPACE (Direct, clean product transition) */}
        <section id="workspace" ref={preview} className="landing-section landing-container workspace-section">
          <div className="workspace-entry-header">
            <div className="workspace-entry-narrative">
              <span className="workspace-entry-badge">BHUMI-SETU WORKSPACE</span>
              <h2 className="workspace-entry-title">
                Inspect the reconciled cadastre on the ground.
              </h2>
              <p className="workspace-entry-subhead">
                Select sources. Run reconciliation. Inspect evidence. Review uncertainty.
              </p>
            </div>
            <Link to="/map" className="workspace-entry-fullscreen-btn" title="Open full WebGIS workspace">
              Full workspace view <ArrowUpRight size={15} />
            </Link>
          </div>

          <div className="landing-workspace landing-workspace-frame">
            {showWorkspace ? (
              <Suspense fallback={<div className="workspace-loading-state">Loading live geospatial workspace…</div>}>
                <Workspace layers={layers} results={results} controls={controls} embedded />
              </Suspense>
            ) : (
              <div className="workspace-loading-placeholder">
                Interactive geospatial cadastre loading as you approach…
              </div>
            )}
          </div>

          <p className="landing-caption">
            Live demonstrator executing WGS84 / UTM 43N spatial reconciliation against synthetic ground truth. All calculations run client/server live.{' '}
            <Link to="/overview">
              System architecture <ArrowRight size={14} />
            </Link>
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="landing-footer landing-container">
        <Link to="/" className="landing-brand" aria-label="Bhumi-Setu home" title="भूमि-सेतु | BHUMI-SETU">
          <img
            src="/images/bhumi-setu-logo.png"
            alt="भूमि-सेतु | BHUMI-SETU — Land Data. Connected."
            className="landing-brand-logo landing-footer-logo"
          />
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
