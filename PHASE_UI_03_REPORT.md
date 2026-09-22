# UI-03 final presentation update

Status: **Presentation implemented; supplied-image replacement is pending local originals.**

Preview: **http://127.0.0.1:5176/**

The latest final brief expands the earlier hero-only scope to the continuous page and map presentation. That brief now governs this report. No commit was made.

## Remaining input

The four supplied image previews are visible in the conversation, but no corresponding image files are accessible in the attachment directory. The directory for the final brief contains only `pasted-text.txt`. A question requesting local file paths is pending.

Consequently, the center satellite image and the cadastral, aerial, and GNSS source photographs have **not yet been replaced with the supplied originals**. Existing temporary assets remain, with their source credits retained. This is not a completed image-replacement delivery.

The supplied map preview is Google Maps rather than Bhumi-Setu. For the fourth source visual, an actual Bhumi-Setu workspace screenshot has been captured and integrated instead of representing Google Maps as this product.

## Files modified in the final-brief revision

- `frontend/src/pages/Landing.tsx`: continuous seven-section order, five pipeline stages, updated navigation and section numbering; removed the separate problem block.
- `frontend/src/components/ui/modern-hero.tsx`: source aspect ratio read from the loaded image; reduced enlargement; removed the Delhi/Landsat footer; updated image-use disclosure.
- `frontend/src/components/ui/modern-hero.css`: reconciliation screenshot uses contain rather than a crop; short-screen caption positioning corrected.
- `frontend/src/components/ui/hero-images.ts`: requested supporting copy; actual Bhumi-Setu reconciliation capture and attribution. Remaining original-image replacements are pending.
- `frontend/src/components/MapView.tsx`: satellite tile presentation, attribution, unavailable-imagery notice, overlay colors and transparency, cyan selected-result outline.
- `frontend/src/pages/Workspace.tsx`: satellite and existing street basemap choices; explicit synthetic-overlay label. Existing source/result selection, evidence and filtering behavior retained.
- `frontend/src/components/ReferenceWorkspace.tsx`: optional satellite context and honest reference-vector caption. No cadastral or GNSS layers invented.
- `frontend/src/styles.css`: satellite-error notice and attribution wrapping.
- `frontend/tests/landing.spec.ts`: updated five-stage assertion and navigation target; existing functional assertions retained.
- `PHASE_UI_03_REPORT.md`: this checkpoint.

Added during the final-brief revision:

- `frontend/src/pages/landing-presentation.css`: restrained, map-first landing presentation and responsive layout.
- `frontend/public/images/hero/bhumi-workspace.png`: actual local application capture, 1,394,207 bytes, with provider attribution visible.

Earlier UI-03 work in this same ongoing task also added `modern-hero.tsx`, `modern-hero.css`, `hero-images.ts`, and `frontend/tests/cinematic-hero.spec.ts`; added the five original temporary assets; updated `App.tsx` to lazy-load the landing route; and added Framer Motion through `package.json` / `package-lock.json`. The retired `ReconciliationScene.tsx` was removed. Existing skip-link and overflow safeguards remain in `landing.css`.

The repository had substantial pre-existing uncommitted work. The complete Git status includes other phases and should not be interpreted as this revision's change list.

## Hero and imagery

The approved sticky viewport, long scroll section, 25-75% to 0-100% polygon reveal, gradual zoom-out, fade, four distinct parallax movements, and final convergence remain. Normal browser scrolling is preserved. The existing implementation uses Framer Motion and native scrolling; ReactLenis was not installed in this codebase, and no Lenis dependency was added.

The center now enlarges the cover-sized image by 1.18 rather than 1.70. Its cover width uses the loaded image's actual aspect ratio, preventing distortion and avoiding a hard-coded ratio when the supplied replacement is available. No blur, artificial sharpening or image-generation filter was added. The original asset itself is still a resolution limitation until replaced.

The four labels and descriptors follow the requested order: CADASTRAL / Record geometry; DRONE AI / Observed footprint; GNSS / Ground observation; RECONCILIATION / One trusted picture. Supporting descriptions are updated. Credits remain accurate for the currently displayed assets; legacy source names cannot honestly be eliminated from attribution until their images are replaced.

The actual reconciliation screenshot is explicitly a synthetic benchmark capture, not a measured real-world accuracy result. Its evidence and probabilities come from an existing saved local run. The screenshot does not create or modify any record.

## Continuous page

The page now follows:

1. Cinematic hero
2. How it works
3. Existing functional workspace
4. Explainable reconciliation
5. Human review
6. Provenance / audit
7. Final CTA

The pipeline has INGEST, NORMALIZE, MATCH, RANK and REVIEW. Ranking copy keeps ML candidate ranking distinct from deterministic confidence, matching the existing implementation. No new application pages, reconciliation steps or backend features were introduced.

## Satellite GIS presentation

The map uses the public Esri World Imagery tile layer as geographic context, with the provider's current service attribution: Esri, Vantor, Earthstar Geographics, and the GIS User Community. The service metadata was read directly and attribution is visible in the map and capture.

- Cadastral outlines: yellow/gold.
- Building outlines: blue/cyan.
- GNSS observations: small red markers.
- Result statuses: existing green / amber / red semantics.
- Selected result: cyan outline.
- Lower fill opacity preserves underlying image detail.

Satellite and street basemap controls remain independent of source data. Neither moves nor transforms source geometry. Synthetic Pune overlays remain explicitly synthetic; they should not be interpreted as surveyed building/parcel alignment with the basemap. Lalpur displays staged reference vectors over generic imagery context, not the ProjectVaayu ECW or verified cadastral truth.

The map occupies most of the desktop workspace, with layer controls to the left and existing evidence to the right. At smaller widths the evidence panel moves below the map. Reference metadata, source provenance, layer toggles, review and audit logic remain intact.

Satellite tiles require network access and are subject to provider availability and usage terms. No imagery archive, model weight or large raster was copied. The map shows a notice if imagery fails, while retaining vectors.

Provider documentation:

- https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer
- https://doc.arcgis.com/en/arcgis-online/reference/display-copyrights.htm

## Verification

Commands run from `frontend`:

```powershell
npm.cmd run build
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:5178'
npm.cmd run test:e2e -- --timeout=180000
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:5176'
npm.cmd run test:e2e -- tests/cinematic-hero.spec.ts tests/landing.spec.ts --timeout=180000
```

Also ran `git diff --check` and separate trailing-whitespace checks for untracked source files.

Results:

- TypeScript (`tsc -b`): passed.
- Vite production build: passed; landing animation remains in a separate lazy-loaded chunk.
- Existing foundation E2E: all three passed, including persisted reconciliation/review/audit, staged drone-source workflow, and separate Lalpur reference mode.
- Final hero and landing E2E: all five passed after correcting the short-screen caption position; 31.9 seconds in the final targeted run.
- The full eight-test run initially caught that caption issue (7 passed, 1 failed). The issue was fixed and the five affected presentation/navigation tests were rerun successfully. No tests were removed or assertions disabled.
- Browser console/page exceptions: zero unexpected errors in successful checks. Deliberate HTTP 503 injection verifies the unavailable-backend UI separately.
- Actual workspace capture: 15 of 15 satellite tiles loaded in the inspected viewport; layer controls, source labels, selected record, evidence and attribution were visually checked.
- Responsive coverage: 1920x1080, 1440x1100, 1024x768, 768x1024, 390x844. No horizontal overflow; all four source captions fit at their fully visible scroll stage.
- Accessibility: keyboard skip link, semantic links/headings, focus styles, alternative text and reduced-motion static layout. Changing the preference during a session updates the presentation immediately.
- `git diff --check`: passed. Git emits pre-existing LF/CRLF notices, not whitespace errors.
- Backend SHA-256 audit: all 40 files in the turn-start snapshot unchanged.

Tests used a new isolated SQLite database under ignored `artifacts/`. No existing project database or PostGIS connection was used or modified. Test review/audit writes went only to that disposable database. No training, migrations or inference changes were performed.

## To complete image replacement

Provide local paths for the supplied satellite/map screenshot, yellow-parcel image, field-survey image and aerial photograph. They can be placed under `frontend/public/images/hero/` and identified by filename. The center and supporting image URLs, alt text, descriptions and credits are centralized in `frontend/src/components/ui/hero-images.ts`.

Once accessible, inspect original pixel dimensions, copy the exact originals, preserve required attribution, update this configuration, remove the old aerial CSS crop if inappropriate, and verify all scroll stages again. The central aspect ratio is now automatic. The approximately 500x360 parcel preview and 399x501 aerial preview shown in chat cannot acquire additional detail through CSS; higher-resolution originals would improve desktop results.

No claim is made that this pending asset replacement is finished. Safari, Firefox and physical mobile-device performance have not been tested. The UI work is ready for the original files; final image quality and all-placeholder removal remain pending.
