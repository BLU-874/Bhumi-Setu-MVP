import { useEffect, useState } from 'react';
import { ArrowRight, Check, LoaderCircle, RotateCcw, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Results, Run, Source } from '../types';

export type RunControls = {
  sources: Source[];
  buildingSource: string;
  setBuildingSource: (id: string) => void;
  running: boolean;
  run: Run | null;
  onRun: () => Promise<void>;
  onClearResults?: () => void;
  error: string;
};

const stages = [
  'Normalizing sources',
  'Generating candidates',
  'Matching geometry',
  'Comparing attributes',
  'ML ranking',
  'Detecting conflicts'
];

export default function RunControl({
  controls,
  results,
  embedded = false
}: {
  controls: RunControls;
  results: Results;
  embedded?: boolean;
}) {
  const { sources, buildingSource, setBuildingSource, running, run, onRun, onClearResults, error } = controls;
  const [stage, setStage] = useState(0);
  const [showRerunModal, setShowRerunModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);

  useEffect(() => {
    setStage(0);
    if (!running) return;
    const id = setInterval(() => setStage(i => Math.min(i + 1, stages.length - 1)), 900);
    return () => clearInterval(id);
  }, [running]);

  const summary = results.summary;
  const built = sources.find(s => s.id === buildingSource);
  const isStagedDrone = buildingSource !== 'buildings' || built?.source_type === 'ai_derived_drone_footprint' || built?.demonstration === true;
  const buildingCount = buildingSource === 'buildings' ? 475 : (built?.feature_count ?? 6);
  const canRun = !!built && sources.some(s => s.id === 'cadastral') && sources.some(s => s.id === 'gnss');
  const hasCompletedForSource = !!summary && !!results.run_id && ((run?.source_ids?.buildings || 'buildings') === buildingSource);

  const handleConfirmRerun = async () => {
    setShowRerunModal(false);
    await onRun();
  };

  const handleConfirmClear = () => {
    setShowClearModal(false);
    if (onClearResults) {
      onClearResults();
    }
  };

  return (
    <div className="run-control-panel" aria-label="Harmonization controls">
      <div className="harmonization-panel-header">
        <span className="eyebrow">RECONCILIATION</span>
        <h3>HARMONIZATION</h3>
      </div>

      {/* Dataset Mode Context Card */}
      <div className="dataset-mode-context-card">
        <span className="dataset-context-kicker">DATASET MODE</span>
        <h4 className="dataset-context-title">
          {isStagedDrone ? 'STAGED DRONE FIXTURE' : 'SYNTHETIC BENCHMARK'}
        </h4>
        <p className="dataset-context-desc">
          {isStagedDrone
            ? 'Synthetic cadastral benchmark + 6-feature drone demonstration'
            : 'Full 475-feature synthetic benchmark evaluation'}
        </p>
        <div className="dataset-context-purpose">
          <b>Purpose:</b>{' '}
          {isStagedDrone
            ? 'Demonstrate drone-footprint provenance and ML candidate ranking.'
            : 'Evaluate full synthetic cadastral correspondence and conflict detection.'}
        </div>
        <small className="dataset-context-disclaimer">
          {isStagedDrone
            ? '6 drone-derived demonstration footprints · Synthetic demonstration context'
            : 'Synthetic benchmark · Not official cadastral records'}
        </small>
      </div>

      {/* 1. Source Status */}
      <div className="source-set-block">
        <span className="source-block-label">SOURCE SET</span>
        <div className="source-status-stack">
          <div className="source-status-row">
            <span className="status-indicator ready"><Check size={12} /></span>
            <div className="source-status-meta">
              <b>Cadastral</b>
              <small>500 parcels</small>
            </div>
          </div>
          <div className="source-status-row">
            <span className="status-indicator ready"><Check size={12} /></span>
            <div className="source-status-meta">
              <b>Building footprints</b>
              <small>{buildingSource === 'buildings' ? '475 features' : `${built?.feature_count ?? 6} features`}</small>
            </div>
          </div>
          <div className="source-status-row">
            <span className="status-indicator ready"><Check size={12} /></span>
            <div className="source-status-meta">
              <b>GNSS observations</b>
              <small>350 points</small>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Building Source Selector */}
      <details className="building-source-details" open={buildingSource !== 'buildings'}>
        <summary className="source-picker-summary">
          <span>Source options: {built?.name ?? 'Synthetic Benchmark Buildings'}</span>
        </summary>
        <div className="building-source-field">
          <label className="select-label" htmlFor="building-source-select">
            Building source
            <select
              id="building-source-select"
              value={buildingSource}
              disabled={running}
              aria-label="Building source"
              onChange={e => setBuildingSource(e.target.value)}
            >
              {sources.filter(s => s.kind === 'buildings').map(s => (
                <option key={s.id} value={s.id}>
                  {s.id === 'buildings'
                    ? 'Synthetic Benchmark Buildings (475)'
                    : `Staged Drone Fixture (${s.feature_count ?? 6})`}
                </option>
              ))}
            </select>
          </label>
          <span className="source-hint">
            {buildingSource === 'buildings'
              ? 'Full 475-feature synthetic benchmark'
              : 'Optional 6-feature demonstration subset'}
          </span>
        </div>
      </details>

      {/* 3. Action / Result Section */}
      <div className="harmonization-action-section">
        {running ? (
          <div className="run-progress-box" role="status">
            <div className="run-progress-head">
              <LoaderCircle size={14} className="spin" />
              <span>Processing engine</span>
            </div>
            <ol className="run-stages-list">
              {stages.map((name, i) => (
                <li key={name} className={i === stage ? 'active' : i < stage ? 'done' : ''}>
                  {i < stage ? <Check size={10} /> : i === stage ? <span className="stage-pulse" /> : null}
                  {name}
                </li>
              ))}
            </ol>
          </div>
        ) : hasCompletedForSource ? (
          <div className="completed-summary-box">
            <div className="completed-badge">
              <CheckCircle2 size={13} /> RECONCILIATION COMPLETE
            </div>
            <div className="run-scope-metrics">
              <span><b>{results.features.length}</b> parcels evaluated</span>
              <span><b>{buildingCount}</b> candidate building footprints available</span>
            </div>
            <div className="compact-counts-row">
              <div className="count-chip matched">
                <strong>{summary.matched}</strong>
                <span>MATCHED</span>
              </div>
              <div className="count-chip review">
                <strong>{summary.needs_review}</strong>
                <span>NEEDS REVIEW</span>
              </div>
              <div className="count-chip conflict">
                <strong>{summary.conflict}</strong>
                <span>CONFLICT</span>
              </div>
            </div>
            {isStagedDrone && summary.conflict > 0 && (
              <p className="conflict-context-note">
                Conflict counts include parcels for which the selected source set produced no matching footprint candidate. In this staged run, the demonstration fixture contains only {buildingCount} building footprints.
              </p>
            )}
            <div className="saved-run-ref">
              Saved run: <code>{results.run_id?.slice(0, 8)}</code>
            </div>

            <div className="completed-actions-stack">
              <Link className="primary action-btn-full" to="/review">
                Review results <ArrowRight size={15} />
              </Link>

              <button
                type="button"
                className="secondary action-btn-full rerun-action"
                disabled={running || !canRun}
                onClick={() => setShowRerunModal(true)}
              >
                <RotateCcw size={13} /> Run Again
              </button>

              {onClearResults && (
                <button
                  type="button"
                  className="clear-action-btn"
                  disabled={running}
                  onClick={() => setShowClearModal(true)}
                >
                  <Trash2 size={12} /> Clear Results
                </button>
              )}
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="primary action-btn-full"
            disabled={running || !canRun}
            onClick={() => void onRun()}
          >
            Run Harmonization <ArrowRight size={15} />
          </button>
        )}

        {error && !running && (
          <p className="warning-text" role="alert" style={{ fontSize: '10px', marginTop: '10px' }}>
            {error}
          </p>
        )}
      </div>

      {/* Rerun Confirmation Modal */}
      {showRerunModal && (
        <div className="run-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="rerun-dialog-title">
          <div className="run-dialog">
            <div className="dialog-header">
              <h4 id="rerun-dialog-title">Run harmonization again?</h4>
            </div>
            <p className="dialog-body">
              Current results will be replaced in the workspace. Previous run records remain available in the audit trail.
            </p>
            <div className="dialog-actions">
              <button
                type="button"
                className="secondary dialog-btn"
                onClick={() => setShowRerunModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary dialog-btn"
                onClick={() => void handleConfirmRerun()}
              >
                Run Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Confirmation Modal */}
      {showClearModal && (
        <div className="run-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="clear-dialog-title">
          <div className="run-dialog">
            <div className="dialog-header" style={{ color: '#C44747' }}>
              <AlertTriangle size={18} />
              <h4 id="clear-dialog-title">Clear current harmonization results?</h4>
            </div>
            <p className="dialog-body">
              Historical runs and audit records will remain available. The workspace will return to the pre-run state.
            </p>
            <div className="dialog-actions">
              <button
                type="button"
                className="secondary dialog-btn"
                onClick={() => setShowClearModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="danger-btn dialog-btn"
                onClick={handleConfirmClear}
              >
                Clear Results
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
