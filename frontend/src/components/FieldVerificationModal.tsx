import { useEffect, useState } from 'react';
import { X, Send, Printer, AlertTriangle, FileText, CheckCircle2, LoaderCircle } from 'lucide-react';
import type { ReviewCase } from '../types';
import { printDraftNotice, type FieldVerificationData } from '../utils/exportDecisionRecord';
import { api } from '../services/api';

interface FieldVerificationModalProps {
  reviewCase: ReviewCase;
  onClose: () => void;
  onAuditLogged?: () => void;
}

export default function FieldVerificationModal({
  reviewCase,
  onClose,
  onAuditLogged
}: FieldVerificationModalProps) {
  const p = reviewCase.feature.properties;
  const [activeTab, setActiveTab] = useState<'form' | 'notice'>('form');

  // Form state
  const [assignedOfficer, setAssignedOfficer] = useState('');
  const [priority, setPriority] = useState<FieldVerificationData['priority']>('Priority');
  const [verificationNote, setVerificationNote] = useState('');
  const [targetDate, setTargetDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const verificationData: FieldVerificationData = {
    assignedOfficer: assignedOfficer.trim(),
    priority,
    verificationNote: verificationNote.trim(),
    targetDate
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationData.assignedOfficer) {
      setError('Enter an assigned officer or field unit identifier.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await api.logAuditEvent({
        run_id: reviewCase.run_id,
        record_id: reviewCase.record_id,
        actor: reviewCase.reviewer || verificationData.assignedOfficer || 'Officer',
        action: 'FIELD_VERIFICATION_PREPARED',
        metadata: {
          assigned_officer: verificationData.assignedOfficer,
          priority: verificationData.priority,
          target_date: verificationData.targetDate,
          verification_note: verificationData.verificationNote || null,
          decision_basis: reviewCase.decision,
          prepared_at: new Date().toISOString()
        }
      });
      setSuccess(true);
      onAuditLogged?.();
    } catch (err) {
      setError((err as Error).message || 'Failed to record field verification request.');
    } finally {
      setSaving(false);
    }
  };

  const handlePrintNotice = () => {
    printDraftNotice(reviewCase, verificationData);
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="verification-modal-title">
      <div className="verification-modal-container">
        {/* Header */}
        <div className="verification-header">
          <div>
            <h2 id="verification-modal-title">FIELD VERIFICATION</h2>
            <p className="verification-subtitle">Prepare a verification request for the selected record.</p>
          </div>
          <button
            type="button"
            className="doc-close-btn"
            onClick={onClose}
            aria-label="Close field verification modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="verification-tabs">
          <button
            type="button"
            className={`verification-tab ${activeTab === 'form' ? 'active' : ''}`}
            onClick={() => setActiveTab('form')}
          >
            Verification Request Form
          </button>
          <button
            type="button"
            className={`verification-tab ${activeTab === 'notice' ? 'active' : ''}`}
            onClick={() => setActiveTab('notice')}
          >
            Draft Administrative Notice
          </button>
        </div>

        {activeTab === 'form' ? (
          <form className="verification-body" onSubmit={handleSubmit}>
            {/* Target record summary */}
            <div className="verification-context-card">
              <div className="context-grid">
                <div>
                  <span className="context-label">Target Record</span>
                  <strong>{reviewCase.record_id}</strong>
                </div>
                <div>
                  <span className="context-label">Parcel / Survey Reference</span>
                  <strong>{p.cadastral?.survey_no ? String(p.cadastral.survey_no) : 'Not available in source record'}</strong>
                </div>
                <div>
                  <span className="context-label">Location Information</span>
                  <span>Pune Residential Study Area (EPSG:32643)</span>
                </div>
                <div>
                  <span className="context-label">Reviewer Decision</span>
                  <span className="doc-decision-tag">{reviewCase.decision?.toUpperCase() || 'PENDING'}</span>
                </div>
              </div>

              <div className="evidence-summary-row">
                <span className="context-label">Evidence Summary &amp; Reason:</span>
                <p>
                  Confidence: <b>{p.confidence !== undefined ? `${p.confidence}/100` : 'Not available'}</b> ·{' '}
                  Overlap: <b>{p.geometry_overlap_pct !== undefined ? `${p.geometry_overlap_pct}%` : 'Not available'}</b> ·{' '}
                  GNSS: <b>{p.gnss_verified ? 'Contained observation' : 'None'}</b> ·{' '}
                  Flags: <b>{(p.validation_flags && p.validation_flags.length) ? p.validation_flags.join(', ') : 'None'}</b>
                  {reviewCase.note ? ` — Reviewer note: "${reviewCase.note}"` : ''}
                </p>
              </div>
            </div>

            {/* Verification Inputs */}
            <div className="verification-fields">
              <label>
                Assigned officer / team
                <input
                  type="text"
                  maxLength={120}
                  placeholder="e.g. Pune Survey Unit 4 / Officer DO-02"
                  value={assignedOfficer}
                  onChange={(e) => setAssignedOfficer(e.target.value)}
                  disabled={saving || success}
                />
              </label>

              <div className="verification-row-split">
                <label>
                  Priority
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as FieldVerificationData['priority'])}
                    disabled={saving || success}
                  >
                    <option value="Routine">Routine</option>
                    <option value="Priority">Priority</option>
                    <option value="High Priority">High Priority</option>
                  </select>
                </label>

                <label>
                  Target date
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    disabled={saving || success}
                  />
                </label>
              </div>

              <label>
                Verification note / inspection instructions
                <textarea
                  rows={3}
                  maxLength={2000}
                  placeholder="Specific boundary segments to verify on site with GNSS rover..."
                  value={verificationNote}
                  onChange={(e) => setVerificationNote(e.target.value)}
                  disabled={saving || success}
                />
              </label>
            </div>

            {error && <div className="form-error-banner" role="alert">{error}</div>}

            {success ? (
              <div className="form-success-banner" role="status">
                <CheckCircle2 size={16} />
                <span>
                  Field verification request prepared and recorded in append-only audit trail (<code>FIELD_VERIFICATION_PREPARED</code>).
                </span>
              </div>
            ) : null}

            {/* Actions */}
            <div className="verification-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setActiveTab('notice')}
              >
                <FileText size={14} /> Preview Draft Notice
              </button>
              <div className="actions-right">
                <button
                  type="button"
                  className="secondary"
                  onClick={onClose}
                  disabled={saving}
                >
                  {success ? 'Close' : 'Cancel'}
                </button>
                {!success && (
                  <button
                    type="submit"
                    className="primary"
                    disabled={saving}
                  >
                    {saving ? <LoaderCircle className="spin" size={14} /> : <Send size={14} />}
                    Prepare Verification Request
                  </button>
                )}
              </div>
            </div>
          </form>
        ) : (
          <div className="verification-notice-preview">
            {/* Warning Banner */}
            <div className="doc-warning-banner" role="alert">
              <AlertTriangle size={18} className="warning-icon" />
              <div>
                <strong>DRAFT — NOT AN OFFICIAL GOVERNMENT NOTICE</strong>
                <p>
                  This memorandum is an internal technical working document prepared solely for geospatial field verification.
                  It does not constitute statutory notice, legal determination, or official summons.
                </p>
              </div>
            </div>

            {/* Document body */}
            <div className="notice-paper">
              <div className="notice-header">
                <div className="doc-brand">BHUMI-SETU</div>
                <div className="notice-type">Draft Administrative Notice / Field Verification Memorandum</div>
              </div>

              <table className="doc-meta-table">
                <tbody>
                  <tr>
                    <th>Target Record:</th>
                    <td><strong>{reviewCase.record_id}</strong></td>
                    <th>Survey Reference:</th>
                    <td>{p.cadastral?.survey_no ? String(p.cadastral.survey_no) : 'Not available in source record'}</td>
                  </tr>
                  <tr>
                    <th>Registered Owner:</th>
                    <td colSpan={3}>
                      {p.cadastral?.owner ? String(p.cadastral.owner) : 'Owner information not available in current dataset.'}
                    </td>
                  </tr>
                  <tr>
                    <th>Assigned Officer:</th>
                    <td>{assignedOfficer.trim() || 'Not assigned'}</td>
                    <th>Priority:</th>
                    <td>{priority}</td>
                  </tr>
                  <tr>
                    <th>Target Date:</th>
                    <td>{targetDate || 'Not specified'}</td>
                    <th>Review Decision:</th>
                    <td>{(reviewCase.decision || 'PENDING').toUpperCase()}</td>
                  </tr>
                </tbody>
              </table>

              <div className="doc-block">
                <h4>Geospatial Evidence Summary</h4>
                <ul className="notice-bullets">
                  <li>Confidence Score: <b>{p.confidence !== undefined ? `${p.confidence} / 100` : 'Not available in source record'}</b></li>
                  <li>Boundary IoU Overlap: <b>{p.geometry_overlap_pct !== undefined ? `${p.geometry_overlap_pct}%` : 'Not available in source record'}</b></li>
                  <li>GNSS Containment: <b>{p.gnss_verified ? 'Contained observation' : 'No contained observation'}</b></li>
                  <li>Validation Flags: <b>{(p.validation_flags && p.validation_flags.length) ? p.validation_flags.join(', ') : 'None'}</b></li>
                </ul>
              </div>

              <div className="notice-instructions">
                <strong>Verification Instructions:</strong>
                <p>{verificationNote.trim() || 'Conduct on-site RTK GNSS boundary inspection to verify parcel vertices and resolve spatial ambiguity.'}</p>
              </div>

              <div className="notice-footer">
                <span>DRAFT — NOT AN OFFICIAL GOVERNMENT NOTICE</span>
                <span>Generated from Bhumi-Setu reconciliation records · Synthetic demonstration dataset</span>
              </div>
            </div>

            <div className="verification-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setActiveTab('form')}
              >
                Back to Form
              </button>
              <button
                type="button"
                className="primary"
                onClick={handlePrintNotice}
              >
                <Printer size={14} /> Print Draft Notice
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
