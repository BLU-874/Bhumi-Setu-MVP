import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { NavLink, Route, Routes, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Database,
  GitMerge,
  Map,
  ClipboardCheck,
  History,
  Menu,
  X,
  ArrowUpRight,
  Play,
  CheckCircle2,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import type { Health, Source, Run, Results, Layers } from './types';
import { api, type LayerName, type LoadState, type WorkspaceLoadState } from './services/api';
import Dashboard from './pages/Dashboard';
const Landing = lazy(() => import('./pages/Landing'));
import DataSources from './pages/DataSources';
const Workspace = lazy(() => import('./pages/Workspace'));
import Workflow from './components/Workflow';
import ReviewQueue from './components/ReviewQueue';
import AuditTrail from './pages/AuditTrail';
import { STUDY_AREA } from './config/studyArea';
import './experience.css';

const empty: Results = { type: 'FeatureCollection', features: [], summary: null, run_id: null };
const emptyLayer: Layers['cadastral'] = { type: 'FeatureCollection', features: [] };
const initialLoading = (): WorkspaceLoadState => ({
  health: { status: 'loading' }, sources: { status: 'loading' }, runs: { status: 'loading' },
  cadastral: { status: 'loading' }, buildings: { status: 'loading' }, gnss: { status: 'loading' },
  droneBuildings: { status: 'loading' }, results: { status: 'loading' }
});

const nav = [
  { to: '/map', label: 'Workspace', icon: Map },
  { to: '/data-sources', label: 'Data sources', icon: Database },
  { to: '/review', label: 'Review queue', icon: ClipboardCheck },
  { to: '/audit', label: 'Audit trail', icon: History },
  { to: '/overview', label: 'System Overview', icon: LayoutDashboard },
  { to: '/harmonization', label: 'Harmonization', icon: GitMerge },
];

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [results, setResults] = useState<Results>(empty);
  const [layers, setLayers] = useState<Layers | null>(null);
  const [loading, setLoading] = useState<WorkspaceLoadState>(initialLoading);
  const loadGeneration = useRef(0);
  const resultsGeneration = useRef(0);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const [menu, setMenu] = useState(false);
  const [buildingSource, setBuildingSource] = useState('buildings');
  const buildingSourceRef = useRef('buildings');
  const [importing, setImporting] = useState(false);
  const location = useLocation();
  const realWorkspace = location.pathname === '/map' && new URLSearchParams(location.search).get('mode') === 'real_world_reference';

  const refresh = async (preferred?: string, runId?: string, known?: { sources?: Source[]; runs?: Run[] }) => {
    const generation = ++loadGeneration.current;
    const resultGeneration = ++resultsGeneration.current;
    const current = () => generation === loadGeneration.current;
    setLoading(initialLoading());
    setLayers(null);
    setResults(empty);
    setHealth(null);
    setError('');
    const update = (key: keyof WorkspaceLoadState, state: LoadState) => {
      if (current()) setLoading(previous => ({ ...previous, [key]: state }));
    };
    const fail = (key: keyof WorkspaceLoadState, reason: unknown) => {
      const message = reason instanceof Error ? reason.message : 'Request failed';
      update(key, { status: 'error', message });
      if (current()) setError(`${key}: ${message}`);
    };

    // Health never gates source selection, layers, or saved results.
    void api.health().then(h => {
      if (current()) setHealth(h);
      update('health', { status: 'loaded' });
    }).catch(e => fail('health', e));
    const sourceRequest = (known?.sources ? Promise.resolve(known.sources) : api.sources()).then(ss => {
      if (current()) setSources(ss);
      update('sources', { status: ss.length ? 'loaded' : 'empty' });
      return ss;
    }).catch(e => { fail('sources', e); throw e; });
    const runRequest = (known?.runs ? Promise.resolve(known.runs) : api.runs()).then(rr => {
      if (current()) setRuns(rr);
      update('runs', { status: rr.length ? 'loaded' : 'empty' });
      return rr;
    }).catch(e => { fail('runs', e); throw e; });

    const selection = Promise.all([sourceRequest, runRequest]).then(([ss, rr]) => {
      const isLanding = location.pathname === '/';
      const latestCompleted = rr.find(r => r.status === 'completed');
      let activeSource = preferred;
      if (!activeSource) {
        if (isLanding) {
          activeSource = 'buildings';
        } else {
          activeSource = latestCompleted?.source_ids?.buildings || 'buildings';
        }
      }
      if (activeSource !== 'buildings' && !ss.some(s => s.id === activeSource)) {
        activeSource = 'buildings';
      }
      let targetRunId = runId;
      if (!targetRunId) {
        if (activeSource === 'buildings') {
          const benchmarkRun = rr.find(r => r.status === 'completed' && (!r.source_ids?.buildings || r.source_ids.buildings === 'buildings'));
          targetRunId = benchmarkRun?.id;
        } else {
          const sourceRun = rr.find(r => r.status === 'completed' && r.source_ids?.buildings === activeSource);
          targetRunId = sourceRun?.id;
        }
      }
      if (current()) {
        buildingSourceRef.current = activeSource;
        setBuildingSource(activeSource);
        setLayers(previous => previous ? { ...previous, buildingSourceId: activeSource } : previous);
      }
      return { buildingSourceId: activeSource, sources: ss, runId: targetRunId };
    });

    // Fixed layers start immediately, before the source/run metadata resolves.
    const layerRequests = api.layers(selection);
    for (const key of Object.keys(layerRequests) as LayerName[]) {
      void layerRequests[key].then(collection => {
        if (!current()) return;
        setLayers(previous => ({
          cadastral: emptyLayer, buildings: emptyLayer, gnss: emptyLayer,
          buildingSourceId: buildingSourceRef.current,
          ...previous, [key]: collection
        }));
        update(key, { status: collection?.features.length ? 'loaded' : 'empty' });
      }).catch(e => fail(key, e));
    }

    // Never fall back to another source's latest run when this source has no run.
    await selection.then(selected => selected.runId ? api.results(selected.runId) : empty).then(res => {
      if (!current() || resultGeneration !== resultsGeneration.current) return;
      setResults(res);
      update('results', { status: res.features.length ? 'loaded' : 'empty' });
    }).catch(e => {
      if (resultGeneration === resultsGeneration.current) fail('results', e);
    });
  };

  const handleSelectBuildingSource = async (id: string) => {
    buildingSourceRef.current = id;
    setBuildingSource(id);
    await refresh(id, undefined, {
      sources: ['loaded', 'empty'].includes(loading.sources.status) ? sources : undefined,
      runs: ['loaded', 'empty'].includes(loading.runs.status) ? runs : undefined
    });
  };

  const importStaged = async () => {
    const generation = loadGeneration.current;
    setImporting(true);
    setError('');
    try {
      const source = await api.importStaged();
      if (generation === loadGeneration.current) await refresh(source.id);
    } catch (e) {
      if (generation === loadGeneration.current) setError((e as Error).message);
    } finally {
      setImporting(false);
    }
  };

  useEffect(() => {
    void refresh();
    return () => {
      loadGeneration.current++;
      resultsGeneration.current++;
    };
  }, []);

  const run = async () => {
    const generation = loadGeneration.current;
    setRunning(true);
    setError('');
    const target = buildingSourceRef.current;
    try {
      const completed = await api.run(target);
      if (generation === loadGeneration.current) await refresh(target, completed.id);
    } catch (e) {
      if (generation === loadGeneration.current) setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const handleClearResults = () => {
    resultsGeneration.current++;
    setResults(empty);
    setLoading(previous => ({ ...previous, results: { status: 'empty' } }));
  };

  const latest = runs.find(r => r.id === results.run_id) || null;
  // Other pages still consume complete base layers; Workspace handles partial ones.
  const completeLayers = (['cadastral', 'buildings', 'gnss'] as const)
    .every(key => ['loaded', 'empty'].includes(loading[key].status)) ? layers : null;
  const controls = {
    sources,
    buildingSource,
    setBuildingSource: (id: string) => void handleSelectBuildingSource(id),
    running,
    run: latest,
    onRun: run,
    onClearResults: handleClearResults,
    error,
    loading,
    onRetryLoad: () => void refresh(buildingSourceRef.current),
  };

  if (location.pathname === '/') {
    return (
      <Suspense fallback={<p role="status">Loading Bhumi-Setu...</p>}>
        <Landing layers={layers} results={results} controls={controls} error={error} onRetry={() => void refresh()} />
      </Suspense>
    );
  }

  const page = nav.find(n => n.to === location.pathname)?.label || 'Page not found';

  return (
    <div className="app-shell">
      <button className="mobile-menu" aria-label="Toggle navigation" onClick={() => setMenu(!menu)}>
        {menu ? <X /> : <Menu />}
      </button>
      {menu && <button className="nav-backdrop" aria-label="Close navigation" onClick={() => setMenu(false)} />}

      <aside className={`sidebar ${menu ? 'open' : ''}`}>
        <Link to="/" className="brand" aria-label="Bhumi-Setu home" title="Bhumi-Setu — Land Data. Connected.">
          <img src="/images/bhumi-setu-logo-light.png" alt="Bhumi-Setu" className="sidebar-brand-logo" />
        </Link>

        {/* WORKSPACE: The Primary Application Center of Gravity */}
        <div className="workspace-label">WORKSPACE</div>
        <nav className="sidebar-nav">
          <NavLink to="/map" end>
            <Map size={18} />
            <span>Workspace</span>
          </NavLink>
        </nav>

        {/* DATA: Source Catalog & Technical Metadata */}
        <div className="workspace-label">DATA</div>
        <nav className="sidebar-nav">
          <NavLink to="/data-sources" end>
            <Database size={18} />
            <span>Data sources</span>
          </NavLink>
        </nav>

        {/* REVIEW & AUDIT: Human Governance & Traceability */}
        <div className="workspace-label">REVIEW &amp; AUDIT</div>
        <nav className="sidebar-nav">
          <NavLink to="/review" end>
            <ClipboardCheck size={18} />
            <span>Review queue</span>
          </NavLink>
          <NavLink to="/audit" end>
            <History size={18} />
            <span>Audit trail</span>
          </NavLink>
        </nav>

        {/* SYSTEM: Minimal Utility Link to Overview */}
        <div className="workspace-label utility-label">SYSTEM</div>
        <nav className="sidebar-nav utility-nav">
          <NavLink to="/overview" end>
            <LayoutDashboard size={18} />
            <span>Overview</span>
          </NavLink>
        </nav>

        <div className="sidebar-bottom">
          <div className="study-card">
            <span className="live-dot" />
            <b>{realWorkspace ? 'Lalpur, Ahmedabad' : STUDY_AREA.name}</b>
            <small>{realWorkspace ? 'Gujarat · Real-world reference' : 'Synthetic demonstration dataset'}</small>
            <span className="study-tag">{realWorkspace ? 'STAGED VECTOR SUBSET' : 'ACTIVE STUDY AREA'}</span>
          </div>
          <p>SIH 2026 <span>/ SIH26013</span></p>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <Link to="/" className="topbar-brand-link" title="Bhumi-Setu Home">
              <img src="/images/bhumi-setu-logo.png" alt="Bhumi-Setu" className="topbar-brand-logo" />
            </Link>
            <span>/</span>
            <b>{page}</b>
          </div>
          <div className="topbar-right">
            <span className="synthetic-chip">
              {realWorkspace ? 'REAL-WORLD REFERENCE' : 'SYNTHETIC DEMONSTRATION'}
            </span>
            <span className="connection">
              <span className={health ? 'ready-dot' : 'offline-dot'} />
              {health ? (health.postgis_connected ? 'PostGIS connected' : 'Local demo storage') : loading.health.status === 'error' ? 'Connection check failed' : 'Connecting'}
            </span>
            <span className="avatar" aria-label="Demo officer">DO</span>
          </div>
        </header>

        <main className="page-content">
          {error && (
            <div className="error-banner" role="alert">
              <AlertCircle size={18} />
              <span>{error}. Check that the MVP backend is available.</span>
              <button onClick={() => void refresh()}>
                <RefreshCw size={14} /> Retry
              </button>
            </div>
          )}

          <Routes>
            <Route
              path="/overview"
              element={
                <Dashboard
                  sources={sources}
                  run={latest}
                  layers={completeLayers}
                  results={results}
                  running={running}
                  onRun={() => void run()}
                />
              }
            />
            <Route
              path="/data-sources"
              element={
                <DataSources
                  sources={sources}
                  onImport={() => void importStaged()}
                  importing={importing}
                />
              }
            />
            <Route
              path="/map"
              element={
                <Suspense fallback={<p role="status">Loading workspace...</p>}>
                  <Workspace layers={layers} results={results} controls={controls} />
                </Suspense>
              }
            />
            <Route
              path="/review"
              element={
                <>
                  <div className="page-heading review-page-heading">
                    <div>
                      <span className="eyebrow">04 / HUMAN OVERSIGHT</span>
                      <h1>Review uncertain cases.</h1>
                      <p>Every decision is sent to the backend, version checked, and recorded in the audit trail.</p>
                    </div>
                    <span className="tag">
                      <CheckCircle2 size={14} /> Backend persisted
                    </span>
                  </div>
                  <ReviewQueue runId={results.run_id} layers={completeLayers} />
                </>
              }
            />
            <Route path="/audit" element={<AuditTrail runId={results.run_id} />} />
            <Route
              path="/harmonization"
              element={
                <>
                  <div className="page-heading">
                    <div>
                      <span className="eyebrow">02 / RECONCILIATION ENGINE</span>
                      <h1>Every score has a reason.</h1>
                      <p>Compare demonstration sources with deterministic evidence scoring and supervised ML candidate ranking.</p>
                    </div>
                    <button className="primary" disabled={running || !sources.length} onClick={() => void run()}>
                      <Play size={15} />
                      {running ? 'Processing real data…' : 'Run harmonization'}
                    </button>
                  </div>
                  <div className="panel source-selection">
                    <label className="select-label">
                      Building source
                      <select
                        value={buildingSource}
                        disabled={running || importing}
                        onChange={e => void handleSelectBuildingSource(e.target.value)}
                      >
                        {sources
                          .filter(s => s.kind === 'buildings')
                          .map(s => (
                            <option key={s.id} value={s.id}>
                              {s.id === 'buildings'
                                ? 'Synthetic Benchmark Buildings (475 features · Benchmark reconciliation)'
                                : `${s.name} (${s.feature_count} features · Demonstration only)`}
                            </option>
                          ))}
                      </select>
                    </label>
                    <p className="muted">
                      This source will be used for the next run. Map and review evidence show the latest completed run
                      {latest?.source_ids
                        ? `: ${sources.find(s => s.id === latest.source_ids?.buildings)?.name || latest.source_ids.buildings}`
                        : ''}
                      .
                    </p>
                  </div>
                  <Workflow completed={!!latest} running={running} />
                  <div className="panel formula-panel">
                    <div>
                      <span className="eyebrow">SCORING POLICY</span>
                      <h2>65% geometry + 35% attributes</h2>
                      <p>
                        GNSS containment adds up to 8 points, capped at 100. A confidence score is a weighted evidence
                        score, not a calibrated probability.
                      </p>
                      <div className="thresholds">
                        <span className="status matched">≥ 75 Matched</span>
                        <span className="status needs_review">40–74.9 Needs review</span>
                        <span className="status conflict">&lt; 40 Conflict</span>
                      </div>
                    </div>
                    <Link to="/map" className="text-link">
                      Inspect result evidence <ArrowUpRight size={17} />
                    </Link>
                  </div>
                  <section className="panel">
                    <div className="section-top">
                      <h2>Saved runs</h2>
                      <span className="muted">{runs.length} runs</span>
                    </div>
                    {runs.length ? (
                      <div className="run-list">
                        {runs.map(r => (
                          <div key={r.id}>
                            <CheckCircle2 size={18} />
                            <div>
                              <b>{new Date(r.started_at).toLocaleString()}</b>
                              <small>
                                {r.id.slice(0, 8)} · {r.status}
                              </small>
                            </div>
                            <span>{r.summary?.total_parcels ?? '—'} parcels</span>
                            <span>{r.duration_seconds ?? '—'}s</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="muted">No runs yet. Start harmonization to create a saved comparison.</p>
                    )}
                  </section>
                </>
              }
            />
            <Route
              path="*"
              element={
                <div className="panel">
                  <h1>Page not found</h1>
                  <Link to="/map">Return to Workspace</Link>
                </div>
              }
            />
          </Routes>
          <footer className="page-footer">
            <span>
              BHUMI-SETU <span>Explainable Geospatial Reconciliation Engine</span>
            </span>
            <span>SIH26013 · Unified Architecture</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
