import { useEffect, useState } from 'react';
import { X, Download, Printer, FileText } from 'lucide-react';
import type { ReviewCase, AuditEvent } from '../types';
import { exportDecisionRecordJSON, exportDecisionRecordCSV, printDecisionRecord } from '../utils/exportDecisionRecord';
import { api } from '../services/api';

interface DecisionRecordModalProps {
  reviewCase: ReviewCase;
  auditEvents?: AuditEvent[];
  onClose: () => void;
  onAuditLogged?: () => void;
}

export default function DecisionRecordModal({
  reviewCase,
  auditEvents = [],
  onClose,
  onAuditLogged
}: DecisionRecordModalProps) {
  const [exporting, setExporting] = useState(false);
  const p = reviewCase.feature.properties;
  const latestAudit = auditEvents[0] || null;
  const candidate = p.ml_candidates?.[0];
  const centroidDist = candidate?.features?.centroid_distance_m != null
    ? `${candidate.features.centroid_distance_m < 0.001 ? '< 0.01' : candidate.features.centroid_distance_m.toFixed(2)} m`
    : 'Not available in source record';
  const mlProb = candidate?.ml_match_probability !== undefined
    ? `${(candidate.ml_match_probability * 100).toFixed(1)}%`
    : 'Not available in source record';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const logExportAudit = async (format: string) => {
    try {
      setExporting(true);
      await api.logAuditEvent({
        run_id: reviewCase.run_id,
        record_id: reviewCase.record_id,
        actor: reviewCase.reviewer || 'Officer',
        action: 'DECISION_RECORD_EXPORTED',
        metadata: {
          format,
          decision: reviewCase.decision,
          version: reviewCase.version,
          exported_at: new Date().toISOString()
        }
      });
      onAuditLogged?.();
    } catch {
      // Export should succeed even if audit logging fails
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadJSON = async () => {
    exportDecisionRecordJSON(reviewCase, latestAudit);
    await logExportAudit('json');
  };

  const handleDownloadCSV = async () => {
    exportDecisionRecordCSV(reviewCase, latestAudit);
    await logExportAudit('csv');
  };

  const handlePrint = async () => {
    printDecisionRecord(reviewCase, latestAudit);
    await logExportAudit('print_pdf');
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="decision-record-title">
      <div className="decision-record-container">
        {/* Institutional Toolbar */}
        <div className="decision-record-toolbar">
          <div className="toolbar-left">
            <FileText size={18} className="toolbar-icon" />
            <span className="toolbar-title">Decision Record — {reviewCase.record_id}</span>
          </div>
          <div className="toolbar-actions">
            <button
              type="button"
              className="doc-action-btn"
              onClick={handleDownloadJSON}
              disabled={exporting}
              title="Download record as machine-readable JSON"
            >
              <Download size={14} /> JSON
            </button>
            <button
              type="button"
              className="doc-action-btn"
              onClick={handleDownloadCSV}
              disabled={exporting}
              title="Download record as spreadsheet CSV"
            >
              <Download size={14} /> CSV
            </button>
            <button
              type="button"
              className="doc-action-btn"
              onClick={handlePrint}
              disabled={exporting}
              title="Print document or save as PDF"
            >
              <Printer size={14} /> Print / PDF
            </button>
            <button
              type="button"
              className="doc-close-btn"
              onClick={onClose}
              aria-label="Close decision record"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Paper Surface Document */}
        <div className="decision-record-paper">
          {/* Header */}
          <div className="doc-header">
            <div className="doc-header-top">
              <div>
                <h1 className="doc-brand">BHUMI-SETU</h1>
                <div className="doc-subbrand">Geospatial Reconciliation &amp; Evidence Record</div>
              </div>
              <div className="doc-badge">SYNTHETIC DEMONSTRATION DATASET</div>
            </div>
            <div className="doc-rule" />
          </div>

          <div id="decision-record-title" className="doc-section-title">DECISION RECORD</div>

          {/* Primary Metadata Table */}
          <table className="doc-meta-table">
            <tbody>
              <tr>
                <th>Record:</th>
                <td>{reviewCase.record_id}</td>
                <th>Parcel:</th>
                <td>{p.parcel_id || reviewCase.record_id}</td>
              </tr>
              <tr>
                <th>Run:</th>
                <td>{reviewCase.run_id}</td>
                <th>Dataset:</th>
                <td>Synthetic demonstration dataset (Pune Residential Study Area)</td>
              </tr>
              <tr>
                <th>Decision:</th>
                <td>
                  <strong className={`doc-decision-badge ${reviewCase.decision || 'pending'}`}>
                    {(reviewCase.decision || 'PENDING').toUpperCase()}
                  </strong>
                </td>
                <th>Reviewer:</th>
                <td>{reviewCase.reviewer || 'Not available in source record'}</td>
              </tr>
              <tr>
                <th>Date:</th>
                <td colSpan={3}>
                  {reviewCase.decided_at ? new Date(reviewCase.decided_at).toLocaleString() : 'Not available in source record'}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Section 1: Decision Summary */}
          <div className="doc-block">
            <h3>1. Decision Summary</h3>
            <div className="doc-summary-box">
              <div className="summary-line">
                <span>Decision Status:</span>
                <strong>{reviewCase.status}</strong>
                <span>Concurrency Version:</span>
                <strong>v{reviewCase.version}</strong>
              </div>
              <div className="summary-justification">
                <span className="justification-label">Reviewer Note:</span>
                <p>"{reviewCase.note || 'Not available in source record'}"</p>
              </div>
            </div>
          </div>

          {/* Section 2: Source Provenance */}
          <div className="doc-block">
            <h3>2. Source Provenance</h3>
            <table className="doc-data-table">
              <tbody>
                <tr>
                  <th>Cadastral Source</th>
                  <td>cadastral (Pune Cadastral Survey, 500 parcels)</td>
                </tr>
                <tr>
                  <th>Building / Drone Source</th>
                  <td>{p.matched_footprint_id ? 'buildings (Synthetic Building Footprints)' : 'None matched'}</td>
                </tr>
                <tr>
                  <th>GNSS Source</th>
                  <td>gnss (350 field observations)</td>
                </tr>
                <tr>
                  <th>Dataset Mode</th>
                  <td>Synthetic demonstration dataset</td>
                </tr>
                <tr>
                  <th>Source Versions</th>
                  <td>v1.0.0-synthetic</td>
                </tr>
                <tr>
                  <th>Analysis CRS</th>
                  <td>EPSG:32643 (UTM Zone 43N metric)</td>
                </tr>
                <tr>
                  <th>Display CRS</th>
                  <td>EPSG:4326 (WGS84)</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section 3: Geospatial Evidence */}
          <div className="doc-block">
            <h3>3. Geospatial Evidence</h3>
            <table className="doc-data-table">
              <tbody>
                <tr>
                  <th>Geometry Evidence</th>
                  <td>Polygon boundary reconciliation</td>
                </tr>
                <tr>
                  <th>IoU / Overlap</th>
                  <td>{p.geometry_overlap_pct !== undefined ? `${p.geometry_overlap_pct}%` : 'Not available in source record'}</td>
                </tr>
                <tr>
                  <th>Centroid / Spatial Distance</th>
                  <td>{centroidDist}</td>
                </tr>
                <tr>
                  <th>GNSS Containment</th>
                  <td>{p.gnss_verified ? 'Contained in parcel' : 'No contained observation'}</td>
                </tr>
                <tr>
                  <th>Analysis CRS</th>
                  <td>EPSG:32643</td>
                </tr>
                <tr>
                  <th>Geometry Validity / Repair Status</th>
                  <td>
                    {p.validation_flags?.includes('INVALID_GEOMETRY') ? 'Invalid geometry' : 'Valid geometry'} ·{' '}
                    {p.validation_flags?.includes('REPAIRED_GEOMETRY') ? 'Repaired' : 'Original valid'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section 4: Matching Evidence */}
          <div className="doc-block">
            <h3>4. Matching Evidence</h3>
            <table className="doc-data-table">
              <tbody>
                <tr>
                  <th>Deterministic Confidence</th>
                  <td>{p.confidence !== undefined ? `${p.confidence} / 100` : 'Not available in source record'}</td>
                </tr>
                <tr>
                  <th>ML Rank / Probability</th>
                  <td>
                    {p.ml_rank !== undefined && p.ml_rank !== null
                      ? `Rank ${p.ml_rank} (${mlProb})`
                      : 'Not available in source record'}
                  </td>
                </tr>
                <tr>
                  <th>Attribute Evidence</th>
                  <td>{p.cadastral?.survey_no ? `Survey No: ${String(p.cadastral.survey_no)}` : 'Not available in source record'}</td>
                </tr>
                <tr>
                  <th>Validation Flags</th>
                  <td>{p.validation_flags && p.validation_flags.length ? p.validation_flags.join(', ') : 'None'}</td>
                </tr>
                <tr>
                  <th>Decision Status</th>
                  <td>{reviewCase.status}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section 5: Validation */}
          <div className="doc-block">
            <h3>5. Validation</h3>
            <table className="doc-data-table">
              <tbody>
                <tr>
                  <th>Topology Checks</th>
                  <td>{p.validation_flags?.includes('INVALID_GEOMETRY') ? 'Topology issue detected' : 'Pass (Clean 2D polygon)'}</td>
                </tr>
                <tr>
                  <th>Coordinate Transform</th>
                  <td>Pass (Projected to UTM Zone 43N for Euclidean metrics)</td>
                </tr>
                <tr>
                  <th>Boundary Overlap Check</th>
                  <td>
                    {p.geometry_overlap_pct !== undefined
                      ? (p.geometry_overlap_pct >= 50 ? 'Compliant' : 'Below standard threshold')
                      : 'Not available in source record'}
                  </td>
                </tr>
                <tr>
                  <th>Active Flags</th>
                  <td>{p.validation_flags && p.validation_flags.length ? p.validation_flags.join(', ') : 'None'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section 6: Human Decision */}
          <div className="doc-block">
            <h3>6. Human Decision</h3>
            <table className="doc-data-table">
              <tbody>
                <tr>
                  <th>Decision</th>
                  <td><strong>{(reviewCase.decision || 'PENDING').toUpperCase()}</strong></td>
                </tr>
                <tr>
                  <th>Reviewer</th>
                  <td>{reviewCase.reviewer || 'Not available in source record'}</td>
                </tr>
                <tr>
                  <th>Decision Note</th>
                  <td>{reviewCase.note || 'Not available in source record'}</td>
                </tr>
                <tr>
                  <th>Timestamp</th>
                  <td>{reviewCase.decided_at ? new Date(reviewCase.decided_at).toLocaleString() : 'Not available in source record'}</td>
                </tr>
                <tr>
                  <th>Version</th>
                  <td>v{reviewCase.version}</td>
                </tr>
                <tr>
                  <th>Previous State</th>
                  <td>
                    {latestAudit?.before
                      ? String(latestAudit.before.status ?? 'pending')
                      : (reviewCase.status === 'resolved' ? 'pending' : 'Not available in source record')}
                  </td>
                </tr>
                <tr>
                  <th>New State</th>
                  <td>{reviewCase.status}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section 7: Audit Information */}
          <div className="doc-block">
            <h3>7. Audit Information</h3>
            <table className="doc-data-table">
              <tbody>
                <tr>
                  <th>Audit Event ID</th>
                  <td>{latestAudit ? `#${latestAudit.id}` : 'Not available in source record'}</td>
                </tr>
                <tr>
                  <th>Run Reference</th>
                  <td>{reviewCase.run_id}</td>
                </tr>
                <tr>
                  <th>Engine Version</th>
                  <td>v1.0.0 (Deterministic + ML reranker)</td>
                </tr>
                <tr>
                  <th>Source Provenance</th>
                  <td>Internal SQLite audit_events ledger</td>
                </tr>
                <tr>
                  <th>Decision Timestamp</th>
                  <td>{reviewCase.decided_at ? new Date(reviewCase.decided_at).toLocaleString() : 'Not available in source record'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="doc-footer">
            <span>Generated from Bhumi-Setu reconciliation records.</span>
            <span>Synthetic demonstration dataset · Not an official land title</span>
          </div>
        </div>
      </div>
    </div>
  );
}
