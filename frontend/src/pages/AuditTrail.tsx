import { useEffect, useRef, useState } from 'react';
import {
  History,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  Download,
  FileText,
  FileSpreadsheet,
  Printer,
  X,
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  AlertOctagon,
  HelpCircle,
  ChevronRight
} from 'lucide-react';
import type { AuditEvent } from '../types';
import { api } from '../services/api';
import { exportAuditAsJSON, exportAuditAsCSV, printAuditRecord } from '../utils/exportAudit';

const isNote = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

export default function AuditTrail({
  runId,
  embedded = false,
  refreshKey = 0
}: {
  runId: string | null;
  embedded?: boolean;
  refreshKey?: number;
}) {
  const Heading = embedded ? 'h2' : 'h1';
  const requestId = useRef(0);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [error, setError] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [exportDropdown, setExportDropdown] = useState(false);

  const load = async () => {
    const id = ++requestId.current;
    try {
      const response = await (embedded && !runId ? Promise.resolve({ events: [], total: 0 }) : api.audit(runId || undefined));
      if (id === requestId.current) {
        setEvents(response.events);
        setError('');
      }
    } catch (e) {
      if (id === requestId.current) setError((e as Error).message);
    }
  };

  useEffect(() => {
    setEvents([]);
    void load();
    return () => {
      requestId.current++;
    };
  }, [runId, refreshKey]);

  const p = selectedEvent?.record?.properties;
  const candidate = p?.ml_candidates?.[0];

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">DECISION HISTORY & AUDITABILITY</span>
          <Heading>Audit trail</Heading>
          <p>
            Append-only human decisions from the active backend persistence layer. Historical runs and records remain permanently immutable.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button type="button" className="secondary" onClick={() => void load()}>
            <RefreshCw size={14} /> Refresh
          </button>
          {events.length > 0 && (
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="secondary"
                onClick={() => setExportDropdown(!exportDropdown)}
                style={{ fontWeight: 600 }}
              >
                <Download size={14} /> Export Run ▾
              </button>
              {exportDropdown && (
                <div
                  className="export-dropdown-menu"
                  onMouseLeave={() => setExportDropdown(false)}
                >
                  <button
                    type="button"
                    onClick={() => {
                      exportAuditAsJSON(events, `bhumi-setu-audit-${runId?.slice(0, 8) || 'all'}.json`);
                      setExportDropdown(false);
                    }}
                  >
                    <FileText size={13} /> Export Run JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      exportAuditAsCSV(events, `bhumi-setu-audit-${runId?.slice(0, 8) || 'all'}.csv`);
                      setExportDropdown(false);
                    }}
                  >
                    <FileSpreadsheet size={13} /> Export Run CSV
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <section className="panel audit-panel">
        <div className="section-top">
          <div>
            <h2>Review events</h2>
            <span className="muted">{events.length} recorded immutable decisions</span>
          </div>
          <History size={22} color="#005F63" />
        </div>

        {events.length ? (
          <div className="audit-table-wrapper">
            <table className="audit-table" aria-label="Historical audit trail events">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Run ID</th>
                  <th>Record</th>
                  <th>Action</th>
                  <th>Reviewer</th>
                  <th>Decision Note</th>
                  <th>Timestamp</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {events.map(e => {
                  const actionName = e.action.replace('review.', '').toLowerCase();
                  const badgeClass =
                    actionName === 'accept'
                      ? 'accepted'
                      : actionName === 'reject'
                      ? 'rejected'
                      : 'investigate';
                  return (
                    <tr
                      key={e.id}
                      role="article"
                      onClick={() => setSelectedEvent(e)}
                      className={selectedEvent?.id === e.id ? 'selected-row' : ''}
                      style={{ cursor: 'pointer' }}
                    >
                      <td><code>#{e.id}</code></td>
                      <td><code>{e.run_id ? e.run_id.slice(0, 8) : '—'}</code></td>
                      <td><b>{e.record_id}</b></td>
                      <td>
                        <span className={`decision-badge ${badgeClass}`}>
                          {actionName === 'accept' && <CheckCircle2 size={11} />}
                          {actionName === 'reject' && <XCircle size={11} />}
                          {actionName === 'investigate' && <AlertTriangle size={11} />}
                          {actionName.toUpperCase()}
                        </span>
                      </td>
                      <td>{e.actor}</td>
                      <td className="note-cell">{isNote(e.after?.note) ? `“${e.after.note}”` : '—'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{new Date(e.timestamp).toLocaleString()}</td>
                      <td>
                        <button
                          type="button"
                          className="inspect-btn"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            setSelectedEvent(e);
                          }}
                        >
                          Inspect <ChevronRight size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-review">
            <History size={26} />
            <h2>No human decisions recorded yet.</h2>
            <p>Decisions made in the Review Queue are permanently recorded in this append-only audit trail.</p>
          </div>
        )}
      </section>

      {/* Detailed Inspection Drawer / Modal */}
      {selectedEvent && (
        <div className="audit-detail-overlay" role="dialog" aria-modal="true">
          <div className="audit-detail-modal">
            <div className="audit-modal-head">
              <div>
                <span className="eyebrow">AUDIT RECORD INSPECTION</span>
                <h3>Record: {selectedEvent.record_id}</h3>
                <small>Run {selectedEvent.run_id?.slice(0, 8)} · Event #{selectedEvent.id}</small>
              </div>

              <div className="modal-head-actions">
                <button
                  type="button"
                  className="secondary btn-sm"
                  onClick={() => exportAuditAsJSON(selectedEvent, `audit-record-${selectedEvent.record_id}.json`)}
                  title="Export record as JSON"
                >
                  <FileText size={13} /> JSON
                </button>
                <button
                  type="button"
                  className="secondary btn-sm"
                  onClick={() => exportAuditAsCSV([selectedEvent], `audit-record-${selectedEvent.record_id}.csv`)}
                  title="Export record as CSV"
                >
                  <FileSpreadsheet size={13} /> CSV
                </button>
                <button
                  type="button"
                  className="primary btn-sm"
                  onClick={() => printAuditRecord(selectedEvent)}
                  title="Print / Save PDF decision record"
                >
                  <Printer size={13} /> Print / PDF
                </button>
                <button
                  type="button"
                  className="close-modal-btn"
                  onClick={() => setSelectedEvent(null)}
                  aria-label="Close detail inspection"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="audit-modal-scroll">
              {/* 1. Decision */}
              <div className="audit-section-card">
                <h4>1. Human Review Decision</h4>
                <div className="decision-receipt-block">
                  <div className="receipt-outcome">
                    <span className="receipt-label">DECISION TAKEN</span>
                    <b className={`status-badge-lg ${String(selectedEvent.after?.decision || selectedEvent.action)}`}>
                      {String(selectedEvent.after?.decision || selectedEvent.action).toUpperCase()}
                    </b>
                  </div>
                  <div className="receipt-meta">
                    <div>
                      <span>Reviewer:</span> <b>{selectedEvent.actor}</b>
                    </div>
                    <div>
                      <span>Recorded at:</span> <b>{new Date(selectedEvent.timestamp).toLocaleString()}</b>
                    </div>
                    <div>
                      <span>Version:</span> <b>v{String(selectedEvent.before?.version ?? 0)} → v{String(selectedEvent.after?.version ?? 1)}</b>
                    </div>
                  </div>
                </div>
                {isNote(selectedEvent.after?.note) && (
                  <div className="audit-note-box">
                    <span>Officer Justification / Note:</span>
                    <p>“{selectedEvent.after.note}”</p>
                  </div>
                )}
              </div>

              {/* 2. Identity */}
              <div className="audit-section-card">
                <h4>2. Identity & Cross-References</h4>
                <dl className="audit-data-grid">
                  <div><dt>Record ID</dt><dd>{selectedEvent.record_id}</dd></div>
                  <div><dt>Parcel ID</dt><dd>{p?.parcel_id || selectedEvent.record_id}</dd></div>
                  <div><dt>Survey Number</dt><dd>{String(p?.cadastral?.['survey_no'] || 'SR-1001')}</dd></div>
                  <div><dt>Run ID</dt><dd><code>{selectedEvent.run_id}</code></dd></div>
                  <div><dt>Project ID</dt><dd>{selectedEvent.project_id}</dd></div>
                </dl>
              </div>

              {/* 3. Source Provenance */}
              <div className="audit-section-card">
                <h4>3. Source Provenance</h4>
                <dl className="audit-data-grid">
                  <div><dt>Cadastral Source</dt><dd>cadastral (Pune Cadastral Survey, 500 parcels)</dd></div>
                  <div><dt>Building Footprint Source</dt><dd>{String(selectedEvent.run?.['source_ids'] ? (selectedEvent.run['source_ids'] as Record<string, string>)['buildings'] : 'buildings')} ({String(p?.footprint_properties?.['source'] || 'Synthetic Building Footprints')})</dd></div>
                  <div><dt>GNSS Source</dt><dd>gnss (350 field observations)</dd></div>
                  <div><dt>Dataset Mode</dt><dd>Synthetic Benchmark Dataset</dd></div>
                </dl>
              </div>

              {/* 4. Geospatial Evidence */}
              <div className="audit-section-card">
                <h4>4. Geospatial Evidence</h4>
                <dl className="audit-data-grid">
                  <div><dt>Geometry Overlap (IoU)</dt><dd>{p?.geometry_overlap_pct != null ? `${p.geometry_overlap_pct}%` : '—'}</dd></div>
                  <div><dt>Centroid Distance</dt><dd>{candidate?.features?.centroid_distance_m != null ? (candidate.features.centroid_distance_m < 0.001 ? '< 0.01 m' : `${candidate.features.centroid_distance_m.toFixed(2)} m`) : '—'}</dd></div>
                  <div><dt>Boundary Distance</dt><dd>{candidate?.features?.boundary_distance_m != null ? `${candidate.features.boundary_distance_m.toFixed(3)} m` : '—'}</dd></div>
                  <div><dt>Geometry Validity</dt><dd>{p?.geometry_quality?.result_valid ? 'Valid Polygon' : 'Invalid'}</dd></div>
                  <div><dt>Geometry Repair Status</dt><dd>{p?.geometry_quality?.repaired ? 'Repaired' : 'Original valid'}</dd></div>
                  <div><dt>Analysis CRS</dt><dd>EPSG:32643 (UTM Zone 43N metric)</dd></div>
                </dl>
              </div>

              {/* 5. Attribute Evidence */}
              <div className="audit-section-card">
                <h4>5. Attribute Evidence</h4>
                <dl className="audit-data-grid">
                  <div><dt>Survey Number Similarity</dt><dd>{p?.attribute_evidence?.survey_no ? `${p.attribute_evidence.survey_no.similarity_pct}%` : '—'}</dd></div>
                  <div><dt>Owner Name Similarity</dt><dd>{p?.attribute_evidence?.owner ? `${p.attribute_evidence.owner.similarity_pct}%` : '—'}</dd></div>
                  <div><dt>Cadastral Area</dt><dd>{p?.cadastral?.['area_sqm'] != null ? `${p.cadastral['area_sqm']} m²` : '—'}</dd></div>
                  <div><dt>Building Footprint Area</dt><dd>{p?.footprint_properties?.['areaSqM'] != null ? `${p.footprint_properties['areaSqM']} m²` : '—'}</dd></div>
                  <div><dt>Composite Attribute Match</dt><dd>{p?.attribute_match_pct != null ? `${p.attribute_match_pct}%` : '—'}</dd></div>
                </dl>
              </div>

              {/* 6. GNSS Evidence */}
              <div className="audit-section-card">
                <h4>6. GNSS Evidence</h4>
                <dl className="audit-data-grid">
                  <div><dt>GNSS Observation ID</dt><dd>{p?.gnss_point_id || 'None'}</dd></div>
                  <div><dt>Containment Status</dt><dd>{p?.gnss_verified ? 'Contained observation verified' : 'No contained observation'}</dd></div>
                  <div><dt>Survey Cross-Match</dt><dd>{p?.validation?.['gnss_related_survey_matches'] ? 'Matches parcel survey' : 'N/A'}</dd></div>
                </dl>
              </div>

              {/* 7. ML Evidence */}
              <div className="audit-section-card">
                <h4>7. Machine Learning Assessment</h4>
                <dl className="audit-data-grid">
                  <div><dt>Ranker Model</dt><dd>{p?.model_version || 'synthetic-hgb-v1'}</dd></div>
                  <div><dt>Ranked Candidate</dt><dd>{p?.ml_ranked_candidate_id || p?.matched_footprint_id || '—'}</dd></div>
                  <div><dt>ML Rank</dt><dd>#{p?.ml_rank ?? 1}</dd></div>
                  <div><dt>ML Probability</dt><dd>{p?.ml_match_probability != null ? `${(p.ml_match_probability * 100).toFixed(2)}%` : '—'}</dd></div>
                </dl>
              </div>

              {/* 8. Deterministic Decision & Weights */}
              <div className="audit-section-card">
                <h4>8. Deterministic Decision & Rules</h4>
                <dl className="audit-data-grid">
                  <div><dt>Deterministic Confidence</dt><dd>{p?.confidence != null ? `${p.confidence} / 100` : '—'}</dd></div>
                  <div><dt>Scoring Policy</dt><dd>65% Geometry + 35% Attributes + GNSS Boost (up to 8 pts)</dd></div>
                  <div><dt>Geometry Contribution</dt><dd>{p?.confidence_explanation?.geometry_contribution != null ? `${p.confidence_explanation.geometry_contribution} pts` : '—'}</dd></div>
                  <div><dt>Attribute Contribution</dt><dd>{p?.confidence_explanation?.attribute_contribution != null ? `${p.confidence_explanation.attribute_contribution} pts` : '—'}</dd></div>
                  <div><dt>GNSS Boost</dt><dd>{p?.confidence_explanation?.gnss_boost != null ? `+${p.confidence_explanation.gnss_boost} pts` : '—'}</dd></div>
                  <div><dt>Proposed Status</dt><dd>{p?.status?.toUpperCase() || '—'}</dd></div>
                  <div><dt>Validation Flags</dt><dd>{p?.validation_flags?.length ? p.validation_flags.join(', ') : 'None (clean pass)'}</dd></div>
                </dl>
              </div>

              {/* 9. Run Metadata */}
              <div className="audit-section-card">
                <h4>9. Run Metadata</h4>
                <dl className="audit-data-grid">
                  <div><dt>Harmonization Run ID</dt><dd><code>{selectedEvent.run_id}</code></dd></div>
                  <div><dt>Engine</dt><dd>Bhumi-Setu MVP Reconciliation Engine v0.1.0</dd></div>
                  <div><dt>Event ID</dt><dd>#{selectedEvent.id}</dd></div>
                  <div><dt>Timestamp</dt><dd>{new Date(selectedEvent.timestamp).toISOString()}</dd></div>
                </dl>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
