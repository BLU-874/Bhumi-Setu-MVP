import type { AuditEvent } from '../types';

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportAuditAsJSON(events: AuditEvent | AuditEvent[], filename: string) {
  const data = JSON.stringify(events, null, 2);
  downloadFile(data, filename, 'application/json');
}

export function exportAuditAsCSV(events: AuditEvent[], filename: string) {
  const headers = [
    'Event ID',
    'Timestamp',
    'Run ID',
    'Record ID',
    'Parcel ID',
    'Survey No',
    'Actor',
    'Action',
    'Decision',
    'Prior Status',
    'New Status',
    'Note',
    'Confidence',
    'Geometry Overlap %',
    'Attribute Match %',
    'GNSS Verified',
    'ML Rank',
    'ML Model'
  ];

  const rows = events.map(e => {
    const props = e.record?.properties;
    return [
      e.id,
      `"${e.timestamp}"`,
      `"${e.run_id}"`,
      `"${e.record_id}"`,
      `"${props?.parcel_id || e.record_id}"`,
      `"${props?.cadastral?.survey_no || ''}"`,
      `"${e.actor}"`,
      `"${e.action}"`,
      `"${e.after?.decision || ''}"`,
      `"${e.before?.status || ''}"`,
      `"${e.after?.status || ''}"`,
      `"${(e.after?.note as string || '').replace(/"/g, '""')}"`,
      props?.confidence ?? '',
      props?.geometry_overlap_pct ?? '',
      props?.attribute_match_pct ?? '',
      props?.gnss_verified ? 'TRUE' : 'FALSE',
      props?.ml_rank ?? '',
      `"${props?.model_version || ''}"`
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
}

export function printAuditRecord(event: AuditEvent) {
  const p = event.record?.properties;
  const candidate = p?.ml_candidates?.[0];
  const printWindow = window.open('', '_blank', 'width=900,height=800');
  if (!printWindow) return;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Decision Record — ${event.record_id} — Bhumi-Setu</title>
  <style>
    @page { size: A4; margin: 20mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #172121; line-height: 1.5; font-size: 11pt; padding: 24px; max-width: 800px; margin: auto; }
    .header { border-bottom: 2px solid #005F63; padding-bottom: 12px; margin-bottom: 20px; }
    .header-top { display: flex; justify-content: space-between; align-items: baseline; }
    .title { font-size: 18pt; font-weight: 800; color: #005F63; margin: 0; }
    .doc-type { font-size: 9pt; font-weight: 700; letter-spacing: 1px; color: #718080; text-transform: uppercase; }
    .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 20px; font-size: 10pt; }
    .meta-item { border: 1px solid #D5E1DF; padding: 8px 12px; border-radius: 4px; background: #F8FAF9; }
    .meta-item span { display: block; font-size: 8pt; color: #718080; text-transform: uppercase; font-weight: 600; }
    .meta-item b { color: #172121; }
    h3 { font-size: 11pt; border-bottom: 1px solid #D5E1DF; padding-bottom: 4px; margin: 18px 0 10px; color: #005F63; text-transform: uppercase; letter-spacing: 0.5px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 10pt; }
    th, td { border: 1px solid #D5E1DF; padding: 7px 10px; text-align: left; }
    th { background: #EEF7F6; color: #005F63; font-weight: 600; width: 35%; }
    .decision-box { background: #EEF7F6; border-left: 4px solid #007C83; padding: 12px 16px; margin: 15px 0; }
    .decision-box b { font-size: 12pt; color: #005F63; display: block; }
    .decision-box p { margin: 6px 0 0; color: #172121; font-style: italic; }
    .footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #D5E1DF; font-size: 8pt; color: #718080; display: flex; justify-content: space-between; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-top">
      <h1 class="title">BHUMI-SETU</h1>
      <span class="doc-type">Reconciliation Decision Record</span>
    </div>
    <div style="font-size: 9pt; color: #718080; margin-top: 4px;">
      Geospatial Land Record Reconciliation & Verification System · Audit Trail Receipt
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-item">
      <span>Record Identifier</span>
      <b>${event.record_id} (Parcel: ${p?.parcel_id || event.record_id})</b>
    </div>
    <div class="meta-item">
      <span>Harmonization Run ID</span>
      <b style="font-family: monospace;">${event.run_id}</b>
    </div>
    <div class="meta-item">
      <span>Review Decision</span>
      <b style="color: #005F63; text-transform: uppercase;">${String(event.after?.decision || event.action)}</b>
    </div>
    <div class="meta-item">
      <span>Deciding Officer</span>
      <b>${event.actor}</b>
    </div>
  </div>

  <div class="decision-box">
    <b>Human Decision: ${String(event.after?.decision || '').toUpperCase()}</b>
    <p>${event.after?.note ? `“${event.after.note}”` : 'No specific decision note recorded.'}</p>
    <div style="margin-top: 8px; font-size: 8.5pt; color: #4F5C5C;">
      Status transition: ${String(event.before?.status || 'pending')} → ${String(event.after?.status || 'resolved')} · Recorded at ${new Date(event.timestamp).toLocaleString()}
    </div>
  </div>

  <h3>1. Source Provenance</h3>
  <table>
    <tr><th>Cadastral Source</th><td>cadastral (Pune Cadastral Demonstration, 500 parcels)</td></tr>
    <tr><th>Building Source</th><td>${String((event.run?.['source_ids'] as Record<string, string> | undefined)?.['buildings'] || 'buildings')} (${String(p?.footprint_properties?.['source'] || 'Synthetic Building Footprints')})</td></tr>
    <tr><th>GNSS Source</th><td>gnss (350 field observations)</td></tr>
    <tr><th>Dataset Mode</th><td>Synthetic Demonstration Dataset</td></tr>
  </table>

  <h3>2. Geospatial Evidence</h3>
  <table>
    <tr><th>Geometry Overlap (IoU)</th><td>${p?.geometry_overlap_pct ?? '—'}%</td></tr>
    <tr><th>Centroid Distance</th><td>${candidate?.features?.centroid_distance_m != null ? `${candidate.features.centroid_distance_m < 0.001 ? '< 0.01' : candidate.features.centroid_distance_m.toFixed(2)} m` : '—'}</td></tr>
    <tr><th>Boundary Distance</th><td>${candidate?.features?.boundary_distance_m != null ? `${candidate.features.boundary_distance_m.toFixed(3)} m` : '—'}</td></tr>
    <tr><th>Geometry Quality</th><td>${p?.geometry_quality?.result_valid ? 'Valid polygon geometry' : 'Invalid'} · ${p?.geometry_quality?.repaired ? 'Repaired' : 'Original valid'}</td></tr>
    <tr><th>Analysis Coordinate System</th><td>EPSG:32643 (UTM Zone 43N metric) · Display: EPSG:4326</td></tr>
  </table>

  <h3>3. Attribute & GNSS Verification</h3>
  <table>
    <tr><th>Survey Number Match</th><td>${p?.attribute_evidence?.survey_no ? `${p.attribute_evidence.survey_no.source} vs ${p.attribute_evidence.survey_no.candidate} (${p.attribute_evidence.survey_no.similarity_pct}%)` : '—'}</td></tr>
    <tr><th>Owner Name Match</th><td>${p?.attribute_evidence?.owner ? `${p.attribute_evidence.owner.source} vs ${p.attribute_evidence.owner.candidate} (${p.attribute_evidence.owner.similarity_pct}%)` : '—'}</td></tr>
    <tr><th>Area Comparison</th><td>${p?.cadastral?.area_sqm != null ? `${p.cadastral.area_sqm} m² (cadastral) vs ${p?.footprint_properties?.areaSqM ?? '—'} m² (building)` : '—'}</td></tr>
    <tr><th>Attribute Match Score</th><td>${p?.attribute_match_pct ?? '—'}%</td></tr>
    <tr><th>GNSS Ground Verification</th><td>${p?.gnss_verified ? `Verified (Observation ID: ${p.gnss_point_id || 'Contained'})` : 'No contained GNSS observation'}</td></tr>
  </table>

  <h3>4. Algorithmic Assessment</h3>
  <table>
    <tr><th>Deterministic Formula</th><td>65% Geometry Overlap + 35% Attribute Match + GNSS Boost (up to 8 pts)</td></tr>
    <tr><th>Deterministic Confidence</th><td>${p?.confidence ?? '—'} / 100</td></tr>
    <tr><th>System Status</th><td>${p?.status ? p.status.toUpperCase().replace('_', ' ') : '—'}</td></tr>
    <tr><th>ML Ranker Candidate</th><td>${p?.ml_ranked_candidate_id || p?.matched_footprint_id || '—'} (Rank #${p?.ml_rank ?? 1})</td></tr>
    <tr><th>ML Model Version</th><td>${p?.model_version || 'synthetic-hgb-v1'}</td></tr>
  </table>

  <div class="footer">
    <span>Audit Event #${event.id} · Append-Only Persistence</span>
    <span>Generated on ${new Date().toLocaleString()}</span>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 250);
    };
  </script>
</body>
</html>`;

  printWindow.document.write(html);
  printWindow.document.close();
}
