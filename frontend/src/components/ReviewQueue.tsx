import { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, ShieldCheck, LoaderCircle, ArrowRight, FileText, ClipboardList, Download, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ReviewCase, Layers, Results, AuditEvent } from '../types';
import { api } from '../services/api';
import MapView from './MapView';
import ReviewEvidenceStory from './ReviewEvidenceStory';
import DecisionRecordModal from './DecisionRecordModal';
import FieldVerificationModal from './FieldVerificationModal';
import { exportDecisionRecordJSON, exportDecisionRecordCSV, printDecisionRecord } from '../utils/exportDecisionRecord';

export default function ReviewQueue({
  runId,
  layers,
  embedded = false,
  onDecision
}: {
  runId: string | null;
  layers?: Layers | null;
  embedded?: boolean;
  onDecision?: () => void;
}) {
  const [cases, setCases] = useState<ReviewCase[]>([]);
  const [selected, setSelected] = useState<ReviewCase | null>(null);
  const [filter, setFilter] = useState('pending');
  const [reviewer, setReviewer] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [auditError, setAuditError] = useState('');

  // Phase 7 state
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const generation = useRef(0);

  const load = async () => {
    const token = ++generation.current;
    if (!runId) {
      setCases([]);
      setSelected(null);
      return;
    }
    setLoading(true);
    try {
      const response = await api.reviewCases(runId);
      if (token !== generation.current) return;
      setCases(response.cases);
      setSelected((old) => (old ? response.cases.find((c) => c.id === old.id) || null : null));
      setError('');
    } catch (e) {
      if (token === generation.current) setError((e as Error).message);
    } finally {
      if (token === generation.current) setLoading(false);
    }
  };

  useEffect(() => {
    setCases([]);
    setSelected(null);
    setMessage('');
    setNote('');
    setShowDecisionModal(false);
    setShowVerificationModal(false);
    setExportMenuOpen(false);
    void load();
    return () => {
      generation.current++;
    };
  }, [runId]);

  const refreshAudit = () => {
    if (selected?.run_id === runId && selected?.record_id) {
      api.audit(runId || undefined, selected.record_id)
        .then((r) => setEvents(r.events))
        .catch((e) => setAuditError((e as Error).message));
    }
  };

  useEffect(() => {
    let active = true;
    setEvents([]);
    setAuditError('');
    if (selected?.run_id === runId) {
      api.audit(runId || undefined, selected.record_id)
        .then((r) => {
          if (active) setEvents(r.events);
        })
        .catch((e) => {
          if (active) setAuditError((e as Error).message);
        });
    }
    return () => {
      active = false;
    };
  }, [runId, selected?.id, selected?.version]);

  const visible = useMemo(
    () => cases.filter((c) => c.run_id === runId && (filter === 'all' || c.status === filter)),
    [cases, runId, filter]
  );

  const current = selected?.run_id === runId ? selected : null;

  const choose = (item: ReviewCase) => {
    if (busy) return;
    setSelected(item);
    setNote('');
    setMessage('');
    setError('');
    setExportMenuOpen(false);
  };

  const mapCases = useMemo(
    () => (current && !visible.some((c) => c.id === current.id) ? [...visible, current] : visible),
    [current, visible]
  );

  const mapResults = useMemo<Results>(
    () => ({
      type: 'FeatureCollection',
      run_id: runId,
      summary: null,
      features: mapCases.map((c) => ({
        ...c.feature,
        properties: { ...c.feature.properties, decision_status: c.status }
      }))
    }),
    [mapCases, runId]
  );

  const selectedFeature = current
    ? mapResults.features.find((f) => f.properties.parcel_id === current.record_id) || null
    : null;

  const submit = async (decision: 'accept' | 'reject' | 'investigate') => {
    if (!current || busy) return;
    if (!reviewer.trim()) {
      setError('Enter a reviewer identifier before saving.');
      return;
    }
    const token = generation.current;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const updated = await api.decide(current.id, {
        decision,
        reviewer: reviewer.trim(),
        note: note || null,
        expected_version: current.version
      });
      if (token !== generation.current) return;
      setCases((all) => all.map((c) => (c.id === updated.id ? updated : c)));
      setSelected(updated);
      setMessage('Decision persisted to the backend and added to the audit trail.');
      setNote('');
      onDecision?.();
    } catch (e) {
      if (token === generation.current) setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`review-experience ${embedded ? 'embedded-review' : ''}`} aria-label="Human review workspace">
      <div className="section-top review-section-top">
        <div>
          <span className="eyebrow">HUMAN-IN-THE-LOOP</span>
          <h2>Review queue</h2>
          <p>Choose a parcel on the map. Inspect the evidence, then record a decision.</p>
        </div>
        <button className="secondary" disabled={busy || loading} onClick={() => void load()} aria-label="Refresh review queue">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {!runId ? (
        <p className="empty-review">Run harmonization to create review cases.</p>
      ) : (
        <>
          <div className="review-filters">
            {['pending', 'investigating', 'resolved', 'all'].map((s) => (
              <button
                key={s}
                aria-pressed={filter === s}
                className={filter === s ? 'active' : ''}
                disabled={busy}
                onClick={() => setFilter(s)}
              >
                {s === 'all' ? 'All' : s} <b>{s === 'all' ? cases.length : cases.filter((c) => c.status === s).length}</b>
              </button>
            ))}
          </div>

          {loading && <p role="status">Loading persisted cases...</p>}

          <div className="review-layout map-review-layout">
            <section className="review-map-column">
              {layers && (
                <div className="review-map" aria-label="Review parcels map">
                  <MapView
                    layers={layers}
                    results={mapResults}
                    selected={selectedFeature}
                    visible={{ cadastral: true, buildings: true, gnss: true, results: true, droneBuildings: true }}
                    onSelect={(f) => {
                      const c = mapCases.find((item) => item.record_id === f.properties.parcel_id);
                      if (c) choose(c);
                    }}
                  />
                </div>
              )}
              <p className="review-map-caption">
                SYNTHETIC BENCHMARK / URBAN SATELLITE CONTEXT · Land parcels requiring human verification. Green: matched · Amber: needs review · Red: conflict · Teal outline: selected case · Dashed outline: decision recorded.
              </p>
              <div className="case-list" aria-label="Review case selection">
                {visible.map((c) => (
                  <button
                    disabled={busy}
                    className={`case-row ${current?.id === c.id ? 'selected' : ''}`}
                    key={c.id}
                    onClick={() => choose(c)}
                  >
                    <span>
                      <b>{c.record_id}</b>
                      <small>
                        {c.feature.properties.matched_footprint_id || 'No candidate'} / {c.feature.properties.confidence}% confidence
                      </small>
                    </span>
                    <span className={`status ${c.feature.properties.status}`}>
                      {c.status === 'resolved' ? c.decision : c.status}
                    </span>
                  </button>
                ))}
                {!loading && !visible.length && <p className="empty-review">No cases in this view.</p>}
              </div>
            </section>

            <section className="panel review-detail" aria-label="Review evidence story">
              {current ? (
                <>
                  <div className="section-top review-case-header">
                    <div>
                      <span className="eyebrow">REVIEW CASE</span>
                      <h2>{current.record_id}</h2>
                      <p>Survey {String(current.feature.properties.cadastral.survey_no || 'not supplied')}</p>
                    </div>
                    <div className="review-case-badges">
                      <span className={`status ${current.feature.properties.status}`}>
                        {current.status === 'resolved' ? current.decision : current.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  <div className="review-case-scorecard">
                    <div className="scorecard-stat">
                      <span>CONFIDENCE</span>
                      <strong>
                        {current.feature.properties.confidence}
                        <small>/ 100</small>
                      </strong>
                    </div>
                    <div className="scorecard-meta">
                      <span>ENGINE PROPOSAL</span>
                      <b>{current.feature.properties.status.replace('_', ' ').toUpperCase()}</b>
                      <small>{current.status === 'resolved' ? `Recorded: ${current.decision}` : `Status: ${current.status}`}</small>
                    </div>
                  </div>

                  <ReviewEvidenceStory item={current} />

                  {/* Primary Action: Human Decision */}
                  <div className="review-form">
                    <h3>Human decision</h3>
                    <label>
                      Reviewer identifier
                      <input
                        maxLength={120}
                        value={reviewer}
                        onChange={(e) => setReviewer(e.target.value)}
                        placeholder="e.g. officer-01"
                        disabled={busy}
                      />
                    </label>
                    <label>
                      Note or reason
                      <textarea
                        maxLength={2000}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Optional context for the decision"
                        disabled={busy}
                      />
                    </label>
                    <div className="decision-actions">
                      {(['accept', 'reject', 'investigate'] as const).map((decision) => (
                        <button
                          key={decision}
                          className={`decision ${decision}`}
                          disabled={busy || current.status === 'resolved'}
                          onClick={() => void submit(decision)}
                        >
                          {decision[0].toUpperCase() + decision.slice(1)}
                        </button>
                      ))}
                      {busy && <LoaderCircle className="spin" size={18} />}
                    </div>
                  </div>

                  {message && (
                    <div className="decision-confirmation" role="status">
                      <b>Decision recorded</b>
                      <p>{message}</p>
                    </div>
                  )}

                  {current.decision && (
                    <div className="persisted-note">
                      <ShieldCheck size={16} />
                      <span>
                        <b>{current.decision}</b> by {current.reviewer} on{' '}
                        {current.decided_at ? new Date(current.decided_at).toLocaleString() : ''}
                        {current.note && <small>{current.note}</small>}
                      </span>
                    </div>
                  )}

                  {/* PHASE 7: Subordinate Secondary Actions (only after decision exists) */}
                  {current.decision && (
                    <div className="post-decision-section" aria-label="Administrative follow-up actions">
                      <div className="post-decision-header">
                        <span className="post-decision-tag">ADMINISTRATIVE ACTION</span>
                      </div>
                      <div className="post-decision-actions">
                        <button
                          type="button"
                          className="secondary post-action-btn"
                          onClick={() => setShowDecisionModal(true)}
                          aria-label="View decision record"
                        >
                          <FileText size={14} /> View decision record
                        </button>

                        <button
                          type="button"
                          className="secondary post-action-btn"
                          onClick={() => setShowVerificationModal(true)}
                          aria-label="Field verification"
                        >
                          <ClipboardList size={14} /> Field verification
                        </button>

                        <div className="export-menu-container">
                          <button
                            type="button"
                            className="secondary post-action-btn"
                            onClick={() => setExportMenuOpen(!exportMenuOpen)}
                            aria-expanded={exportMenuOpen}
                            aria-label="Export record options"
                          >
                            <Download size={14} /> Export record <ChevronDown size={12} />
                          </button>
                          {exportMenuOpen && (
                            <div className="export-menu-dropdown">
                              <button
                                type="button"
                                onClick={() => {
                                  setExportMenuOpen(false);
                                  exportDecisionRecordJSON(current, events[0]);
                                }}
                              >
                                Download JSON
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setExportMenuOpen(false);
                                  exportDecisionRecordCSV(current, events[0]);
                                }}
                              >
                                Download CSV
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setExportMenuOpen(false);
                                  printDecisionRecord(current, events[0]);
                                }}
                              >
                                Print / PDF Record
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {events[0] && (
                    <div className="decision-receipt">
                      <h3>Latest audit event</h3>
                      <dl>
                        <dt>Reviewer</dt>
                        <dd>{events[0].actor}</dd>
                        <dt>Timestamp</dt>
                        <dd>{new Date(events[0].timestamp).toLocaleString()}</dd>
                        <dt>Previous status</dt>
                        <dd>{String(events[0].before.status ?? 'Not supplied')}</dd>
                        <dt>New status</dt>
                        <dd>{String(events[0].after.status ?? 'Not supplied')}</dd>
                        <dt>Reviewer note</dt>
                        <dd>{String(events[0].after.note ?? 'No note supplied')}</dd>
                      </dl>
                    </div>
                  )}

                  {auditError && <p role="alert">Audit retrieval failed: {auditError}. Use the audit section to retry.</p>}

                  {embedded ? (
                    <a className="continue-review" href="#audit-trail">
                      View audit trail <ArrowRight size={16} />
                    </a>
                  ) : (
                    <Link className="continue-review" to="/audit">
                      View audit trail <ArrowRight size={16} />
                    </Link>
                  )}
                </>
              ) : (
                <div className="empty-review empty-review-guided">
                  <div className="empty-review-icon">
                    <ShieldCheck size={24} />
                  </div>
                  <h2>SELECT A REVIEW CASE</h2>
                  <p>Select a highlighted parcel on the map or from the queue list to inspect:</p>
                  <ul className="empty-review-checklist">
                    <li>
                      <span>Spatial evidence (IoU &amp; geometry overlap)</span>
                    </li>
                    <li>
                      <span>Attribute evidence (survey &amp; owner)</span>
                    </li>
                    <li>
                      <span>GNSS observation &amp; containment</span>
                    </li>
                    <li>
                      <span>Validation flags &amp; ML ranking</span>
                    </li>
                  </ul>
                  <p className="empty-review-note">Then record a decision (Accept, Reject, or Investigate) to persist in the audit trail.</p>
                </div>
              )}

              {error && (
                <div className="warning-text form-message" role="alert">
                  {error}
                  <p>If another reviewer changed the case, refresh the review queue and inspect its latest version before deciding again.</p>
                </div>
              )}
            </section>
          </div>
        </>
      )}

      {/* Decision Record Modal */}
      {showDecisionModal && current && (
        <DecisionRecordModal
          reviewCase={current}
          auditEvents={events}
          onClose={() => setShowDecisionModal(false)}
          onAuditLogged={() => {
            refreshAudit();
            onDecision?.();
          }}
        />
      )}

      {/* Field Verification Modal */}
      {showVerificationModal && current && (
        <FieldVerificationModal
          reviewCase={current}
          onClose={() => setShowVerificationModal(false)}
          onAuditLogged={() => {
            refreshAudit();
            onDecision?.();
          }}
        />
      )}
    </div>
  );
}
