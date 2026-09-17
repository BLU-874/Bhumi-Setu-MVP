# BHUMI-SETU

**Explainable Geospatial Reconciliation Engine**

SIH26013 — Automated Integration & Intelligent Harmonization of Multi-source
Geospatial Data for Urban Land Record Management.

Phase 4 foundation. All included geography, ownership records and survey
observations are a **Synthetic demonstration dataset**, generated near Pune.
There is no trained ML, imagery inference or official land record in this demo.

## Start locally (PowerShell)

Backend, from the new repository:

```powershell
cd D:\Bhumi-Setu-MVP\backend
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Frontend, in a second terminal:

```powershell
cd D:\Bhumi-Setu-MVP\frontend
npm.cmd ci
npm.cmd run dev
```

Open http://127.0.0.1:5173. API docs: http://127.0.0.1:8000/docs.
`npm.cmd` avoids the blocked PowerShell npm script wrapper.
Bundled fonts and the default coordinate map work without external web services.
The optional OpenStreetMap street basemap requires internet access.

### Storage modes

With no `DATABASE_URL`, the server explicitly uses **local SQLite demo storage**
at `backend/data/demo.sqlite3`. It seeds deterministic sources once, saves every
run and its result features, and retrieves them after reload or server restart.
It uses Shapely's STRtree for spatial candidate filtering. This is a local
verification adapter, not a claim that PostGIS has been connected.

The deployment adapter uses PostgreSQL/PostGIS with a single bulk ST_Intersects
candidate query and a GiST spatial index. A separate MVP database is not yet
available. Its integration and migration are **not live-database verified**.
Never configure the old prototype's database or credentials here.

When a dedicated MVP PostGIS database is ready:

1. Create `backend/.env` using `backend/.env.example` as guidance and supply its
   actual `DATABASE_URL`. No credentials are included in this repository.
2. From `backend`, explicitly run:

```powershell
.venv\Scripts\python -m persistence.manage migrate --confirm-mvp-database
.venv\Scripts\python -m persistence.manage seed --confirm-mvp-database
```

3. Restart the backend. Startup checks configured database availability; it does
   not automatically migrate or seed a remote database and does not silently
   fall back if that connection fails.

Frontend API address is configured with `VITE_API_BASE_URL` in `frontend/.env`.
Backend CORS origins use `CORS_ORIGINS` in `backend/.env`.

## What is implemented

- React/Vite/TypeScript application: Overview, Data Sources, Harmonization,
  basic WebGIS, selectable result records, evidence panel.
- Deterministic generator: 500 parcels, 475 footprint representations and 350
  GNSS observations. Seed 26013; varied dimensions, synthetic wards and street
  gaps. Counts shown by the UI come from stored source metadata.
- Source CRS transformation, field alias normalization, geometry repair,
  quality metadata, originals and normalized/repaired geometries retained.
- Actual matching using the adapted old engine, persisted runs and proposals.
- Data source creation via JSON API; upload/mapping/source-selection UI is deferred.
- PostGIS schema: projects, data_sources, source_features, harmonization_runs,
  harmonized_records, review_cases, audit_events.
- Persistent review queue with optimistic version checks and append-only audit events.
- Audit trail screen showing reviewer, action, record, timestamp, before/after state and note.

The generated scenarios include strong correspondence, fuzzy attribute variations,
partial overlap, displacement, missing buildings, GNSS containment and survey
mismatch, invalid geometry, duplicate surveys, missing owner/area and declared-area
discrepancies. Inputs actually use both EPSG:4326 and EPSG:32643.

### Processing and preserved rules

Source preparation performs normalization and repair on import. A run reuses these
stored artifacts, finds spatial candidates, compares attributes, scores them and
saves proposed results. The UI shows request state and actual completed results;
it does not animate fictional stage progress.

The scoring engine was adapted from `D:\Bhumi-Setu\backend\matching.py` without
changing its 65% IoU / 35% attribute weighting, rounding, thresholds or eight-point
GNSS containment boost. Field aliases, owner and survey RapidFuzz ratios, area
similarity, duplicate checks, validation flags and contribution breakdowns remain.
The implementation is **rule/evidence based**, not trained AI/ML.

Concrete adaptations:

- Use UTM 43N metre-based geometry for Pune IoU; WGS84 is used only for delivery
  to the map. This avoids planar area calculations in longitude/latitude.
- Repair before spatial candidate filtering, so invalid polygons do not break
  PostGIS predicates; retain original validity and the original normalized
  geometry for the engine's repair evidence.
- Preserve building survey fields that the old database query discarded.
- Add per-attribute evidence, source repair metadata and `review_required`.
- A score of 75 or above remains `matched`, but any validation flag still requires
  review. A matched classification is a proposal, not human approval.
- GNSS survey mismatch still receives the preserved containment boost; its flag
  and review requirement are explicit. Containment does not prove boundary accuracy.

Confidence is a weighted evidence score, not measured accuracy or a calibrated
probability. Thresholds: >=75 matched; >=40 needs_review; below 40 conflict.
Missing observations are neutral. Missing attributes are visibly limited evidence.
The survey comparator strips punctuation and uses fuzzy similarity; it does not
semantically equate the `SR` and `SurveyNo` prefixes.

Synthetic footprints are intentionally parcel-scale comparison polygons for this
preserved overlap engine. Real building footprints and legal parcels describe
different entities: production adoption needs relationship-aware matching rules
and real evaluation data, not an assumption that their boundaries should coincide.

## API

| Method | Endpoint | Behavior |
|---|---|---|
| GET | /api/health | Storage mode and availability |
| GET | /api/database/verify | Safe PostGIS/schema/geometry verification status |
| GET | /api/sources | Actual source metadata and quality counts |
| POST | /api/sources | Prepare/store synthetic GeoJSON input |
| GET | /api/sources/{id} | One source's metadata |
| POST | /api/runs | Run actual reconciliation and persist proposals |
| GET | /api/runs | Run history |
| GET | /api/runs/{id} | Summary, stage states, source IDs and policy |
| GET | /api/layers/cadastral | Normalized WGS84 cadastral layer |
| GET | /api/layers/buildings | Normalized WGS84 footprints |
| GET | /api/layers/gnss | Normalized WGS84 observations |
| GET | /api/results | Latest completed run; optional run_id |
| POST | /api/harmonize | Compatibility wrapper; returns GeoJSON |
| GET | /api/review-cases | Persistent cases, optionally filtered by run/status |
| GET | /api/review-cases/{id} | One review case with evidence |
| PATCH | /api/review-cases/{id} | Accept, reject or investigate with reviewer and expected version |
| GET | /api/audit | Append-only review audit events |

POST /api/sources accepts `name`, `kind`, `source_crs`, `collection`.
Only EPSG:4326/EPSG:32643 and 1–5,000 features per source are supported in this
foundation. POST /api/runs accepts cadastral, buildings and gnss source IDs;
the UI deliberately uses the default three demonstration sources.

## Verification

```powershell
cd D:\Bhumi-Setu-MVP\backend
.venv\Scripts\python -m pytest -q
.venv\Scripts\python -m data.generate
cd ..\frontend
npm.cmd run build
npm.cmd run test:e2e
```

Browser tests expect both local servers running and Playwright Chromium installed.
If absent, install it with `npx.cmd playwright install chromium`.
Tests generate screenshots under ignored `artifacts/` and use isolated temporary
SQLite stores for backend checks. Browser tests add real runs to the local demo.

## Phase 4 persistence and verification

The default local mode is SQLite and is **verified locally** for run persistence,
review decisions, optimistic conflicts and audit history across restart. It is a
demo adapter and does not provide PostGIS functions. The dedicated MVP
PostgreSQL/PostGIS database is **not configured, so live PostGIS verification is
not yet verified**. `/api/database/verify` reports this without exposing a URL or
credentials.

When the separate MVP database is supplied, configure only `backend/.env`, then
run the explicitly confirmed commands (from `backend`):

```powershell
.venv\Scripts\python -m persistence.manage verify --confirm-mvp-database
.venv\Scripts\python -m persistence.manage migrate --confirm-mvp-database
.venv\Scripts\python -m persistence.manage seed --confirm-mvp-database
```

Review decisions are written by the API only after validation and version checks.
Each accepted, rejected or investigating decision appends an audit event in the
same transaction. No browser state or localStorage is treated as persistence.

Deferred: authentication, enterprise permissions, municipal/utility federation,
distributed jobs, advanced change detection, drone/ORI processing and ML.
Future ML roadmap: reviewed decisions → labelled historical cases → ML-assisted
candidate ranking. Future imagery roadmap: imagery → computer-vision extraction
→ spatial evidence → reconciliation. Neither is implemented here.

Operational limits: single backend worker, synchronous small-data processing,
no production auth, no record editing, no decisions or legally authoritative
output. SQLite and PostGIS data stores are separate; no automatic transfer.
