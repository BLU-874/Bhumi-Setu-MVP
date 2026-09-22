# Phase 5.2.1 — Drone source contract and staged integration

## Objective and scope

Accept provenance-aware derived building vectors through the existing source workflow. **Phase 5.2.1 does not perform live orthophoto inference.**

**The staged AI-derived footprints are demonstration fixtures and are not cadastral truth.** No ProjectVaayu files were changed, copied, or loaded. No model was trained. No dependencies, branch, database credentials, migrations, or alternate reconciliation engine were introduced.

## Architecture

```text
Drone / orthophoto
  -> [future extraction worker — not implemented]
  -> building GeoJSON FeatureCollection
  -> POST /api/sources (kind=buildings)
  -> prepare_source / existing CRS + schema + geometry normalization
  -> existing source persistence
  -> POST /api/runs with the selected buildings source ID
  -> existing spatial candidates + deterministic matching + Phase 5.1 ranking
  -> existing persistent review / append-only audit
```

The deterministic matcher, scoring weights, thresholds, candidate generation, ML ranker, normalization implementation, and persistence implementation were not edited in this checkpoint. No inference concepts were added to the matcher. The current reconciliation implementation computes its deterministic proposal before attaching the independent ML ranking; that order remains intact.

## Source contract

`backend/services/derived_footprints.py` defines a strict, vector-only properties contract:

| Field | Contract |
|---|---|
| `footprint_id` | Required nonempty string, unique within a source |
| `source_type` | `ai_derived_drone_footprint` |
| `source` | `drone_orthophoto` — fixture simulation is separately marked |
| `area_sqm` | Positive finite number or null |
| `model_name`, `model_version` | Nonempty strings or null |
| `model_artifact_sha256` | 64 hexadecimal characters or null |
| `inference_run_id`, `derived_from` | Nonempty identifiers or null |
| `segmentation_probability` | Finite number in [0,1] or null |
| `confidence_method` | `not_available` for null probability; an explicit method for a supplied probability |
| `demonstration` | Boolean; true for the staged fixture |

Geometry must pass the existing Polygon/MultiPolygon validation and repair path. Unlisted derived properties are rejected, including ownership/survey attributes and reconciliation scores. Existing ordinary sources retain their previous flexible schema. Mixed derived/ordinary feature collections and a derived subtype on a non-building source are rejected. Unknown provenance is normalized to null, never invented.

The optional API `source_type` identifies the source explicitly; it can also be inferred from consistently marked feature properties. The source remains `kind=buildings`. Metadata records the subtype, demonstration label, and common provenance values. When feature provenance differs, the source summary uses null and individual feature values remain authoritative.

## Persistence and confidence separation

The existing JSON payloads retain source metadata and per-feature provenance. The deterministic result already contains `footprint_properties`; saved records and review cases therefore preserve that provenance without a database redesign. Audit events continue to store human decisions and reference the persisted run/record, rather than duplicating the source payload.

Segmentation probability is never inserted into the deterministic formula or Phase 5.1 feature vector. Footprint quality is not implemented. The evidence panel separately displays extraction provenance, unavailable segmentation probability, deterministic confidence, and the existing ML match probability. The review detail displays the same provenance component. The Phase 5.1 model is trained on synthetic data; its displayed prediction is not segmentation accuracy, real-world validation, or legal certainty.

## CRS and staged fixture

`frontend/public/fixtures/staged-drone.geojson` contains six synthetic rotated building polygons, 7,099 bytes. They were constructed from the existing synthetic Pune geometry with smaller footprint dimensions, using only geometry and calculated metric area. No ownership, survey, parcel identity, or legal fields were copied into these features.

The fixture has EPSG:3857 input coordinates. Its foreign member `source_crs` supplies the API envelope metadata; it is an application import fixture with projected coordinates, not a strict RFC 7946 WGS84 interchange export. The existing normalizer converts it to EPSG:32643 for matching and EPSG:4326 for display. Original geometry and repair information are retained. API CRS support now includes EPSG:3857 alongside the two existing options; the rest of the application is not changed to Web Mercator.

All fixture extraction model, weight hash, parent imagery, inference ID, and segmentation probability values are null. There was no imagery or extraction run. The six footprints intentionally cover only a small part of the 500-parcel study area; many parcels will consequently have no overlapping candidate. This is workflow coverage, not a model benchmark.

## API and frontend changes

- `POST /api/sources`: optional derived `source_type`, EPSG:3857 input, and strict derived-feature validation; invalid imports return 422.
- Existing source listing/detail and `GET /api/layers/buildings?source_id=...` retain provenance without new endpoints.
- Existing `POST /api/runs` already accepts a building source ID; the frontend now sends the deliberate selection.
- Data Sources provides an explicit **Import staged drone fixture** action. No automatic seeding changes were made, including on remote databases. Re-importing creates a new immutable source ID, as normal ingestion does.
- Harmonization provides a building-source selector. The map and review continue to show the latest completed run; changing the selector alone does not mislabel existing results. The latest completed run's source is restored after reload.
- WebGIS retains the standard building layer and adds a teal derived footprint layer with an independent toggle. The selector controls the source for matching; the ordinary layer remains visual comparison context when a derived source is selected.
- Evidence and review panels show extraction provenance and an explicit synthetic notice. The dashboard preview remains the existing overview map; the independent derived toggle is on WebGIS.
- Playwright accepts `PLAYWRIGHT_BASE_URL` for isolated verification on alternate ports.

### Demo steps

1. Open Data Sources and import the staged drone fixture.
2. Open Harmonization, select that building source, and run harmonization.
3. Open WebGIS and toggle AI-derived drone buildings independently; inspect P0001–P0006.
4. Inspect extraction provenance, deterministic confidence, and ML match probability.
5. Open Review Queue, investigate or decide a derived case, then inspect Audit Trail.
6. Select standard buildings and run again to return to the original workflow.

## Validation

Backend command, from `backend/`:

```powershell
.venv/Scripts/python.exe -m pytest tests -q -k 'not test_training_serialization_evaluation_and_inference' --basetemp=../artifacts/phase521-pytest-final
```

Backend final result: **31 passed, 1 skipped, 1 deselected**, in 191.52 seconds. Two existing FastAPI/Starlette dependency deprecation warnings were emitted; no packages were changed.

The existing training/serialization/evaluation test is retained unchanged but deliberately deselected because it calls `train()`, conflicting with the explicit no-training instruction. The optional live PostGIS test is skipped without DATABASE_URL. No existing database was connected or modified. All database-dependent checks used isolated SQLite stores under ignored `artifacts/`.

New backend coverage includes contract rejection, subtype/provenance retention, EPSG:3857 round-trip and metric area, invalid polygon repair, source API/listing, selected-source reconciliation, existing ML fields, disabled-model deterministic parity, standard-source compatibility, all three review actions, stale-version rejection, audit persistence, and restart retention. Test-only non-null provenance/probability values validate transport and are not model performance claims.

Frontend verification:

- `npm.cmd run build`: passed; runs `tsc -b` and Vite production build.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5174 npm.cmd run test:e2e`: 2 passed, 1.4 minutes. In PowerShell the environment value was set with `$env:PLAYWRIGHT_BASE_URL` before invoking npm.
- Existing standard workflow and new staged import/selection/map/review/audit workflow both passed.
- No captured JavaScript page errors or browser console errors. Desktop and mobile overflow checks passed.
- The new test verifies exactly six rendered derived paths, independent toggles, provenance and score labels, review persistence across reload, audit events, and switching back to standard buildings.
- Screenshot `artifacts/phase521-evidence.png` was inspected visually.
- No separate frontend unit-test script exists; the configured frontend tests are Playwright E2E tests.

Verification servers used ports 8011/5174 and a uniquely named test database, leaving the existing services on 8000/5173 alone. The temporary verification servers were stopped after testing. Initial shell attempts needed the backend working directory for Python imports and `npm.cmd` because PowerShell blocks npm.ps1. Two initial new assertions were corrected to match the existing geometry error and `review.*` audit names; no engine change was needed.

## Exact Phase 5.2.1 file manifest

New files:

```text
PHASE5.2.1_REPORT.md
backend/services/derived_footprints.py
backend/tests/test_derived_sources.py
frontend/public/fixtures/staged-drone.geojson
frontend/src/components/FootprintProvenance.tsx
```

Modified files:

```text
backend/api/routes.py
backend/services/sources.py
frontend/playwright.config.ts
frontend/src/App.tsx
frontend/src/components/EvidencePanel.tsx
frontend/src/components/MapView.tsx
frontend/src/components/ReviewQueue.tsx
frontend/src/pages/DataSources.tsx
frontend/src/pages/Workspace.tsx
frontend/src/services/api.ts
frontend/src/styles.css
frontend/src/types/index.ts
frontend/tests/foundation.spec.ts
```

Working-tree caveat: pre-existing Phase 5.1 changes were present at the start. These included `.gitignore`, `README.md`, `backend/.env.example`, `backend/requirements.txt`, `backend/services/reconciliation.py`, evidence/types/browser-test changes, `PHASE5_REPORT.md`, `backend/ml/`, and `backend/tests/test_ml.py`. They were preserved. The evidence/types/browser-test files received additive Phase 5.2.1 changes. A diff against HEAD necessarily includes both phases; it is not accurate to describe the entire working tree as Phase 5.2.1-only.

Diff summary at completion:

```text
Phase 5.2.1 manifest: 13 modified files + 5 new files = 18 files
git diff --stat (tracked changes vs HEAD, includes existing Phase 5.1):
18 files changed, 177 insertions(+), 26 deletions(-)
git diff --check: passed
```

The five new Phase 5.2.1 files listed above are untracked and therefore are not included in `git diff --stat`. Ignored build/test output and isolated SQLite verification databases remain under their existing ignored directories. No commit was created.

## Limitations and intentionally absent work

No live ECW/GeoTIFF inference, raw image upload, GDAL/PyTorch service, GPU worker, training, weight loading, raster storage, job queue, object store, roads/water/rooftop extraction, change detection, or legal parcel updates. No extraction model compatibility or quality is claimed. Segmentation probabilities are transportable only when a future producer supplies them with a method; they are not independently verified by this contract.

Live PostGIS behavior remains unverified without the separate MVP database. Existing PostGIS JSON/vector persistence paths are unchanged and no migration is necessary for this metadata addition. Cross-dataset attribute absence remains visible; the existing scoring policy is intentionally preserved, including its treatment of available area evidence. No real-world candidate-ranking evaluation is implied.

Phase 5.2.2 and Phase 5.2.3 were not started.
