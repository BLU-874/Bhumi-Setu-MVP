# Phase 5.2.2 — Real-world dataset experience

## Delivered experience

Workspace now has **Synthetic Benchmark** and **Real-World Dataset** modes. The real mode is accurately labelled **Lalpur, Ahmedabad, Gujarat**, including its workspace heading, application badge, and sidebar. It displays a small read-only subset of actual ProjectVaayu building annotations in their correct geographic position. Synthetic Pune reconciliation, Phase 5.1 ranking, staged drone-source ingestion, review, and audit remain separate and available.

**Lalpur real-world data is NOT a cadastral reconciliation benchmark.** There is no verified cadastral crosswalk, ownership/survey relationship, or GNSS relationship. The API rejects a reconciliation run using the Lalpur reference source before creating a run. The real workspace offers no reconciliation or review action for these polygons and does not display match scores.

## Exact provenance and representation

- Reference repository: `https://github.com/Kabeer2004/ProjectVaayu`
- Inspected commit: `2050e9c2561bcd733db120771d79e3dfec93cc9d`
- Original vector file: `sample_data/ShapeFiles/LalPur/Gujarat_Build_Up_Area_Type.shp`
- SHA-256: `95fbc5a015c4609c3c8144b3d65896e6c5de034c1b47982cbc43eafa96b41c98`
- Source DBF rows explicitly identify village `Lalpur`, district `Ahmedabad`, and state code `24`. The mixed source file also has Suragpur records; none were included in this fixture.
- Selection: first **24 single-part Lalpur records by numeric objectid**, out of 317 Lalpur building records. Multipart records are excluded by the bounded staging reader rather than guessed or flattened.
- Staged file: `backend/data/reference/lalpur-buildings.geojson`, 43,981 bytes.
- Original vertex coordinates are retained without rounding, simplification, translation, synthetic replacement, or scaling. Original `objectid`, shapefile record number, village/district identifiers, source path, and source hash are retained per feature.
- The manifest retains SHA-256 values for the SHP, SHX, DBF, PRJ, CPG, and referenced ECW, plus the original projection WKT.
- The ProjectVaayu README describes the supplied shapefiles as manually created annotations. These are **original source annotations staged into GeoJSON**, not predictions produced by Bhumi-Setu or newly inferred footprints.
- No ECW, complete shapefile, model weight, or other large reference asset was copied. The reference repository was only read and its Git status remained clean.

The one-time `backend/data/stage_lalpur.py` utility is explicit and reproducible:

```powershell
backend/.venv/Scripts/python.exe backend/data/stage_lalpur.py --reference D:/ProjectVaayu
```

It reads SHP/DBF using Python's standard library and writes only the fixed fixture path inside this repository. The application never executes the staging utility at runtime and does not need ProjectVaayu, GDAL, raster support, an external service, login, or an upload to show the committed subset.

No explicit code/data licence was found in ProjectVaayu. The manifest and UI identify redistribution permission as unverified. Local inclusion of this small staged representation follows this phase's explicit instruction; no assertion of an open-data licence or permission for public redistribution is made.

## Source contract and API

The fixture descriptor includes:

```text
id: lalpur-reference-v1
kind: buildings
dataset_type: real_world_reference
location: Lalpur, Ahmedabad, Gujarat
source_type: real_world_orthophoto_building_data
imagery_source: ProjectVaayu reference dataset
synthetic: false
benchmark_eligible: false
cadastral_truth_available: false
reconciliation_ground_truth_available: false
gnss_available: false
read_only: true
representation: staged_subset_of_original_vector_annotations
```

Model name/version, artifact hash, inference run, and segmentation probability remain null. No owners, survey numbers, parcel links, GNSS points, or reconciliation confidence values were introduced.

The source uses **the existing `prepare_source()` normalization and source/layer API contracts**, with a small read-only bundled-source provider. It is file-backed rather than inserted into the Pune demo project database. There is no new database, table, migration, or independent matching system.

| API | Behavior |
|---|---|
| `GET /api/sources` | Existing persisted-source listing unchanged; preserves synthetic UI and source selection |
| `GET /api/sources?dataset_type=real_world_reference` | Returns the bundled Lalpur source metadata |
| `GET /api/sources/lalpur-reference-v1` | Returns that same metadata |
| `GET /api/layers/buildings?source_id=lalpur-reference-v1` | Normalized, validated footprints in display CRS |
| Same request with `representation=source` | Original vector coordinates, reprojected directly for display |
| `POST /api/runs` selecting the reference ID | 422: verified correspondence unavailable; no run created |
| `POST /api/sources` attempting to reimport marked reference features | 422: read-only reference cannot be relabelled as an ordinary/synthetic import |

Default source-listing and health behavior remain compatible with the synthetic benchmark. Dataset-specific truth and synthetic flags come from the reference source metadata, not the legacy health endpoint's default-demo flag. The real source does not pollute synthetic source selectors, metrics, runs, review cases, or audit entries.

## CRS and geometry processing

The source PRJ resolves to **EPSG:3857**. The projected fixture is an application ingestion representation with explicit CRS metadata, not an RFC 7946 WGS84 export. `prepare_source()` calls the existing normalizer to produce **EPSG:32643** metric geometry and existing validation/repair evidence. Web layers use **EPSG:4326** through the same reprojection machinery as synthetic sources.

The source-outline layer transforms untouched original vector coordinates directly from EPSG:3857 to EPSG:4326. The processed layer transforms normalized metric geometry to EPSG:4326. These are independently toggled, with orange dashed original outlines and blue processed polygons. The UI explains that valid geometries may look identical; this is a truthful vector normalization comparison, not an imagery segmentation before/after result.

## Available and unavailable data

| Data | Demo status |
|---|---|
| Building annotations | 24 actual polygons available locally, selectable and toggleable |
| Original source outlines | Available as a separate comparison toggle |
| Orthophoto | Real ECW exists in ProjectVaayu; metadata only here; no raster/preview copied or fabricated |
| Roads | Real polygon shapefile exists in ProjectVaayu; not staged or rendered; disabled toggle explicitly says so |
| Cadastral truth | Unavailable, disabled and unchecked |
| GNSS | Unavailable, disabled and unchecked |
| Model inference/probabilities | Unavailable/null |
| Reconciliation benchmark | Ineligible; no metrics reported |

Road ingestion would require extending the current three-kind source architecture; this optional layer was deferred to keep the checkpoint small. Original/processed controls compare real vectors only. No fake imagery placeholder is used.

## Frontend and reusable state

- `WorkspaceModes` exports the two mode definitions and a reusable selector.
- `/map?mode=real_world_reference` provides a direct real-workspace link for a future landing-page section. Reload retains the URL-selected mode.
- The synthetic workspace stays mounted but hidden while real mode is active, preserving its selected evidence/filter state when switching back.
- `ReferenceWorkspace` provides source cards, map toggles, feature selection, provenance, and explicit unavailable data states using the existing visual style.
- `MapView` is reused with a reference-layer input; no second map library or basemap request is required.
- `FootprintProvenance` supports the real source without displaying the AI-derived fixture label or invented confidence values.
- The app badge and sidebar change with the active map mode so Lalpur is not labelled Pune or synthetic.
- Existing Data Sources, EvidencePanel, review, and audit behavior were retained. No landing-page redesign was made.

## Verification

Backend command (from `backend/`):

```powershell
.venv/Scripts/python.exe -m pytest tests -q -k 'not test_training_serialization_evaluation_and_inference' --basetemp=../artifacts/phase522-tests
```

Backend result: **34 passed, 1 skipped, 1 deselected** in 394.07 seconds. Two existing FastAPI/Starlette deprecation warnings were emitted. The exact reference-file comparison passed locally.

`npm.cmd run build`: **passed**, including `tsc -b` and the Vite production build. No separate frontend unit-test script is configured; frontend tests use Playwright.

Final Playwright result: **3 passed in 3.6 minutes**, with no captured browser console or JavaScript page errors. The existing synthetic/review/audit workflow, Phase 5.2.1 staged workflow, and new Lalpur workflow all passed. Desktop and mobile screenshots (`artifacts/phase522-lalpur-desktop.png` and `artifacts/phase522-lalpur-mobile.png`) were inspected; mobile overflow checks passed. Invocation from `frontend/`:

```powershell
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:5175'
npm.cmd run test:e2e -- --timeout=120000
```

As in Phase 5.2.1, the existing training test is retained but excluded because it trains models, contrary to this phase's instruction. Live PostGIS verification remains conditional on a separate configured database; no existing database was connected or changed. Tests use isolated SQLite storage under ignored `artifacts/`.

New backend tests cover location/flags/CRS, null model evidence, actual geometry validity, original geometry retention, no ownership/GNSS links, source listing/detail/layers, original-versus-processed coordinates, rejection of incompatible layers and real-data reconciliation, read-only behavior, and exact geometry/ID/hash comparison against the locally available reference repository. The last comparison is explicitly optional on machines without ProjectVaayu.

The browser suite retains the Phase 3/4/5.1 and Phase 5.2.1 tests and adds real-mode loading, labels, independent layer toggles, map feature selection, unavailable-layer states, provenance, mode persistence, preserved synthetic evidence, switching back and running synthetic reconciliation, responsive layout, and console-error assertions.

Initial browser verification ran alongside the backend suite and hit load/run timeouts; a Unicode encoding issue in the new test locators was also corrected. Final browser verification runs separately on fresh isolated storage, with 15-second assertion waits and a 120-second per-test command-line limit. Assertions and model behavior are unchanged. Test services use ports 8012/5175; the user's existing services and databases are left alone.

## Exact files changed in this checkpoint

Modified:

```text
backend/api/routes.py
backend/services/sources.py
frontend/playwright.config.ts
frontend/src/App.tsx
frontend/src/components/FootprintProvenance.tsx
frontend/src/components/MapView.tsx
frontend/src/pages/Workspace.tsx
frontend/src/services/api.ts
frontend/src/styles.css
frontend/src/types/index.ts
frontend/tests/foundation.spec.ts
```

Added:

```text
PHASE5.2.2_REPORT.md
backend/data/stage_lalpur.py
backend/data/reference/lalpur-buildings.geojson
backend/services/reference_dataset.py
backend/tests/test_reference_dataset.py
frontend/src/components/ReferenceWorkspace.tsx
frontend/src/components/WorkspaceModes.tsx
```

The repository already contained uncommitted Phase 5.1 and Phase 5.2.1 work. It was preserved. Git diffs against HEAD include these earlier phases; the manifest above identifies this checkpoint's changes. No branch or commit was created. Build/test artifacts and temporary SQLite stores remain in existing ignored directories.

Checkpoint manifest: **11 modified files and 7 added files**. `git diff --check` passed. Tracked changes versus HEAD total **18 files, 312 insertions, 39 deletions**, including preserved earlier-phase work and excluding untracked additions. ProjectVaayu's working tree remained clean. Temporary verification servers were stopped after testing.

## Exact demo flow

1. Open **WebGIS workspace** (`/map`). The default is **Synthetic Benchmark**.
2. Select **Real-World Dataset**.
3. Confirm **Lalpur, Ahmedabad, Gujarat** and the real-world reference badge.
4. Inspect the imagery/building/road cards and unavailable cadastral/GNSS notice.
5. Toggle **Building footprints — processed** and **Original source outlines** independently.
6. Click a blue polygon or a **Building [original ID]** button.
7. Inspect the source ID, original record number, representation, source/analysis/display CRS, and unavailable model/probability values. Dataset provenance below the map shows the source path, commit, and hash.
8. Select **Synthetic Benchmark** to return to the preserved synthetic view.
9. Open Harmonization and run the existing selected synthetic building workflow; review and audit work as before.

## Limitations and remaining blockers

This is a 24-feature reference experience, not a complete Lalpur survey. It cannot evaluate cadastral matching accuracy, create legal correspondence, or validate Phase 5.1 metrics. Imagery rendering, roads, live inference, GPU processing, raw uploads, new training, and landing-page design are not implemented. Public redistribution permission remains unverified. Live PostGIS checks require the separate MVP database.

The local building-reference experience requires no external services or runtime access to ProjectVaayu. No Phase 5.2.3 work was started.
