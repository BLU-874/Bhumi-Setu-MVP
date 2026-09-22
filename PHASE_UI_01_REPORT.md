# Phase UI-01 — Landing page and product visual direction

Completed 18 September 2026. Frontend presentation checkpoint only; no commit created.

## Preview and demo

- Landing: http://127.0.0.1:5176/
- Operational overview: http://127.0.0.1:5176/overview
- Full workspace: http://127.0.0.1:5176/map
- Real-world workspace: http://127.0.0.1:5176/map?mode=real_world_reference
- Preview API: http://127.0.0.1:8013/api/health

The preview servers were left running. This preview uses an isolated SQLite database at `artifacts/ui01-preview-a8ab558f873d45668922fbe8a1df5faa.sqlite3`, containing the browser tests' demo runs and review decisions. It does not use the existing Bhumi-Setu database or invent DATABASE_URL credentials. Health reports local SQLite demo storage and no PostGIS connection. No environment file was changed.

Suggested demo flow:

1. Open the landing URL. Read “One parcel. Three realities.” and inspect the three actual synthetic source layers converging on parcel P0027.
2. Click **See How It Works** to inspect the seven-step pipeline.
3. Use the header **Workspace** anchor. Toggle synthetic layers and inspect the selected parcel's evidence. ML probability and deterministic confidence remain separate.
4. Switch to **Real-World Dataset**. Inspect a Lalpur building and its provenance; toggle **Original source outlines** against processed geometry. Unavailable cadastral/GNSS layers remain disabled.
5. Click **Open full workspace** or the hero **Explore Workspace** CTA to enter the existing operational application.
6. Use **Harmonization** to run a synthetic comparison, then **Review queue** to inspect a case and record a reviewer decision. Check **Audit trail** for its persisted event.
7. Return through the product brand to the landing page. Its saved synthetic evidence values reflect the actual API results.

## Design decisions

The three supplied references informed cinematic geospatial presentation, compact GIS controls, strong typography and a source-convergence story. The implementation is an original composition: navy surfaces, pale teal/cyan accents, precise borders, restrained depth and existing locally bundled Manrope/DM Sans fonts. No reference logos, screenshots, proprietary graphics or website assets were copied.

The first viewport combines the product statement, working workspace CTA, three source tiles, an actual-coordinate vector scene and a compact capability strip. The scene projects the existing synthetic GeoJSON around P0027 for presentation; it does not run another matching algorithm. The evidence card uses that parcel's saved deterministic confidence when available, explicitly labelled as synthetic evidence rather than measured accuracy. Without results it presents the workflow without a fabricated score.

The page contains the requested eight sections, in order:

1. Hero: one parcel, three realities, actual source geometry and two working CTAs.
2. Problem: heterogeneous sources, manual comparison and uncertainty.
3. How it works: ingest, normalize, candidate matching, ML ranking, evidence/confidence, human review, audit.
4. Workspace: the functioning application embedded with a left layer panel, central map and evidence/provenance panel on selection.
5. Explainable reconciliation: ML probability, deterministic confidence, geometry, attributes, GNSS and flags kept distinct.
6. Human review: proposed matches, uncertainty and investigation, linked to the actual queue.
7. Provenance/audit: lineage through source, processing, derived feature, reconciliation, reviewer and event.
8. Final CTA: links to the actual synthetic and Lalpur workspaces.

The root route now hosts the landing page; the previous dashboard remains at `/overview`. The operational application's styling remains separate from the landing's scoped dark styles. The embedded workspace is lazy mounted when approaching the viewport, and Workspace is a separate JS chunk. Entrance animations run once and honor reduced motion. Mobile navigation, visible keyboard focus, a skip link and a single page H1 are included.

## Existing components and assets reused

- `Workspace`, `WorkspaceModes`, `ReferenceWorkspace` and their existing URL-based mode selection.
- `MapView`, Leaflet and existing GeoJSON/API services; no second map engine.
- `EvidencePanel` and `FootprintProvenance` for actual saved evidence and source metadata.
- Existing source selection, independent staged-drone toggle, results filters and map selection.
- Existing review, audit, harmonization, source and overview routes.
- Existing local fonts and Lucide icons. New hero artwork is SVG rendered from actual project data, not a raster asset.
- Existing 24 staged Lalpur annotation polygons and their original/processed representations. These remain real-world reference geometry, not reconciliation ground truth or live model predictions.

## Files changed in this checkpoint

Paths below are relative to `D:\Bhumi-Setu-MVP`. Some files were already modified or untracked by earlier phases; this is a task-specific list, not a claim that the initial working tree was clean.

| Existing file | Change |
| --- | --- |
| `frontend/src/App.tsx` | Root landing route, dashboard moved to `/overview`, lazy full workspace; existing state/actions preserved. |
| `frontend/src/pages/Workspace.tsx` | Optional embedded mode, semantic heading and initial selection of saved evidence in the preview. |
| `frontend/src/components/ReferenceWorkspace.tsx` | Optional embedded heading level; original reference behavior retained. |
| `frontend/src/components/EvidencePanel.tsx` | Replaced obsolete “arrive in Phase 4” copy with current review/audit guidance. |
| `frontend/index.html` | Product title, description and theme color. |
| `frontend/tests/foundation.spec.ts` | Updated dashboard navigation assertions to `/overview`. |

## Files added

| File | Purpose |
| --- | --- |
| `frontend/src/pages/Landing.tsx` | Eight-section landing and embedded working workspace. |
| `frontend/src/pages/landing.css` | Scoped visual system, embedded GIS styling, responsive layouts and reduced motion. |
| `frontend/src/components/ReconciliationScene.tsx` | Actual-coordinate synthetic source visualization and saved evidence card. |
| `frontend/tests/landing.spec.ts` | Landing navigation, real data, responsive, keyboard and unavailable-backend coverage. |
| `PHASE_UI_01_REPORT.md` | This checkpoint report. |

Generated local QA artifacts include screenshots and the isolated demo database under ignored `artifacts/`, frontend build output and Playwright results. No dependencies were installed.

## Validation

| Check | Result |
| --- | --- |
| TypeScript | Passed `tsc -b`, executed by `npm.cmd run build`. |
| Production build | Passed; Vite built 1,656 modules. Main JS 403.51 kB (123.58 kB gzip), Workspace chunk 16.43 kB (5.14 kB gzip). |
| Existing browser/E2E regression suite plus new tests | All 5 tests passed against the actual isolated backend in approximately 1.2 minutes. |
| Final landing regression after label-wrap/skip-link polish | Both landing tests passed again in 8.1 seconds. |
| Browser console | Zero page or console errors in the normal tested landing and operational workflows. The separate failure test intentionally returns API 503 responses and verifies the honest fallback. |
| Responsive layouts | Tested 1920×1080, 1440×1000, 1024×768, 768×1024 and 390×844. No document overflow or headline/scene overlap. Existing operational mobile/tablet checks passed. |
| Navigation and CTA | Hero/full workspace links, section anchors, mobile menu and direct Lalpur CTA passed. |
| Map/data integrity | Layer toggles, actual synthetic scores, 24 processed and 24 original Lalpur paths, unavailable layers and source provenance passed. |
| Persistence regression | Synthetic harmonization, persisted review after reload and audit event passed. Staged drone source reconciliation/review/audit also passed. |
| Accessibility | Keyboard skip link, one H1, mobile expanded state, accessible controls and reduced-motion behavior verified. This is not a complete accessibility certification. |
| Read-only landing behavior | No POST/PATCH/DELETE requests during landing/workspace exploration. |
| `git diff --check` | Passed; only Git's existing LF-to-CRLF notices. |
| Backend preservation | SHA-256 comparison of all 40 baseline backend files found zero changes, additions or removals, excluding runtime caches/environment and database/log artifacts. |
| Local services | Landing HTTP 200; isolated API health ready with SQLite and PostGIS explicitly false. |

Commands used from `frontend`:

```powershell
npm.cmd run build
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:5176'
npm.cmd run test:e2e -- --timeout=180000
npm.cmd run test:e2e -- tests/landing.spec.ts --timeout=180000
```

Screenshots in `artifacts/`: `ui01-hero-1920.png`, `ui01-hero-1440.png`, `ui01-hero-1024.png`, `ui01-hero-768.png`, `ui01-hero-390.png`, `ui01-landing-full.png`, `ui01-workspace-synthetic.png`, `ui01-workspace-lalpur.png`. Desktop, mobile, full-page and both workspace compositions were visually inspected. A clipped long Lalpur layer label and an offscreen skip-link screenshot artifact were corrected and rechecked.

## Limitations and visual follow-up

- No suitable bundled aerial preview asset was available. The landing uses actual geospatial vectors on a restrained grid rather than pretending an unrelated image depicts the study area. The existing optional street basemap remains available in synthetic mode and requires network access. No new imagery provider or ECW pipeline was introduced.
- Synthetic parcels naturally retain their controlled benchmark geometry. The authentic Lalpur footprint mode provides the real-world geometry contrast, with explicit provenance and limitations.
- On mobile, the hero source scene follows the headline and CTA; dense GIS controls and evidence stack for readability. The real-world section is taller because existing disclosure, building list and provenance remain visible.
- Lalpur imagery, roads, cadastral links and GNSS relationships remain unavailable in this UI. There is no Lalpur accuracy or reconciliation score. Existing source licensing uncertainty remains visible.
- Saved values depend on an available backend and saved run. An unavailable backend produces a clear retry message and no invented confidence values.
- No known clipping or overlap remains at the checked viewport sizes. A future appropriately licensed lightweight aerial preview could add texture, but it is not part of this checkpoint. Cross-browser and physical-device visual review remains outside the Chromium-based checks performed here.
- PostGIS was not connected or verified in this UI checkpoint. Backend architecture, source/provenance contracts, matching, ML artifacts/training and review/audit logic were not changed. The old and reference repositories were not modified.

Stopped at UI-01. No Phase 5.2.3, ECW inference, raster worker, training, new model or backend architecture work was started.
