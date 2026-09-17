# Phase 3 implementation report

Completed in `D:\Bhumi-Setu-MVP` only. The existing `D:\Bhumi-Setu`
repository was used as read-only reference. No commits or pushes were made.

## Delivered

React/Vite/TypeScript foundation with Overview, Data Sources, Harmonization,
WebGIS, live layer toggles, status filtering and record evidence. FastAPI
services perform deterministic reconciliation, return GeoJSON and save source
metadata, run history and result proposals in backend storage.

The prototype's weights, thresholds, fuzzy attribute matching, topology repair,
validation flags, GNSS containment boost and explanation were preserved.
Analysis now uses metric EPSG:32643, candidate filtering happens on repaired
geometry, original source geometry is retained, and building survey attributes
are preserved. These adaptations address concrete geometry/provenance defects.

## Actual generated and processed data

| Item | Count |
|---|---:|
| Cadastral parcels | 500 |
| Building footprint representations | 475 |
| GNSS observations | 350 |
| Matched proposals | 350 |
| Needs-review proposals | 100 |
| Conflict proposals | 50 |
| Proposals requiring review, including flagged high scores | 250 |
| Originally invalid parcel geometries, repaired to valid | 25 |
| Cadastral records participating in duplicate survey groups | 50 |
| Cadastral records missing owner/area | 25 |
| GNSS survey mismatch flags | 25 |
| Area discrepancy flags | 25 |

All records and geography are labelled **Synthetic demonstration dataset**.
The generator is deterministic, seed 26013, with strong matches, fuzzy attribute
variation, partial overlap, geometric displacement, missing buildings, contained
GNSS observations, GNSS mismatches, invalid geometry, duplicates, missing
attributes, area discrepancies and actual EPSG:4326/EPSG:32643 transformations.

## Database status

No separate MVP PostgreSQL/PostGIS database is available. No DATABASE_URL
credentials were created, and the existing prototype database was not used.

An explicitly labelled local SQLite demo adapter was used for verification.
Its database is `backend/data/demo.sqlite3`; this is backend persistence, not
browser localStorage. The local spatial candidate index is Shapely STRtree.

Prepared `001_foundation.sql` defines projects, data_sources, source_features,
harmonization_runs, harmonized_records, review_cases and audit_events, with
PostGIS geometry and a GiST index. A Psycopg adapter implements bulk spatial
candidate filtering. Migration/seeding require explicit CLI commands against
the future dedicated database. **Live PostGIS migration, seeding, query execution
and parity remain unverified.** Review/audit tables are foundation only.

## API endpoints

- GET / and /api/health
- GET /api/sources; POST /api/sources; GET /api/sources/{id}
- POST /api/runs; GET /api/runs; GET /api/runs/{id}
- GET /api/layers/cadastral, /api/layers/buildings, /api/layers/gnss
- GET /api/results, optionally filtered by run_id
- POST /api/harmonize compatibility endpoint

## Files created

All implementation files are new; there were no pre-existing application files
to modify in the new repository.

```text
.gitignore
README.md
PHASE3_REPORT.md
backend/
  .env.example
  main.py
  requirements.txt
  requirements.lock.txt
  api/routes.py
  data/generate.py
  domain/matching.py
  domain/normalization.py
  migrations/001_foundation.sql
  persistence/manage.py
  persistence/store.py
  services/reconciliation.py
  services/sources.py
  tests/test_foundation.py
frontend/
  .env.example
  index.html
  package.json
  package-lock.json
  tsconfig.json
  vite.config.ts
  playwright.config.ts
  src/App.tsx
  src/main.tsx
  src/styles.css
  src/components/EvidencePanel.tsx
  src/components/MapView.tsx
  src/components/Workflow.tsx
  src/pages/Dashboard.tsx
  src/pages/DataSources.tsx
  src/pages/Workspace.tsx
  src/services/api.ts
  src/types/index.ts
  tests/foundation.spec.ts
```

Generated/ignored artifacts: backend virtual environment, SQLite demo database,
three GeoJSON snapshots in `backend/data/generated`, frontend dependencies,
production build, test reports and screenshots in `artifacts/`.

## Packages installed

Backend, isolated in `backend/.venv`: FastAPI, Uvicorn, Shapely, PyProj,
RapidFuzz, Psycopg/binary, python-dotenv, pytest and httpx, plus transitive
dependencies. Exact installed versions are in `backend/requirements.lock.txt`.

Frontend: React, React DOM, React Router, Leaflet, React Leaflet, Lucide,
locally bundled DM Sans/Manrope fonts. Development dependencies: Vite, React
plugin, TypeScript/type definitions and Playwright. Resolved versions are in
`frontend/package-lock.json`. Final npm installation reported zero vulnerabilities;
`pip check` found no broken requirements.

## Verification completed

- Six backend tests passed: deterministic generation, source metadata and quality,
  CRS round trip, valid repaired geometry, preserved scoring, all three statuses,
  scenario behavior, API input/errors, stored results and application-restart reads.
- Production frontend build and strict TypeScript check passed.
- One end-to-end browser test passed: actual POST /api/runs, dashboard data,
  reload persistence, source cards, map, record selection, evidence, conflict filter,
  responsive pages at 1440/768/390 widths, mobile evidence and mobile navigation.
- No horizontal overflow or browser console/page errors in the final browser run.
- Backend health verified; API request logs inspected with successful responses.
- Desktop/mobile screenshots inspected. External font requests were replaced with
  bundled fonts after the browser test caught blocked network access.
- Backend was restarted; saved results remained accessible.

Backend tests emit two dependency deprecation warnings from the FastAPI/Starlette
test-client stack; they do not affect the passing tests or the running API.

## Limitations and Phase 4

Phase 3 is a small-data, single-worker, local demonstration. Source import and
selection are available through APIs, while the UI runs the default three sources.
No user-upload wizard, authentication, review decisions, audit UI, full data-quality
screen, change detection, ML or imagery extraction were built. The optional online
street basemap requires network access and was not part of the offline browser test.

Parcel-scale synthetic footprint geometry is intentional to demonstrate the
preserved IoU model. Real buildings and legal parcels can have different spatial
relationships; deployment needs relationship-aware rules and real evaluation data.
GNSS containment alone is not boundary accuracy. Scores are evidence scores,
not accuracy metrics or legal approvals. High-score validation flags remain visible
and require review.

Phase 4 should first verify the dedicated PostGIS deployment, then implement
persisted review decisions, notes, audit events and their screens. Future ML may
rank candidates using labelled human-reviewed cases; future computer vision may
extract spatial evidence from imagery. Neither is part of the current engine.
