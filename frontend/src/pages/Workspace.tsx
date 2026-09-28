import { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import WorkspaceModes from '../components/WorkspaceModes';
import ReferenceWorkspace from '../components/ReferenceWorkspace';
import { SlidersHorizontal, MousePointer2, Crosshair, ArrowRight, ArrowUpRight } from 'lucide-react';
import type { Layers, Results, ResultFeature } from '../types';
import MapView from '../components/MapView';
import EvidencePanel from '../components/EvidencePanel';
import RunControl, { type RunControls } from '../components/RunControl';
import { STUDY_AREA } from '../config/studyArea';
import type { LayerName, WorkspaceLoadState } from '../services/api';

// These extra controls also pass through the existing embedded landing workspace.
type WorkspaceControls = RunControls & {
  loading?: WorkspaceLoadState;
  onRetryLoad?: () => void;
};

function SyntheticWorkspace({
  layers,
  results,
  embedded = false,
  controls
}: {
  layers: Layers | null;
  results: Results;
  embedded?: boolean;
  controls?: WorkspaceControls;
}) {
  const [visible, setVisible] = useState({
    cadastral: true,
    buildings: true,
    gnss: true,
    results: true,
    droneBuildings: true
  });
  const [selected, setSelected] = useState<ResultFeature | null>(null);
  const evidenceColumn = useRef<HTMLElement>(null);
  const [fullEvidence, setFullEvidence] = useState(!embedded);
  const select = (feature: ResultFeature) => {
    setSelected(feature);
    setFullEvidence(!embedded);
  };
  const [filter, setFilter] = useState('all');
  const [basemap, setBasemap] = useState(false);
  const [satellite, setSatellite] = useState(true);

  useEffect(() => {
    setSelected(null);
    setFullEvidence(!embedded);
    setFilter('all');
  }, [embedded, results.run_id, controls?.buildingSource]);

  const loading = controls?.loading;
  const ready = (key: keyof WorkspaceLoadState) => !loading || ['loaded', 'empty'].includes(loading[key].status);
  const resultsReady = ready('results');
  const resultMessage = !resultsReady
    ? loading?.results.status === 'error' ? `Results failed to load: ${loading.results.message}` : 'Loading results…'
    : results.features.length ? 'Click a colored parcel for evidence'
    : results.run_id ? 'Results loaded: no parcels in this run' : 'No saved results for this source. Run harmonization to see scored proposals';
  const layerLabels: Record<LayerName, string> = {
    cadastral: 'Cadastral', buildings: 'Buildings', gnss: 'GNSS', droneBuildings: 'Optional drone overlay'
  };
  const layerMessages = loading ? (Object.keys(layerLabels) as LayerName[]).flatMap(key => {
    const state = loading[key];
    if (state.status === 'loading') return [`Loading ${layerLabels[key].toLowerCase()}…`];
    if (state.status === 'error') return [`${layerLabels[key]} failed to load: ${state.message}`];
    if (state.status === 'empty' && (key !== 'droneBuildings' || layers?.droneBuildings)) return [`${layerLabels[key]} loaded: no features`];
    return [];
  }) : [];
  // Leaflet GeoJSON data is set on mount. Keep pending overlays unmounted until
  // their real response arrives, without changing MapView or user toggle state.
  const mapVisible = { ...visible,
    cadastral: visible.cadastral && ready('cadastral'),
    buildings: visible.buildings && ready('buildings'),
    gnss: visible.gnss && ready('gnss'),
    droneBuildings: visible.droneBuildings && ready('droneBuildings'),
    results: visible.results && resultsReady
  };

  const filtered = {
    ...results,
    features: results.features.filter(f => filter === 'all' || f.properties.status === filter)
  };

  const matchedCount = resultsReady ? results.summary?.matched ?? results.features.filter(f => f.properties.status === 'matched').length : '—';
  const reviewCount = resultsReady ? results.summary?.needs_review ?? results.features.filter(f => f.properties.status === 'needs_review').length : '—';
  const conflictCount = resultsReady ? results.summary?.conflict ?? results.features.filter(f => f.properties.status === 'conflict').length : '—';
  const hasCompletedResults = resultsReady && !!results.run_id && !!results.summary &&
    (!controls?.run || controls.run.status === 'completed');
  const contributions = [
    { label: 'Geometry', value: selected?.properties.confidence_explanation?.geometry_contribution },
    { label: 'Attributes', value: selected?.properties.confidence_explanation?.attribute_contribution }
  ].filter(({ value }) => typeof value === 'number' && Number.isFinite(value));

  const built = controls?.sources.find(s => s.id === controls.buildingSource);
  const isStagedDrone = controls
    ? (controls.buildingSource !== 'buildings' || built?.source_type === 'ai_derived_drone_footprint' || built?.demonstration === true)
    : (results.features.filter(f => f.properties.matched_footprint_id).length <= 6);
  const buildingCount = controls?.buildingSource === 'buildings' ? 475 : (built?.feature_count ?? 6);
  const gnssCount = controls?.sources.find(s => s.kind === 'gnss')?.feature_count ?? 350;
  const sampleFeature = results.features.find(f => f.properties.model_version) || results.features[0];
  const modelAvailable = sampleFeature?.properties?.model_available ?? true;
  const modelVersion = sampleFeature?.properties?.model_version || 'synthetic-hgb-v1-6d8638ed6839';

  return (
    <div className="synthetic-workspace-container">
      {/* 1. Horizontal GIS Toolbar: Layers + Basemaps + Result Filter */}
      <div className="workspace-layer-toolbar" aria-label="GIS Layer Controls">
        <span className="layer-toolbar-label">
          <SlidersHorizontal size={14} /> LAYERS
        </span>
        <div className="layer-toolbar-items">
          {Object.entries(visible)
            .filter(([k]) => k !== 'droneBuildings' || layers?.droneBuildings)
            .map(([k, v]) => (
              <label key={k} className="layer-checkbox-label">
                <input
                  type="checkbox"
                  checked={v}
                  onChange={() => setVisible({ ...visible, [k]: !v })}
                />
                {k === 'droneBuildings'
                  ? 'AI-derived drone buildings'
                  : k === 'results'
                  ? 'Results'
                  : k === 'gnss'
                  ? 'GNSS'
                  : k[0].toUpperCase() + k.slice(1)}
              </label>
            ))}
          <span className="layer-toolbar-divider" />
          <label className="layer-checkbox-label">
            <input
              type="checkbox"
              checked={satellite}
              onChange={() => {
                setSatellite(!satellite);
                setBasemap(false);
              }}
            />
            Satellite basemap
          </label>
          <label className="layer-checkbox-label">
            <input
              type="checkbox"
              checked={basemap}
              onChange={() => {
                setBasemap(!basemap);
                setSatellite(false);
              }}
            />
            Street basemap
          </label>
        </div>

        <div className="layer-toolbar-filter">
          <label className="toolbar-filter-label" htmlFor="workspace-result-filter">
            Filter:
            <select
              id="workspace-result-filter"
              value={filter}
              disabled={!resultsReady}
              onChange={e => {
                setFilter(e.target.value);
                setSelected(null);
              }}
            >
              <option value="all">{resultsReady ? `All (${results.features.length})` : loading?.results.status === 'error' ? 'Results unavailable' : 'Loading results…'}</option>
              <option value="matched">Matched ({matchedCount})</option>
              <option value="needs_review">Needs review ({reviewCount})</option>
              <option value="conflict">Conflict ({conflictCount})</option>
            </select>
          </label>
        </div>
      </div>

      {/* 2. Main Three-Pane GIS Workspace: Left (Sources + Run) | Center (Dominant Map) | Right (Evidence Dossier) */}
      <div className={`gis-workspace-grid ${selected ? 'has-evidence' : 'has-empty-dossier'}`}>
        {/* Left Pane: Sources & Harmonization */}
        <aside className="workspace-harmonization-column">
          {controls && <RunControl controls={controls} results={results} embedded={embedded} />}
        </aside>

        {/* Center Pane: Dominant Interactive Map */}
        <div className="workspace-map-column">
        <section className="workspace-map-section">
          <div className="workspace-map">
            {layers && ready('cadastral') ? (
              <MapView
                layers={layers}
                results={filtered}
                visible={mapVisible}
                onSelect={select}
                selected={selected}
                basemap={basemap}
                satellite={satellite}
              />
            ) : (
              <div className="empty" role={loading?.cadastral.status === 'error' ? 'alert' : 'status'}>
                {loading?.cadastral.status === 'error' ? `Cadastral layer failed to load: ${loading.cadastral.message}` : 'Loading map layers…'}
              </div>
            )}
            <div className="map-caption">
              <span>
                {isStagedDrone
                  ? 'STAGED DRONE FIXTURE · 6 DRONE FOOTPRINTS · SYNTHETIC CADASTRAL CONTEXT'
                  : 'SYNTHETIC BENCHMARK · 475 BUILDING FOOTPRINTS · SYNTHETIC CADASTRAL CONTEXT'}
              </span>
              <span>WGS84 · EPSG:4326</span>
            </div>
          </div>

          <div className="map-bottom">
            <span role="status" aria-live="polite">
              <MousePointer2 size={14} />{' '}
              {[resultMessage, ...layerMessages].join(' · ')}
              {loading && Object.values(loading).some(state => state.status === 'error') && controls?.onRetryLoad && (
                <> <button className="text-link" onClick={controls.onRetryLoad}>Retry loading</button></>
              )}
            </span>
            <div className="legend">
              <span className="matched">Matched</span>
              <span className="needs_review">Review</span>
              <span className="conflict">Conflict</span>
            </div>
          </div>
        </section>

        <section className="workspace-reconciliation-results" aria-label="Reconciliation summary">
          <header className="reconciliation-results-header">
            <h2>RECONCILIATION RESULTS</h2>
            {resultsReady && results.run_id && <span>RUN <code>{results.run_id.slice(0, 8)}</code></span>}
          </header>
          {!resultsReady ? (
            <p className="reconciliation-results-empty" role={loading?.results.status === 'error' ? 'alert' : 'status'}>{resultMessage}</p>
          ) : hasCompletedResults ? (
            <>
              <dl className="reconciliation-results-metrics">
                <div className="matched"><dt>MATCHED</dt><dd>{matchedCount}</dd></div>
                <div className="needs_review"><dt>NEEDS REVIEW</dt><dd>{reviewCount}</dd></div>
                <div className="conflict"><dt>CONFLICT</dt><dd>{conflictCount}</dd></div>
                <div><dt>EVALUATED</dt><dd>{results.summary?.total_parcels ?? results.features.length}</dd></div>
              </dl>
              {selected ? (
                <>
                  <div className="reconciliation-selected-parcel">
                    <strong>{selected.properties.parcel_id}</strong>
                    <span className={`status ${selected.properties.status}`}>{selected.properties.status.replace('_', ' ').toUpperCase()}</span>
                    <span>{selected.properties.deterministic_confidence ?? selected.properties.confidence} / 100</span>
                    <span>{selected.properties.ml_rank != null ? `ML #${selected.properties.ml_rank}` : 'ML rank unavailable'}</span>
                    <span>{selected.properties.gnss_verified ? 'GNSS ✓' : 'GNSS unverified'}</span>
                  </div>
                  {contributions.length > 0 && (
                    <div className="reconciliation-contributions">
                      {contributions.map(({ label, value }) => (
                        <label key={label}>
                          <span>{label}</span>
                          <progress max={100} value={value} aria-label={`${label} contribution`} />
                          <small>{value} pts</small>
                        </label>
                      ))}
                    </div>
                  )}
                  <button className="reconciliation-evidence-action" onClick={() => {
                    setFullEvidence(true);
                    evidenceColumn.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                  }}>
                    VIEW FULL EVIDENCE <ArrowRight size={14} />
                  </button>
                </>
              ) : (
                <p className="reconciliation-results-prompt">Select a parcel on the map to inspect its reconciliation evidence.</p>
              )}
            </>
          ) : (
            <div className="reconciliation-results-empty">
              <strong>No completed harmonization run yet.</strong>
              <p>Run harmonization to generate reconciliation results.</p>
            </div>
          )}
        </section>
        </div>

        {/* Right Pane: Evidence Investigation Dossier */}
        <aside className="workspace-evidence-column" ref={evidenceColumn}>
          {selected ? (
            fullEvidence ? (
              <EvidencePanel feature={selected} onClose={() => setSelected(null)} />
            ) : (
              <aside className="evidence result-preview" aria-label="Parcel preview">
                <span className="eyebrow">SELECTED PARCEL</span>
                <h2>{selected.properties.parcel_id}</h2>
                <span className={`status ${selected.properties.status}`}>
                  {selected.properties.status.replace('_', ' ')}
                </span>
                <dl>
                  <dt>Deterministic confidence</dt>
                  <dd>{selected.properties.confidence} / 100</dd>
                  <dt>ML rank</dt>
                  <dd>{selected.properties.ml_rank ?? 'Not available'}</dd>
                  <dt>GNSS status</dt>
                  <dd>{selected.properties.gnss_verified ? 'Contained observation' : 'No contained observation'}</dd>
                </dl>
                <button className="primary" onClick={() => setFullEvidence(true)}>
                  View evidence
                </button>
                <button className="secondary" onClick={() => setSelected(null)}>
                  Clear selection
                </button>
              </aside>
            )
          ) : (
            <aside className="evidence run-overview-standby" aria-label="Run overview and parcel evidence">
              <div className="section-top">
                <div>
                  <span className="eyebrow">RUN OVERVIEW</span>
                  <h2>{isStagedDrone ? 'Staged Fixture' : 'Synthetic Benchmark'}</h2>
                </div>
                {results.run_id && (
                  <div className="overview-run-badge">
                    <code>{results.run_id.slice(0, 8)}</code>
                  </div>
                )}
              </div>

              <div className="run-overview-metric-grid">
                <div className="overview-metric-tile">
                  <strong className="metric-number">{resultsReady ? results.features.length : '—'}</strong>
                  <span className="metric-label">PARCELS EVALUATED</span>
                </div>
                <div className="overview-metric-tile">
                  <strong className="metric-number">{buildingCount}</strong>
                  <span className="metric-label">{isStagedDrone ? 'DRONE FOOTPRINTS' : 'BUILDING FOOTPRINTS'}</span>
                </div>
                <div className="overview-metric-tile">
                  <strong className="metric-number">{gnssCount}</strong>
                  <span className="metric-label">GNSS OBSERVATIONS</span>
                </div>
              </div>

              <div className="overview-card-section">
                <span className="eyebrow">ML CANDIDATE RANKING</span>
                <div className="overview-ml-box">
                  <div className="overview-ml-header">
                    <span className={`status-pill ${modelAvailable ? 'available' : 'unavailable'}`}>
                      {modelAvailable ? 'Available' : 'Unavailable'}
                    </span>
                    <span className="ml-engine-name">HistGradientBoosting</span>
                  </div>
                  <code className="ml-model-tag">{modelVersion}</code>
                  <p className="muted" style={{ fontSize: '10.5px', marginTop: '6px', lineHeight: 1.4 }}>
                    Ranker evaluates candidate correspondence when spatial building candidates exist.
                  </p>
                </div>
              </div>

              <div className="overview-card-section">
                <span className="eyebrow">RESULTS</span>
                <div className="overview-results-grid">
                  <div className="overview-result-chip matched">
                    <span className="result-chip-val">{matchedCount}</span>
                    <span className="result-chip-lbl">Matched</span>
                  </div>
                  <div className="overview-result-chip review">
                    <span className="result-chip-val">{reviewCount}</span>
                    <span className="result-chip-lbl">Needs review</span>
                  </div>
                  <div className="overview-result-chip conflict">
                    <span className="result-chip-val">{conflictCount}</span>
                    <span className="result-chip-lbl">Conflict</span>
                  </div>
                </div>
                {isStagedDrone && typeof conflictCount === 'number' && conflictCount > 0 && (
                  <p className="conflict-context-note" style={{ marginTop: '8px' }}>
                    Many conflict cases in this staged run have no available drone footprint candidate because the fixture contains only {buildingCount} building footprints.
                  </p>
                )}
              </div>

              <div className="overview-card-section select-guide-section">
                <div className="dossier-standby-icon">
                  <Crosshair size={20} />
                </div>
                <p className="select-prompt-text">
                  {resultsReady && results.features.length
                    ? 'Select a colored parcel on the map to inspect its individual evidence dossier, deterministic score, and ML candidate ranking.'
                    : resultMessage}
                </p>
              </div>
            </aside>
          )}
        </aside>
      </div>

    </div>
  );
}

export default function Workspace(props: {
  layers: Layers | null;
  results: Results;
  embedded?: boolean;
  controls?: WorkspaceControls;
  storyMode?: boolean;
}) {
  const [params, setParams] = useSearchParams();
  const real = params.get('mode') === 'real_world_reference';

  return (
    <div className={`workspace-root ${props.embedded ? 'is-embedded' : 'is-standalone'}`}>
      {/* Product Shell Top Bar: Mode Switcher + Study Area + CRS + Status */}
      <div className="workspace-shell-bar">
        <div className="workspace-shell-left">
          <WorkspaceModes
            mode={real ? 'real_world_reference' : 'synthetic_benchmark'}
            onChange={mode => {
              setParams({ mode });
              if (mode === 'synthetic_benchmark' && props.controls && props.controls.buildingSource !== 'buildings') {
                props.controls.setBuildingSource('buildings');
              }
            }}
          />
          <span className="workspace-shell-divider" />
          <span className="workspace-study-badge">
            {real ? 'Lalpur, Ahmedabad · Real-World Reference' : `${STUDY_AREA.name} · Reconciliation Benchmark`}
          </span>
        </div>
        <div className="workspace-shell-right">
          <span className="workspace-crs-tag">WGS84 / EPSG:4326</span>
          {props.results.run_id && (
            <span className="workspace-run-tag">
              RUN: <b>{props.results.run_id.slice(0, 8)}</b>
            </span>
          )}
          {props.embedded && (
            <Link to="/map" className="workspace-fullscreen-link" title="Open full-screen WebGIS workspace">
              Open Fullscreen <ArrowUpRight size={13} />
            </Link>
          )}
        </div>
      </div>

      <div hidden={real}>
        <SyntheticWorkspace {...props} />
      </div>
      {real && <ReferenceWorkspace embedded={props.embedded} />}
    </div>
  );
}
