import type { ReviewCase, AuditEvent } from '../types';
import { downloadFile } from './exportAudit';

export interface FieldVerificationData {
  assignedOfficer: string;
  priority: 'Routine' | 'Priority' | 'High Priority';
  verificationNote: string;
  targetDate: string;
}

export function exportDecisionRecordJSON(
  reviewCase: ReviewCase,
  auditEvent?: AuditEvent | null,
  filename?: string
) {
  const p = reviewCase.feature.properties;
  const candidate = p.ml_candidates?.[0];
  const centroidDist = candidate?.features?.centroid_distance_m != null
    ? `${candidate.features.centroid_distance_m < 0.001 ? '< 0.01' : candidate.features.centroid_distance_m.toFixed(2)} m`
    : 'Not available in source record';

  const mlProb = candidate?.ml_match_probability !== undefined
    ? `${(candidate.ml_match_probability * 100).toFixed(1)}%`
    : 'Not available in source record';

  const payload = {
    header: {
      system: 'BHUMI-SETU',
      title: 'Geospatial Reconciliation & Evidence Record',
      document_type: 'DECISION RECORD'
    },
    metadata: {
      record_id: reviewCase.record_id,
      parcel_id: p.parcel_id || reviewCase.record_id,
      run_id: reviewCase.run_id,
      dataset: 'Synthetic demonstration dataset (Pune Residential Study Area)',
      decision: reviewCase.decision?.toUpperCase() || 'PENDING',
      reviewer: reviewCase.reviewer || 'Not available in source record',
      date: reviewCase.decided_at || 'Not available in source record'
    },
    sections: {
      '1_decision_summary': {
        record_id: reviewCase.record_id,
        parcel_id: p.parcel_id || reviewCase.record_id,
        survey_number: p.cadastral?.survey_no ? String(p.cadastral.survey_no) : 'Not available in source record',
        run_id: reviewCase.run_id,
        project_id: 'pune-demo',
        decision_status: reviewCase.status,
        recorded_decision: reviewCase.decision?.toUpperCase() || 'PENDING'
      },
      '2_source_provenance': {
        cadastral_source: 'cadastral (Pune Cadastral Survey, 500 parcels)',
        building_drone_source: p.matched_footprint_id ? 'buildings (Synthetic Building Footprints)' : 'None matched',
        gnss_source: 'gnss (350 field observations)',
        dataset_mode: 'Synthetic demonstration dataset',
        source_versions: 'v1.0.0-synthetic',
        analysis_crs: 'EPSG:32643 (UTM Zone 43N metric)',
        display_crs: 'EPSG:4326 (WGS84)'
      },
      '3_geospatial_evidence': {
        geometry_evidence: 'Polygon boundary reconciliation',
        iou_overlap: p.geometry_overlap_pct !== undefined ? `${p.geometry_overlap_pct}%` : 'Not available in source record',
        centroid_spatial_distance: centroidDist,
        gnss_containment: p.gnss_verified ? 'Contained in parcel' : 'No contained observation',
        analysis_crs: 'EPSG:32643',
        geometry_validity: p.validation_flags?.includes('INVALID_GEOMETRY') ? 'Invalid geometry' : 'Valid geometry',
        geometry_repair_status: p.validation_flags?.includes('REPAIRED_GEOMETRY') ? 'Repaired' : 'Original valid'
      },
      '4_matching_evidence': {
        deterministic_confidence: p.confidence !== undefined ? `${p.confidence} / 100` : 'Not available in source record',
        ml_rank: p.ml_rank !== undefined && p.ml_rank !== null ? p.ml_rank : 'Not available in source record',
        ml_predicted_probability: mlProb,
        attribute_evidence: p.cadastral?.survey_no ? `Survey No: ${String(p.cadastral.survey_no)}` : 'Not available in source record',
        validation_flags: p.validation_flags && p.validation_flags.length ? p.validation_flags : ['None'],
        decision_status: reviewCase.status
      },
      '5_validation': {
        geometry_topology: p.validation_flags?.includes('INVALID_GEOMETRY') ? 'Flagged invalid' : 'Pass',
        crs_consistency: 'Pass (Reprojected to EPSG:32643)',
        overlap_threshold_check: p.geometry_overlap_pct !== undefined ? (p.geometry_overlap_pct >= 50 ? 'Compliant' : 'Below standard threshold') : 'Not available in source record',
        active_flags: p.validation_flags && p.validation_flags.length ? p.validation_flags : ['No active validation flags']
      },
      '6_human_decision': {
        decision: reviewCase.decision?.toUpperCase() || 'PENDING',
        reviewer: reviewCase.reviewer || 'Not available in source record',
        decision_note: reviewCase.note || 'Not available in source record',
        timestamp: reviewCase.decided_at || 'Not available in source record',
        version: reviewCase.version,
        previous_state: auditEvent?.before ? String(auditEvent.before.status ?? 'pending') : (reviewCase.status === 'resolved' ? 'pending' : 'Not available in source record'),
        new_state: reviewCase.status
      },
      '7_audit_information': {
        audit_event_id: auditEvent ? auditEvent.id : 'Not available in source record',
        run_reference: reviewCase.run_id,
        engine_version: 'v1.0.0 (Deterministic + ML reranker)',
        source_provenance: 'Internal SQLite audit_events ledger',
        decision_timestamp: reviewCase.decided_at || 'Not available in source record'
      }
    },
    footer: {
      attribution: 'Generated from Bhumi-Setu reconciliation records.',
      disclaimer: 'Synthetic demonstration dataset · Not an official land title'
    }
  };

  const name = filename || `decision-record-${reviewCase.record_id}.json`;
  downloadFile(JSON.stringify(payload, null, 2), name, 'application/json');
}

export function exportDecisionRecordCSV(
  reviewCase: ReviewCase,
  auditEvent?: AuditEvent | null,
  filename?: string
) {
  const p = reviewCase.feature.properties;
  const candidate = p.ml_candidates?.[0];
  const centroidDist = candidate?.features?.centroid_distance_m != null
    ? `${candidate.features.centroid_distance_m < 0.001 ? '< 0.01' : candidate.features.centroid_distance_m.toFixed(2)} m`
    : 'Not available in source record';

  const mlProb = candidate?.ml_match_probability !== undefined
    ? `${(candidate.ml_match_probability * 100).toFixed(1)}%`
    : 'Not available in source record';

  const headers = [
    'Record ID',
    'Parcel ID',
    'Survey Number',
    'Run ID',
    'Project ID',
    'Dataset Mode',
    'Decision',
    'Reviewer',
    'Decision Note',
    'Timestamp',
    'Version',
    'Previous State',
    'New State',
    'Cadastral Source',
    'Building/Drone Source',
    'GNSS Source',
    'Analysis CRS',
    'IoU Overlap',
    'Centroid Distance',
    'GNSS Containment',
    'Geometry Validity',
    'Geometry Repair Status',
    'Deterministic Confidence',
    'ML Rank',
    'ML Probability',
    'Validation Flags',
    'Audit Event ID',
    'Engine Version'
  ];

  const row = [
    `"${reviewCase.record_id}"`,
    `"${p.parcel_id || reviewCase.record_id}"`,
    `"${p.cadastral?.survey_no ? String(p.cadastral.survey_no) : 'Not available in source record'}"`,
    `"${reviewCase.run_id}"`,
    `"pune-demo"`,
    `"Synthetic demonstration dataset"`,
    `"${reviewCase.decision?.toUpperCase() || 'PENDING'}"`,
    `"${reviewCase.reviewer || 'Not available in source record'}"`,
    `"${(reviewCase.note || 'Not available in source record').replace(/"/g, '""')}"`,
    `"${reviewCase.decided_at || 'Not available in source record'}"`,
    reviewCase.version,
    `"${auditEvent?.before ? String(auditEvent.before.status ?? 'pending') : (reviewCase.status === 'resolved' ? 'pending' : 'Not available in source record')}"`,
    `"${reviewCase.status}"`,
    `"cadastral (Pune Cadastral Survey)"`,
    `"${p.matched_footprint_id ? 'buildings (Synthetic Building Footprints)' : 'None matched'}"`,
    `"gnss (350 field observations)"`,
    `"EPSG:32643"`,
    `"${p.geometry_overlap_pct !== undefined ? `${p.geometry_overlap_pct}%` : 'Not available in source record'}"`,
    `"${centroidDist}"`,
    `"${p.gnss_verified ? 'Contained in parcel' : 'No contained observation'}"`,
    `"${p.validation_flags?.includes('INVALID_GEOMETRY') ? 'Invalid geometry' : 'Valid geometry'}"`,
    `"${p.validation_flags?.includes('REPAIRED_GEOMETRY') ? 'Repaired' : 'Original valid'}"`,
    `"${p.confidence !== undefined ? `${p.confidence} / 100` : 'Not available in source record'}"`,
    `"${p.ml_rank !== undefined && p.ml_rank !== null ? p.ml_rank : 'Not available in source record'}"`,
    `"${mlProb}"`,
    `"${(p.validation_flags && p.validation_flags.length) ? p.validation_flags.join('; ') : 'None'}"`,
    `"${auditEvent?.id || 'Not available in source record'}"`,
    `"v1.0.0 (Deterministic + ML reranker)"`
  ];

  const csvContent = [headers.join(','), row.join(',')].join('\n');
  const name = filename || `decision-record-${reviewCase.record_id}.csv`;
  downloadFile(csvContent, name, 'text/csv;charset=utf-8;');
}

export function printDecisionRecord(
  reviewCase: ReviewCase,
  auditEvent?: AuditEvent | null
) {
  const p = reviewCase.feature.properties;
  const candidate = p.ml_candidates?.[0];
  const centroidDist = candidate?.features?.centroid_distance_m != null
    ? `${candidate.features.centroid_distance_m < 0.001 ? '< 0.01' : candidate.features.centroid_distance_m.toFixed(2)} m`
    : 'Not available in source record';

  const mlProb = candidate?.ml_match_probability !== undefined
    ? `${(candidate.ml_match_probability * 100).toFixed(1)}%`
    : 'Not available in source record';

  const printWindow = window.open('', '_blank', 'width=900,height=850');
  if (!printWindow) return;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Decision Record — ${reviewCase.record_id} — Bhumi-Setu</title>
  <style>
    @page { size: A4; margin: 18mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #172121; line-height: 1.5; font-size: 10pt; padding: 24px; max-width: 820px; margin: auto; background: #fff; }
    .header { border-bottom: 2px solid #005F63; padding-bottom: 12px; margin-bottom: 16px; }
    .header-top { display: flex; justify-content: space-between; align-items: baseline; }
    .brand { font-size: 16pt; font-weight: 800; color: #005F63; letter-spacing: 0.5px; }
    .subtitle { font-size: 10pt; color: #4A5568; margin-top: 2px; }
    .doc-title { font-size: 14pt; font-weight: 700; color: #172121; margin: 12px 0 6px; letter-spacing: 0.5px; }
    .dataset-badge { display: inline-block; font-size: 8pt; font-weight: 600; background: #EEF7F6; color: #005F63; padding: 2px 8px; border-radius: 3px; border: 1px solid #D5E1DF; }
    .meta-table { width: 100%; border-collapse: collapse; margin: 12px 0 16px; font-size: 9.5pt; }
    .meta-table th, .meta-table td { border: 1px solid #D5E1DF; padding: 5px 10px; text-align: left; }
    .meta-table th { background: #F8FAF9; color: #4A5568; font-weight: 600; width: 22%; }
    .meta-table td { color: #172121; }
    h3 { font-size: 10.5pt; border-bottom: 1px solid #D5E1DF; padding-bottom: 3px; margin: 14px 0 8px; color: #005F63; text-transform: uppercase; letter-spacing: 0.5px; }
    table.data-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 9.5pt; }
    table.data-table th, table.data-table td { border: 1px solid #D5E1DF; padding: 6px 10px; text-align: left; }
    table.data-table th { background: #EEF7F6; color: #005F63; font-weight: 600; width: 34%; }
    .decision-banner { background: #EEF7F6; border-left: 4px solid #007C83; padding: 10px 14px; margin: 12px 0; border-radius: 0 4px 4px 0; }
    .decision-banner b { font-size: 11pt; color: #005F63; display: block; }
    .decision-banner p { margin: 4px 0 0; color: #172121; font-style: italic; font-size: 9.5pt; }
    .footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #D5E1DF; font-size: 8pt; color: #718080; display: flex; justify-content: space-between; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-top">
      <div>
        <div class="brand">BHUMI-SETU</div>
        <div class="subtitle">Geospatial Reconciliation & Evidence Record</div>
      </div>
      <div class="dataset-badge">SYNTHETIC DEMONSTRATION DATASET</div>
    </div>
  </div>

  <div class="doc-title">DECISION RECORD</div>
  <table class="meta-table">
    <tr>
      <th>Record:</th><td>${reviewCase.record_id}</td>
      <th>Parcel:</th><td>${p.parcel_id || reviewCase.record_id}</td>
    </tr>
    <tr>
      <th>Run:</th><td>${reviewCase.run_id}</td>
      <th>Dataset:</th><td>Synthetic demonstration dataset (Pune Residential Study Area)</td>
    </tr>
    <tr>
      <th>Decision:</th><td><strong>${(reviewCase.decision || 'PENDING').toUpperCase()}</strong></td>
      <th>Reviewer:</th><td>${reviewCase.reviewer || 'Not available in source record'}</td>
    </tr>
    <tr>
      <th>Date:</th><td colspan="3">${reviewCase.decided_at ? new Date(reviewCase.decided_at).toLocaleString() : 'Not available in source record'}</td>
    </tr>
  </table>

  <h3>1. Decision Summary</h3>
  <div class="decision-banner">
    <b>DECISION: ${(reviewCase.decision || 'PENDING').toUpperCase()}</b>
    <div>Status: <strong>${reviewCase.status}</strong> · Version Lock: <strong>v${reviewCase.version}</strong></div>
    <p>Reviewer Justification: "${reviewCase.note || 'Not available in source record'}"</p>
  </div>

  <h3>2. Source Provenance</h3>
  <table class="data-table">
    <tr><th>Cadastral Source</th><td>cadastral (Pune Cadastral Survey, 500 parcels)</td></tr>
    <tr><th>Building / Drone Source</th><td>${p.matched_footprint_id ? 'buildings (Synthetic Building Footprints)' : 'None matched'}</td></tr>
    <tr><th>GNSS Source</th><td>gnss (350 field observations)</td></tr>
    <tr><th>Dataset Mode</th><td>Synthetic demonstration dataset</td></tr>
    <tr><th>Source Versions</th><td>v1.0.0-synthetic</td></tr>
    <tr><th>Analysis CRS</th><td>EPSG:32643 (UTM Zone 43N metric)</td></tr>
    <tr><th>Display CRS</th><td>EPSG:4326 (WGS84)</td></tr>
  </table>

  <h3>3. Geospatial Evidence</h3>
  <table class="data-table">
    <tr><th>Geometry Evidence</th><td>Polygon boundary reconciliation</td></tr>
    <tr><th>IoU / Overlap</th><td>${p.geometry_overlap_pct !== undefined ? `${p.geometry_overlap_pct}%` : 'Not available in source record'}</td></tr>
    <tr><th>Centroid / Spatial Distance</th><td>${centroidDist}</td></tr>
    <tr><th>GNSS Containment</th><td>${p.gnss_verified ? 'Contained in parcel' : 'No contained observation'}</td></tr>
    <tr><th>Analysis CRS</th><td>EPSG:32643</td></tr>
    <tr><th>Geometry Validity / Repair Status</th><td>${p.validation_flags?.includes('INVALID_GEOMETRY') ? 'Invalid geometry' : 'Valid geometry'} · ${p.validation_flags?.includes('REPAIRED_GEOMETRY') ? 'Repaired' : 'Original valid'}</td></tr>
  </table>

  <h3>4. Matching Evidence</h3>
  <table class="data-table">
    <tr><th>Deterministic Confidence</th><td>${p.confidence !== undefined ? `${p.confidence} / 100` : 'Not available in source record'}</td></tr>
    <tr><th>ML Rank / Probability</th><td>${p.ml_rank !== undefined && p.ml_rank !== null ? `Rank ${p.ml_rank} (${mlProb})` : 'Not available in source record'}</td></tr>
    <tr><th>Attribute Evidence</th><td>${p.cadastral?.survey_no ? `Survey No: ${String(p.cadastral.survey_no)}` : 'Not available in source record'}</td></tr>
    <tr><th>Validation Flags</th><td>${(p.validation_flags && p.validation_flags.length) ? p.validation_flags.join(', ') : 'None'}</td></tr>
    <tr><th>Decision Status</th><td>${reviewCase.status}</td></tr>
  </table>

  <h3>5. Validation</h3>
  <table class="data-table">
    <tr><th>Topology Checks</th><td>${p.validation_flags?.includes('INVALID_GEOMETRY') ? 'Topology issue detected' : 'Pass (Clean 2D polygon)'}</td></tr>
    <tr><th>Coordinate Transform</th><td>Pass (Projected to UTM Zone 43N for Euclidean metrics)</td></tr>
    <tr><th>Active Flags</th><td>${(p.validation_flags && p.validation_flags.length) ? p.validation_flags.join(', ') : 'None'}</td></tr>
  </table>

  <h3>6. Human Decision</h3>
  <table class="data-table">
    <tr><th>Decision</th><td><strong>${(reviewCase.decision || 'PENDING').toUpperCase()}</strong></td></tr>
    <tr><th>Reviewer</th><td>${reviewCase.reviewer || 'Not available in source record'}</td></tr>
    <tr><th>Decision Note</th><td>${reviewCase.note || 'Not available in source record'}</td></tr>
    <tr><th>Timestamp</th><td>${reviewCase.decided_at ? new Date(reviewCase.decided_at).toLocaleString() : 'Not available in source record'}</td></tr>
    <tr><th>Version</th><td>v${reviewCase.version}</td></tr>
    <tr><th>Previous State</th><td>${auditEvent?.before ? String(auditEvent.before.status ?? 'pending') : (reviewCase.status === 'resolved' ? 'pending' : 'Not available in source record')}</td></tr>
    <tr><th>New State</th><td>${reviewCase.status}</td></tr>
  </table>

  <h3>7. Audit Information</h3>
  <table class="data-table">
    <tr><th>Audit Event ID</th><td>${auditEvent ? `#${auditEvent.id}` : 'Not available in source record'}</td></tr>
    <tr><th>Run Reference</th><td>${reviewCase.run_id}</td></tr>
    <tr><th>Engine Version</th><td>v1.0.0 (Deterministic + ML reranker)</td></tr>
    <tr><th>Source Provenance</th><td>Internal SQLite audit_events ledger</td></tr>
    <tr><th>Decision Timestamp</th><td>${reviewCase.decided_at ? new Date(reviewCase.decided_at).toLocaleString() : 'Not available in source record'}</td></tr>
  </table>

  <div class="footer">
    <span>Generated from Bhumi-Setu reconciliation records.</span>
    <span>Synthetic demonstration dataset · Not an official land title</span>
  </div>

  <script>window.print();</script>
</body>
</html>`;

  printWindow.document.write(html);
  printWindow.document.close();
}

export function printDraftNotice(
  reviewCase: ReviewCase,
  verification: FieldVerificationData
) {
  const p = reviewCase.feature.properties;
  const printWindow = window.open('', '_blank', 'width=900,height=800');
  if (!printWindow) return;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Draft Verification Notice — ${reviewCase.record_id} — Bhumi-Setu</title>
  <style>
    @page { size: A4; margin: 20mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #172121; line-height: 1.5; font-size: 10.5pt; padding: 24px; max-width: 800px; margin: auto; }
    .warning-banner { background: #FFF8E6; border: 1.5px solid #F5C242; color: #8A5800; padding: 10px 14px; border-radius: 4px; font-size: 9.5pt; font-weight: 700; text-align: center; margin-bottom: 20px; letter-spacing: 0.5px; }
    .header { border-bottom: 2px solid #005F63; padding-bottom: 12px; margin-bottom: 20px; }
    .brand { font-size: 16pt; font-weight: 800; color: #005F63; margin: 0; }
    .doc-type { font-size: 10pt; font-weight: 700; color: #718080; text-transform: uppercase; margin-top: 4px; }
    .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 18px; font-size: 10pt; }
    .meta-table th, .meta-table td { border: 1px solid #D5E1DF; padding: 7px 10px; text-align: left; }
    .meta-table th { background: #F8FAF9; color: #718080; font-weight: 600; width: 34%; }
    .content-box { border: 1px solid #D5E1DF; padding: 14px 18px; border-radius: 4px; background: #FFFFFF; margin-bottom: 18px; font-size: 10pt; }
    .content-box h4 { margin: 0 0 10px; color: #005F63; font-size: 10.5pt; text-transform: uppercase; }
    .instructions-box { background: #EEF7F6; border-left: 4px solid #007C83; padding: 12px 16px; margin: 18px 0; border-radius: 0 4px 4px 0; }
    .footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #D5E1DF; font-size: 8pt; color: #718080; text-align: center; }
  </style>
</head>
<body>
  <div class="warning-banner">
    DRAFT — NOT AN OFFICIAL GOVERNMENT NOTICE<br>
    <span style="font-weight: 400; font-size: 8.5pt;">This document is an internal technical working memorandum prepared for field verification. It does not constitute a statutory notice, legal determination, or official summons.</span>
  </div>

  <div class="header">
    <div class="brand">BHUMI-SETU</div>
    <div class="doc-type">Draft Administrative Notice / Field Verification Memorandum</div>
  </div>

  <table class="meta-table">
    <tr><th>Target Record</th><td><strong>${reviewCase.record_id}</strong></td></tr>
    <tr><th>Parcel / Survey Reference</th><td>${p.cadastral?.survey_no ? String(p.cadastral.survey_no) : 'Not available in source record'}</td></tr>
    <tr><th>Registered Owner Information</th><td>${p.cadastral?.owner ? String(p.cadastral.owner) : 'Owner information not available in current dataset.'}</td></tr>
    <tr><th>Dataset Location Reference</th><td>Pune Residential Study Area (EPSG:32643)</td></tr>
    <tr><th>Assigned Officer / Team</th><td><strong>${verification.assignedOfficer || 'Not assigned'}</strong></td></tr>
    <tr><th>Verification Priority</th><td><strong>${verification.priority}</strong></td></tr>
    <tr><th>Target Date</th><td>${verification.targetDate || 'Not specified'}</td></tr>
    <tr><th>Reviewer Decision</th><td>${(reviewCase.decision || 'PENDING').toUpperCase()} (Reviewer: ${reviewCase.reviewer || 'Not available in source record'})</td></tr>
  </table>

  <div class="content-box">
    <h4>Evidence Summary</h4>
    <ul>
      <li>Confidence Score: <b>${p.confidence !== undefined ? `${p.confidence} / 100` : 'Not available in source record'}</b></li>
      <li>Boundary IoU Overlap: <b>${p.geometry_overlap_pct !== undefined ? `${p.geometry_overlap_pct}%` : 'Not available in source record'}</b></li>
      <li>GNSS Containment: <b>${p.gnss_verified ? 'Contained observation' : 'No contained observation'}</b></li>
      <li>Validation Flags: <b>${(p.validation_flags && p.validation_flags.length) ? p.validation_flags.join(', ') : 'None'}</b></li>
    </ul>
    <p style="font-size: 9.5pt; color: #4A5568;">Reason for verification: Case flagged during spatial reconciliation or assigned for ground confirmation prior to land record synchronization.</p>
  </div>

  <div class="instructions-box">
    <strong style="color: #005F63;">Verification Instructions / Note:</strong>
    <p style="margin: 6px 0 0;">${verification.verificationNote || 'Not available in source record'}</p>
  </div>

  <div class="footer">
    DRAFT — NOT AN OFFICIAL GOVERNMENT NOTICE<br>
    Generated from Bhumi-Setu reconciliation records. Synthetic demonstration dataset.
  </div>

  <script>window.print();</script>
</body>
</html>`;

  printWindow.document.write(html);
  printWindow.document.close();
}
