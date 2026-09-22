# PHASE UI 04 REPORT: Continuous Scroll-Driven Pipeline Redesign

## 1. Executive Summary

The Bhumi-Setu landing page was redesigned from a series of disconnected sections into a single, continuous cinematic narrative:
HERO -> ONE LARGE SCROLL-DRIVEN PIPELINE (Stages 01-09) -> LIVE BHUMI-SETU WORKSPACE

The presentation follows an Apple/high-end geospatial software aesthetic (charcoal, near-black `#0d1210`, warm off-white typography `#ebefe6`, restrained cyan/teal accents, and semantic status indicators) with an interactive two-column sticky layout on desktop and a clean sequential fallback on mobile. All underlying backend, ML models, matching engine, review queue, audit trail, and map workspace logic were preserved with zero modifications.

---

## 2. Files Changed and Created

### New Files Created
- `frontend/src/components/pipeline/ScrollPipeline.tsx`: Orchestrates the 9-stage progression, scroll triggers, and minimalist 01 - 09 progress navigation bar.
- `frontend/src/components/pipeline/PipelineStage.tsx`: Renders the left-side narrative block for each stage with intersection tracking.
- `frontend/src/components/pipeline/PipelineVisual.tsx`: Right-side sticky visual canvas rendering bespoke spatial visuals for all 9 stages with Framer Motion GPU transitions.
- `frontend/src/components/pipeline/scroll-pipeline.css`: Styling for sticky two-column layout, dark geospatial theme, and mobile flow.
- `frontend/tests/scroll-pipeline.spec.ts`: Comprehensive Playwright end-to-end test suite for pipeline navigation, visuals, viewports, and workspace transition.

### Files Modified
- `frontend/src/pages/Landing.tsx`: Integrated `<ScrollPipeline />` directly between the Hero and the live `<Workspace />`. Added transition banner "Now investigate the map" and preserved full live workspace mounting.

### Files Intentionally Untouched (Protected Logic)
- `backend/` (All Python routes, models, services)
- `backend/services/reconciliation.py` & `backend/services/matching.py`
- `frontend/src/components/MapView.tsx`
- `frontend/src/components/EvidencePanel.tsx`
- `frontend/src/components/ReviewQueue.tsx`
- `frontend/src/pages/AuditTrail.tsx`
- `frontend/src/components/FootprintProvenance.tsx`
- `frontend/src/components/ReferenceWorkspace.tsx`
- `frontend/src/components/RunControl.tsx`
- `frontend/src/services/api.ts`
- `frontend/src/types/index.ts`
- `frontend/src/App.tsx` routing

---

## 3. The 9-Stage Narrative Pipeline

| Stage | Title | Headline | Visual Description |
|---|---|---|---|
| **01** | **SOURCES** | *Different sources. One place.* | Heterogeneous spatial layers converging: Cadastral, Drone AI, and GNSS observations. |
| **02** | **NORMALIZE** | *Before they can agree, they need to speak the same language.* | Coordinate transformation grid (EPSG:24378 to UTM 43N), topology repair, schema alignment. |
| **03** | **RECONCILIATION** | *Which records describe the same place?* | Spatial interaction: parcel polygon, drone footprint, and GNSS monument point with IoU calculation. |
| **04** | **EVIDENCE** | *Every decision has evidence.* | Real evidence breakdown: ML Match Probability (92.4%), Deterministic Confidence (86/100), IoU %, GNSS containment. |
| **05** | **RESULTS** | *One map. Three outcomes.* | Semantic outcome classifications: Matched (Green), Needs Review (Amber), Conflict (Coral/Red). |
| **06** | **REVIEW** | *Uncertainty doesn't disappear. It gets escalated.* | Preserved ambiguity routed to officer desk with candidate alternatives and triage paths (Accept, Reject, Investigate). |
| **07** | **HUMAN DECISION** | *Automation proposes. People decide.* | Binding officer decision interface with reviewer credential, justification note, and optimistic concurrency version locking. |
| **08** | **AUDIT** | *Nothing disappears after the decision.* | Immutable chronological audit ledger tracing records from raw ingestion to officer sign-off. |
| **09** | **TRUSTED PICTURE** | *FROM FRAGMENTED DATA TO ONE TRACEABLE DECISION.* | Unified reconciled parcel composite with authenticated seal and multi-source spatial validation. |

---

## 4. Animation & Scroll Architecture

- **Animation Framework**: Native `framer-motion` (already in `package.json`, 0 new dependencies).
- **Layout Architecture**:
  - Left column: 42% width, containing paced narrative blocks (`min-height: 85vh`).
  - Right column: 58% width, `position: sticky; top: 90px; height: calc(100vh - 120px)`.
  - Visual Transitions: GPU-accelerated `opacity`, `scale`, and `AnimatePresence` cross-fades.
- **Progress Indicator**: Subtle, non-dashboard `01 - 09` step bar allowing quick jumping to any stage.
- **Mobile Fallback (`@media (max-width: 950px)`)**:
  - Sticky viewport disabled to prevent clipping and scrolling bugs.
  - Stages flow sequentially with embedded visual canvases.
  - No horizontal overflow across all tested viewports (390px, 768px, 1024px, 1440px, 1920px).
- **Accessibility**: Strict `@media (prefers-reduced-motion: reduce)` rules disable all transforms and long scrolls.

---

## 5. Transition to the Live Workspace

Directly following Stage 09, users encounter the transition section:
- **Headline**: *Now investigate the map.*
- **Supporting Text**: *Select a parcel. Inspect its evidence. Trace its source.*
- **CTA**: `EXPLORE WORKSPACE ->`
- **Product**: Mounts the full, uncompromised Bhumi-Setu interactive `<Workspace>`:
  - Vector Leaflet map with satellite imagery basemap.
  - Source layers toggle (Cadastral, Drone AI, GNSS).
  - Mode switching (Synthetic Benchmark vs Lalpur Real-World dataset).
  - Harmonization run triggers and live results inspection.
  - Interactive parcel selection with explainable Evidence Panel.

---

## 6. Validation Results

1. **TypeScript Compilation & Production Bundle Check**:
   `npm run build` (`tsc -b && vite build`) -> **Result**: Exit Code 0 (`✓ built in 5.36s`, 0 errors).
2. **Git Diff Check**:
   `git diff --check` -> **Result**: Exit Code 0.
3. **Playwright End-to-End Test Suite**:
   `npx playwright test tests/scroll-pipeline.spec.ts` -> **Result**: Exit Code 0 (`1 passed (6.3s)`).
4. **Visual Artifacts Generated**:
   - `artifacts/ui04-pipeline-stage-01.png`
   - `artifacts/ui04-pipeline-stage-04.png`
   - `artifacts/ui04-pipeline-stage-09.png`
   - `artifacts/ui04-pipeline-transition.png`
   - `artifacts/ui04-pipeline-mobile-390.png`

---

## 7. Dependencies Added
- **None**. Accomplished entirely using the existing dependency tree (`react`, `framer-motion`, `lucide-react`).
