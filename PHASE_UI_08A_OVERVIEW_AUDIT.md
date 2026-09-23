# BHUMI-SETU — UI INFORMATION ARCHITECTURE AUDIT
## PHASE UI-08A: READ-ONLY AUDIT & ARCHITECTURAL DECOMPOSITION

**Date:** September 23, 2026  
**Status:** Audit & Analysis Only (Strictly Read-Only — No Code Changes)  
**Target View:** `http://127.0.0.1:5173/overview`  
**System:** Bhumi-Setu MVP (Geospatial Reconciliation & Decision-Support Platform)

---

## 1. Current Route Architecture

Routing in Bhumi-Setu is governed by `frontend/src/App.tsx` using `react-router-dom`:

1. **Root Route (`/`):**
   - Intercepted at line 85 of `App.tsx`:
     ```tsx
     if (location.pathname === '/')
       return <Landing layers={layers} results={results} controls={controls} error={error} onRetry={() => void refresh()} />;
     ```
   - Renders the standalone, immersive cinematic Landing Page (`Landing.tsx`). The application shell (`.app-shell`, sidebar, topbar) is **not** rendered on `/`.

2. **Application Shell Routes (`/overview`, `/data-sources`, `/map`, `/review`, `/audit`, `/harmonization`):**
   - Rendered within `<div className="app-shell">` (lines 87–91 of `App.tsx`), consisting of:
     - Fixed left sidebar (`<aside className="sidebar">`, 236px width)
     - Main viewport (`<div className="main-shell">`)
     - Persistent top navigation bar (`<header className="topbar">`)
     - Content container (`<main className="page-content">`)
     - Persistent footer (`<footer className="page-footer">`)

3. **Target Route (`/overview`):**
   - Defined at line 90 of `App.tsx`:
     ```tsx
     <Route path="/overview" element={<Dashboard sources={sources} run={latest} layers={layers} results={results} running={running} onRun={() => void run()} />} />
     ```
   - Mounts the `Dashboard` component from `frontend/src/pages/Dashboard.tsx`.

---

## 2. Component Tree of `/overview`

```text
/overview
└── App (frontend/src/App.tsx)
    ├── Aside (.sidebar)
    │   ├── Brand Link -> "/" (with /images/bhumi-setu-logo-light.png)
    │   ├── Navigation Section 1: "RECONCILIATION WORKSPACE"
    │   │   ├── NavLink -> "/overview" ("Overview", icon: LayoutDashboard) [ACTIVE]
    │   │   ├── NavLink -> "/data-sources" ("Data sources", icon: Database)
    │   │   ├── NavLink -> "/harmonization" ("Harmonization", icon: GitMerge)
    │   │   └── NavLink -> "/map" ("WebGIS workspace", icon: Map)
    │   ├── Navigation Section 2: "HUMAN OVERSIGHT"
    │   │   ├── NavLink -> "/review" ("Review queue", icon: ClipboardCheck)
    │   │   ├── NavLink -> "/audit" ("Audit trail", icon: History)
    │   │   └── Static Div: "Data quality" (icon: ShieldCheck, badge: 05) [NO ROUTE / DISABLED]
    │   └── Sidebar Bottom (.study-card)
    │       ├── Live Dot + Study Area: "Pune Residential Study Area (Kothrud)" (from STUDY_AREA)
    │       ├── Subtitle: "Synthetic demonstration dataset"
    │       ├── Badge: "PHASE 4 · REVIEW"
    │       └── Attribution: "SIH 2026 / SIH26013"
    └── Main Shell (.main-shell)
        ├── Header (.topbar)
        │   ├── Breadcrumb: Home logo link "/" + "/" + "Overview"
        │   └── Topbar Right:
        │       ├── Dataset Chip: "SYNTHETIC DEMONSTRATION" (or "REAL-WORLD REFERENCE")
        │       ├── Connection Status: "PostGIS connected" (or "Local demo storage")
        │       └── User Avatar: "DO" (Demo Officer)
        ├── Page Content (.page-content)
        │   └── Dashboard (frontend/src/pages/Dashboard.tsx)
        │       ├── Hero (.hero)
        │       │   ├── Copy (.hero-copy)
        │       │   │   ├── Eyebrow: "EXPLAINABLE GEOSPATIAL RECONCILIATION ENGINE"
        │       │   │   ├── Title: "Bring clarity to fragmented land records."
        │       │   │   ├── Paragraph: "Bring fragmented land datasets together, identify corresponding records, explain conflicts, and route uncertain cases for human review."
        │       │   │   ├── Actions (.hero-actions):
        │       │   │   │   ├── Primary Button: "Run harmonization" (calls onRun() -> api.run())
        │       │   │   │   └── Text Link: "Explore data sources" (navigates to /data-sources)
        │       │   │   └── Note (.hero-note): "Explainable rules · Visible evidence · Human oversight"
        │       │   └── Diagram (.hero-diagram)
        │       │       ├── Caption: "MULTIPLE SOURCES. ONE EXPLAINED RESULT."
        │       │       ├── Sources Row: "Revenue records", "Building footprints", "Survey observations"
        │       │       ├── Connectors (dashed lines)
        │       │       ├── Engine Box: "BHUMI-SETU | Normalize · Compare · Explain"
        │       │       └── Output Arrow: "Evidence-backed match proposal"
        │       ├── Current Demo Data (.inventory-heading + .inventory-grid)
        │       │   ├── Eyebrow: "YOUR CURRENT DEMO DATA"
        │       │   ├── Title: "Three perspectives on the same place"
        │       │   ├── Link: "View sources" -> /data-sources
        │       │   └── Cards (3x .inventory-card linking to /data-sources):
        │       │       ├── Cadastral: "Cadastral parcels" | "500 features" | "Ready / EPSG:4326"
        │       │       ├── Buildings: "Building footprints" | "475 features" | "Ready / EPSG:32643"
        │       │       └── GNSS: "GNSS observations" | "350 features" | "Ready / EPSG:32643"
        │       ├── Process Section (.workflow) [rendered by frontend/src/components/Workflow.tsx]
        │       │   ├── Eyebrow: "FROM FRAGMENTED TO CONNECTED"
        │       │   ├── Title: "One clear path to reconciliation"
        │       │   ├── Tag: "Rule / evidence-based"
        │       │   ├── 10 Steps (<ol> with step numbers, checkmarks, arrows):
        │       │   │   ├── 01 Data ingestion (completed)
        │       │   │   ├── 02 CRS normalization (completed)
        │       │   │   ├── 03 Schema normalization (completed)
        │       │   │   ├── 04 Geometry validation (completed)
        │       │   │   ├── 05 Spatial matching (completed)
        │       │   │   ├── 06 Attribute matching (completed)
        │       │   │   ├── 07 Confidence scoring (completed)
        │       │   │   ├── 08 Conflict detection (completed)
        │       │   │   ├── 09 Human review (future / Human oversight)
        │       │   │   └── 10 Harmonized record (future / Human oversight)
        │       │   └── Note: Dynamic string based on running/completed flags
        │       └── Dashboard Bottom (.dashboard-bottom)
        │           ├── Outcome Panel (.outcome-panel)
        │           │   ├── Eyebrow: "RECONCILIATION OUTPUT"
        │           │   ├── Title: "Latest run, explained" (or "Ready for the first comparison")
        │           │   ├── Duration: "{run.duration_seconds}s"
        │           │   ├── Status Counters (3x):
        │           │   │   ├── Matched: "350"
        │           │   │   ├── Needs review: "100"
        │           │   │   └── Conflict: "50"
        │           │   ├── Output Note: "500 parcels compared. 150 proposals require review..."
        │           │   └── Run Stamp: "Saved [Timestamp]" + Link -> /harmonization ("Run details")
        │           └── Map Preview (.map-preview)
        │               ├── Eyebrow: "PUNE · MAHARASHTRA"
        │               ├── Title: "The spatial picture"
        │               ├── Link: Square icon link -> /map
        │               ├── Preview Map Container: Renders MapView (frontend/src/components/MapView.tsx)
        │               ├── Floating Center Button: "Open WebGIS workspace" -> /map
        │               └── Footnote: "Synthetic study area · Actual backend GeoJSON"
        └── Footer (.page-footer)
            └── "BHUMI-SETU Explainable Geospatial Reconciliation Engine | SIH26013 · Phase 3"
```

---

## 3. Screenshot Section → Source File Mapping

| Screenshot Section | Component | File | Data Source | Stated Purpose | Assessment & Discrepancies |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Left Sidebar Navigation** | Sidebar inside `App` | `frontend/src/App.tsx` (lines 87) | Hardcoded `nav` array + `location.pathname` | Global product navigation across 6 pages | Over-fragmented navigation; contains dead placeholder (`Data quality`). |
| **Sidebar Study Area Card** | Study Card inside `App` | `frontend/src/App.tsx` (lines 87) | `STUDY_AREA` config (`config/studyArea.ts`) | Shows active study area location & phase badge | Shows "PHASE 4 · REVIEW", which is outdated legacy text. |
| **Topbar Header** | Topbar inside `App` | `frontend/src/App.tsx` (line 88) | `api.health()`, route path, dataset query param | Breadcrumb, connection indicator, user avatar | Functional and accurate. |
| **Hero: "Bring clarity to fragmented land records"** | `.hero` inside `Dashboard` | `frontend/src/pages/Dashboard.tsx` (line 10) | Static JSX copy + `running`, `sources` props | High-level marketing pitch for the reconciliation engine | **Complete duplication** of the Landing Page value proposition. Creates confusion on an internal page. |
| **Hero Diagram: "Multiple Sources. One Explained Result."** | `.hero-diagram` inside `Dashboard` | `frontend/src/pages/Dashboard.tsx` (line 10) | Static HTML/CSS diagram | Illustrates sources flowing into Bhumi-Setu engine | Purely decorative; duplicates Landing Stage 01/03 visuals. |
| **Three Perspectives on the Same Place** | `.inventory-grid` inside `Dashboard` | `frontend/src/pages/Dashboard.tsx` (lines 11–12) | `sources: Source[]` from backend `GET /api/sources` | Overview of input dataset volumes (500, 475, 350) | Live backend values, but hardcoded to synthetic IDs (`id === 'cadastral' \| 'buildings' \| 'gnss'`). Duplicates `RunControl.tsx`. |
| **One Clear Path to Reconciliation** | `Workflow` | `frontend/src/components/Workflow.tsx` (lines 1–5) | Hardcoded 10-step string array + `completed`, `running` flags | Visual pipeline showing execution progress | Duplicates the 9-stage Landing pipeline; omits Audit; labeled "Rule / evidence-based" (ignores Phase 5.1 ML). |
| **Reconciliation Output (Bottom Left)** | `.outcome-panel` inside `Dashboard` | `frontend/src/pages/Dashboard.tsx` (line 14) | `results.summary` from `GET /api/results/{run_id}` | Summary breakdown of latest run (Matched, Review, Conflict) | Functional, but duplicates metrics already in the Workspace bottom status strip and `RunControl.tsx`. |
| **The Spatial Picture (Bottom Right Map Preview)** | `.map-preview` inside `Dashboard` | `frontend/src/pages/Dashboard.tsx` + `MapView.tsx` (line 14) | `layers` & `results` GeoJSON from backend | Small map thumbnail teasing the WebGIS workspace | Non-interactive thumbnail with large overlay button; unnecessary friction when Workspace is a single click away. |

---

## 4. Sidebar Audit

The sidebar in `App.tsx` divides navigation into two categories:

### A. "RECONCILIATION WORKSPACE"
1. **`Overview` (`/overview`):**
   - *Component:* `Dashboard.tsx`
   - *Status:* Legacy dashboard from Phase 3. Mixes marketing hero, data card teasers, pipeline diagram, and a disabled mini-map.
   - *Critique:* Does not provide distinct operational value that is not already covered by Landing or Workspace.
2. **`Data sources` (`/data-sources`):**
   - *Component:* `DataSources.tsx`
   - *Status:* Standalone page listing source cards, CRS reprojections, GeoJSON field lists, and staged drone import.
   - *Critique:* Disconnected from where sources are actually chosen and run. In the canonical 3-pane Workspace, sources are already toggled and selected directly in Pane 1 (`RunControl.tsx`).
3. **`Harmonization` (`/harmonization`):**
   - *Component:* Inline JSX in `App.tsx` (line 90) rendering `Workflow.tsx`, a static formula panel ("65% geometry + 35% attributes"), and a historical run list.
   - *Critique:* **Major architectural redundancy.** "Harmonization" is an *operation* (a run lifecycle), not a separate workspace. Users can trigger harmonization from `/overview`, `/harmonization`, and `/map`.
4. **`WebGIS workspace` (`/map`):**
   - *Component:* `Workspace.tsx`
   - *Status:* Canonical GIS product interface (3-pane layout, interactive map, evidence dossier).
   - *Critique:* The name "WebGIS workspace" is verbose. In standard GIS / enterprise software, this is simply the **Workspace**.

### B. "HUMAN OVERSIGHT"
1. **`Review queue` (`/review`):**
   - *Component:* `ReviewQueue.tsx`
   - *Status:* Canonical, fully functional triage and decision interface for uncertain cases. Essential and correctly located.
2. **`Audit trail` (`/audit`):**
   - *Component:* `AuditTrail.tsx`
   - *Status:* Canonical, fully functional append-only ledger of all decisions and actions. Essential and correctly located.
3. **`Data quality` (`<div><ShieldCheck size={18}/><span>Data quality</span><small>05</small></div>`):**
   - *Status:* **DEAD ELEMENT.** It has no `to` route, no click handler, no component, and no page. It is wrapped in `.disabled-nav` with an arbitrary badge `"05"`. It is a leftover mockup artifact from Phase 3.

---

## 5. Hero Audit (`Dashboard.tsx`)

### Copy & Structure
```text
EXPLAINABLE GEOSPATIAL RECONCILIATION ENGINE
Bring clarity to fragmented land records.
Bring fragmented land datasets together, identify corresponding records, explain conflicts, and route uncertain cases for human review.
[ Run harmonization ]    Explore data sources ↗
Explainable rules · Visible evidence · Human oversight
```

### Analysis
1. **Where it comes from:** Hardcoded inline in `frontend/src/pages/Dashboard.tsx` (line 10).
2. **CTA Functionality:**
   - `<button className="primary" onClick={onRun}>`: Triggers `api.run(target)` via `App.tsx`. It runs the actual backend reconciliation, but **without showing the user which sources are selected or what parameters are active**. When it finishes, the results update on the page, but the user cannot interact with the map or see individual parcel evidence without navigating to `/map`.
   - `<Link to="/data-sources">Explore data sources`: Navigates to `/data-sources`.
3. **Duplication with Landing Page:**
   - The landing page hero (`modern-hero.tsx`) and Stage 01/03/04 already communicate this exact thesis with superior visual fidelity:
     - *"Turn fragmented land data into one trusted picture."*
     - *"Machine learning ranks. Evidence explains. People make the decision."*
4. **Architectural Evaluation:**
   - An internal application page (`/overview`) should **not** have a top-level marketing hero. When an operator or reviewer enters the application, they need operational data, system status, or active tasks—not promotional sales copy.

---

## 6. "Three Perspectives on the Same Place" Audit

### Data & Component Analysis
- **Component:** `Dashboard.tsx` (lines 11–12), rendering `.inventory-grid`.
- **Rendered Values:**
  - `500 Cadastral parcels`
  - `475 Building footprints`
  - `350 GNSS observations`
- **Data Source:**
  - Passed from `App.tsx` via `sources: Source[]`, which calls `GET /api/sources`.
  - For the synthetic benchmark dataset, the backend `sources.py` returns exactly 500 parcels, 475 building footprints, and 350 GNSS points.
  - Therefore, the counts are **live values from the backend**, not hardcoded strings in the JSX.
- **Flaws & Limitations:**
  1. **Source Resolution Limitation:** The component searches specifically by synthetic ID:
     ```tsx
     (['cadastral','buildings','gnss'] as const).map(kind => {
       const s = sources.find(x => x.id === kind);
       ...
     })
     ```
     If the user imports or selects an alternative source (e.g. `buildings-lalpur`), this section continues to display the benchmark `buildings` count (475), ignoring the user's active building selection.
  2. **Card Clicks:** Clicking any of these cards navigates to `/data-sources`, which is a static metadata catalog rather than an interactive inspector.
  3. **Terminology Check:**
     - UI names: `Cadastral parcels`, `Building footprints`, `GNSS observations`.
     - Backend names (`sources.py`): `'Cadastral / Revenue Parcels'`, `'Building Footprints / Drone-ORI representation'`, `'GNSS / Survey Points'`.
     - The UI omits the "Drone" modality, which weakens the connection to aerial sensor imagery.

---

## 7. Reconciliation Process Audit ("One Clear Path to Reconciliation")

### Implementation Analysis
- **Component:** `frontend/src/components/Workflow.tsx`.
- **Data Structure:** Hardcoded string array of 10 steps:
  ```ts
  const steps = [
    'Data ingestion',
    'CRS normalization',
    'Schema normalization',
    'Geometry validation',
    'Spatial matching',
    'Attribute matching',
    'Confidence scoring',
    'Conflict detection',
    'Human review',
    'Harmonized record'
  ];
  ```
- **Execution State:**
  - Steps 0–7 (Ingestion through Conflict detection) turn green (`.done` with `<Check size={13}/>`) when a completed run exists (`completed === true`).
  - Steps 8 and 9 (`Human review` and `Harmonized record`) are permanently styled with class `.future` (dashed border, labeled "Human oversight").
- **Backend Correlation:**
  In `backend/services/reconciliation.py`:
  - Line 58: `run['stages'].append({'name': 'Data ingestion', ...})`
  - Line 60: `for stage in ('CRS normalization', 'Schema normalization', 'Geometry validation')`
  - Line 89: `('Spatial candidate matching', 'Attribute matching', 'Confidence scoring', 'Conflict detection')`
  - Line 90: `{'name': 'Human review', 'status': 'deferred'}`
  - Line 91: `{'name': 'Harmonized record', 'status': 'proposed'}`
  The 10 steps match the internal backend stages in `reconciliation.py`.

### Comparison: Overview Process vs Backend vs Landing 9-Stage Pipeline

| Overview Process Step | Backend Code Equivalent | Landing 9-Stage Equivalent | Structural Alignment |
| :--- | :--- | :--- | :--- |
| **01 Data ingestion** | `reconciliation.py: Data ingestion` | **01 SOURCES** | **Identical concept:** Heterogeneous ingestion of Cadastral, Drone, GNSS. |
| **02 CRS normalization** | `domain/normalization.py: reproject()` | **02 NORMALIZE** | **Merged in Landing:** Landing Stage 02 combines CRS transformation (EPSG:24378 → UTM 43N). |
| **03 Schema normalization** | `services/sources.py: prepare_feature()` | **02 NORMALIZE** | **Merged in Landing:** Schema alignment is part of Stage 02. |
| **04 Geometry validation** | `domain/normalization.py: validate_and_repair()` | **02 NORMALIZE** | **Merged in Landing:** Topological repair (zero self-intersections) is in Stage 02. |
| **05 Spatial matching** | `reconciliation.py: STRtree candidate intersection` | **03 RECONCILIATION** | **Identical concept:** Intersection over Union (IoU) and bounding overlap. |
| **06 Attribute matching** | `reconciliation.py: attribute_evidence()` (fuzzy ratios) | **03 RECONCILIATION** / **04 EVIDENCE** | **Identical concept:** Survey number and owner string matching. |
| **07 Confidence scoring** | `domain/matching.py: calculate_confidence()` (65/35 + GNSS) | **04 EVIDENCE** | **Identical concept:** Deterministic confidence calculation. |
| **08 Conflict detection** | `domain/matching.py: thresholds` (< 40 conflict, 40-74 review) | **05 RESULTS** | **Identical concept:** Triage into Matched, Needs Review, Conflict. |
| **09 Human review** | `backend/domain/review.py` | **06 REVIEW** & **07 HUMAN DECISION** | **Expanded in Landing:** Landing splits review into Queue (06) and Binding Sign-off (07). |
| *(Missing in Overview)* | `persistence/store.py: save_event()` | **08 AUDIT** | **OMITTED IN OVERVIEW:** Overview completely ignores the Audit Trail stage! |
| **10 Harmonized record** | `reconciliation.py: status='completed'` | **09 TRUSTED PICTURE** | **Identical concept:** The authoritative single source of spatial truth. |

---

## 8. "Rule / Evidence-Based" Audit

- **Where it appears:** `frontend/src/components/Workflow.tsx`, line 4:
  `<span className="muted">Rule / evidence-based</span>`
- **Technical Reality:**
  - In earlier project iterations (Phases 1–3), Bhumi-Setu operated purely on deterministic rules: 65% geometric IoU + 35% attribute fuzzy match + GNSS containment boost.
  - In **Phase 5.1**, **Supervised ML Candidate Ranking** was added via `backend/ml/predict.py` (`Ranker` class using `RandomForestClassifier` trained on IoU, centroid distance, Hausdorff metric, fuzzy string ratios, and GNSS proximity).
  - In `EvidencePanel.tsx`, the evidence dossier explicitly displays:
    1. `DETERMINISTIC EVIDENCE` (IoU, String distance, GNSS point containment)
    2. `SUPERVISED ML RANKING` (Model version, ML match probability, Feature ranking)
- **Finding:**
  Calling the workflow exclusively `"Rule / evidence-based"` is **outdated and incomplete**. It ignores the machine learning ranking engine that was integrated in Phase 5.1 and contradicts the product narrative ("Machine learning ranks. Evidence explains. People make the decision.").

---

## 9. Terminology Audit Matrix

| Term | Where Used | Backend Meaning | UI Meaning | Consistency Assessment |
| :--- | :--- | :--- | :--- | :--- |
| **matched** | `matching.py`, `reconciliation.py`, `MapView.tsx`, `EvidencePanel.tsx`, `Dashboard.tsx` | Feature with confidence >= 75 and zero blocking validation flags. | Green badge / green parcel boundary / high-confidence match. | **CONSISTENT** across all layers. |
| **needs_review** | `matching.py`, `reconciliation.py`, `MapView.tsx`, `ReviewQueue.tsx`, `Dashboard.tsx` | Feature with 40 <= confidence < 75 OR topological validation flags. | Amber badge / amber parcel boundary / escalated to review queue. | **CONSISTENT** across all layers. |
| **conflict** | `matching.py`, `reconciliation.py`, `MapView.tsx`, `ReviewQueue.tsx`, `Dashboard.tsx` | Feature with confidence < 40 (severe geometry or attribute divergence). | Red/coral badge / cross marker / critical escalation. | **CONSISTENT** across all layers. |
| **review** / **Review queue** | `review.py`, `ReviewQueue.tsx`, Sidebar, Landing Stage 06 | Case requiring human officer review (`pending_review`). | Dedicated triage interface for accepting, rejecting, or investigating cases. | **CONSISTENT** across all layers. |
| **harmonization** | Sidebar, `Workflow.tsx`, `RunControl.tsx`, `reconciliation.py` | Executing the multi-source spatial intersection and reconciliation pipeline. | Sidebar uses it as a distinct page; Workspace uses it as an execution button; Workflow uses it as "Harmonized record". | **INCONSISTENT:** Harmonization is a core system action, not an independent page. |
| **evidence** | `reconciliation.py: attribute_evidence`, `EvidencePanel.tsx`, Landing Stage 04 | Specific mathematical metrics: IoU, centroid offset, fuzzy string scores, GNSS containment, ML probability. | Formal investigation dossier explaining why records matched or conflicted. | **CONSISTENT** across all layers. |
| **confidence** | `matching.py`, `types/index.ts`, `EvidencePanel.tsx` | Weighted score (0–100) combining geometry (65%), attributes (35%), and GNSS boost (8 pts). | Numeric score displayed on parcels and in evidence dossiers. | **CONSISTENT** across all layers. |
| **data quality** | Sidebar (`<small>05</small>`), `sources.py: quality` | Feature-level quality metrics (invalid geometries, repaired, missing fields). | Appears as a dead, unclickable sidebar link with a fake badge "05". | **INCONSISTENT / DEAD:** Mockup remnant that leads nowhere. |
| **source** vs **dataset** | Sidebar ("Data sources"), Workspace ("Dataset mode"), `types/index.ts` | `Source` = individual geospatial layer (Cadastral, Buildings, GNSS). | UI mixes "Data sources" (layers) with "Dataset mode" (Synthetic Benchmark vs Real-World Lalpur). | **AMBIGUOUS:** Needs clean separation between input layers (sources) and geographic study areas (datasets). |
| **synthetic benchmark** | `sources.py: LABEL`, `Workspace.tsx`, `App.tsx` | 500-parcel synthetic dataset generated near Kothrud, Pune. | Variously called "Synthetic Benchmark", "Synthetic Demonstration", or "Demo Data". | **MOSTLY CONSISTENT:** "Synthetic Benchmark" is the canonical term. |
| **real-world dataset** | `reference_dataset.py`, `App.tsx`, `Workspace.tsx` | Real drone building footprints from Lalpur, Ahmedabad. | Labeled as "Real-World Dataset", "Real-World Reference", or "STAGED VECTOR SUBSET". | **MINOR INCONSISTENCY:** Should consistently use "Real-World Dataset (Lalpur)". |

---

## 10. Information Architecture Problems on `/overview`

Inspection reveals five distinct structural problems with the current `/overview` page:

1. **Role Confusion (Marketing vs Application):**
   - The page cannot decide whether it is a marketing overview or an internal tool dashboard.
   - The large hero (`.hero`) and decorative diagram (`.hero-diagram`) repeat marketing slogans that were already delivered on the Landing page.

2. **Action Fragmentation & Headless Execution:**
   - The "Run harmonization" CTA in the hero executes the backend reconciliation pipeline in the dark. The user does not see layer toggles, cannot see the active dataset, and cannot inspect resulting parcel geometries without clicking through to `/map`.

3. **Workflow Redundancy:**
   - `Workflow.tsx` on `/overview` is an inferior, static 10-step summary that duplicates the cinematic 9-stage pipeline on the Landing page, yet omits the critical Audit Trail step and ignores ML ranking.
   - Furthermore, `Workflow.tsx` is rendered **again** on `/harmonization`.

4. **Mini-Map Teaser Trap:**
   - The `.map-preview` container embeds an instance of `MapView.tsx` in a non-interactive 203px box with selection disabled, capped with a prominent button: "Open WebGIS workspace".
   - Having a teaser preview of the main application map *inside the application itself* is redundant and frustrating.

5. **Navigation Sprawl in Sidebar:**
   - The sidebar exposes 4 separate links (`Overview`, `Data sources`, `Harmonization`, `WebGIS workspace`) for what is actually a single unified operational flow: Ingest Sources → Run Harmonization → Inspect Map & Evidence.

---

## 11. Functional Components That Must Be Preserved

The following components and files contain critical, production-tested functionality and **must remain completely intact**:

1. `backend/*` (All matching logic, ML ranking, persistence, routes, and database schemas).
2. `frontend/src/components/MapView.tsx` (Leaflet canvas, layer management, parcel selection, and conflict markers).
3. `frontend/src/components/EvidencePanel.tsx` (Investigation dossier with IoU, attribute string distance, GNSS containment, and ML scoring).
4. `frontend/src/components/ReviewQueue.tsx` (Canonical triage, accept/reject decisions, field verification modals, and printable decision records).
5. `frontend/src/pages/AuditTrail.tsx` (Immutable append-only ledger and cryptographic event replay).
6. `frontend/src/components/RunControl.tsx` (Canonical source toggles, run lifecycle controls, and live metric counts).
7. `frontend/src/pages/Workspace.tsx` (Institutional 3-pane GIS shell established in Phase UI-08).
8. `frontend/src/services/api.ts` & `frontend/src/types/index.ts` (API contracts and TypeScript interfaces).

---

## 12. Recommended Information Architecture

### Logical Information Ownership
To achieve a professional GIS / enterprise land-administration architecture, information should be organized by **functional role** rather than redundant preview cards:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. PUBLIC / EXPLANATORY SURFACE: LANDING PAGE (/)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│ • Cinematic Hero ("One parcel. Three realities.")                          │
│ • 9-Stage Scroll Pipeline (Sources → Normalize → Reconcile → Evidence →    │
│   Results → Review → Human Decision → Audit → Trusted Picture)              │
│ • Direct transition into live Embedded Workspace                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. APPLICATION CORE: BHUMI-SETU APPLICATION SHELL                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ PRIMARY OPERATIONAL ROUTE:                                                  │
│                                                                             │
│ • WORKSPACE (/map) — The Primary GIS Tool                                   │
│   - Pane 1: Data Sources & Harmonization Run Control                       │
│   - Pane 2: Dominant Interactive Leaflet Map & Layer Filters                │
│   - Pane 3: Evidence Investigation Dossier & ML Ranking Breakdown           │
│   - Bottom: Persistent Run Summary Status Strip (with direct links)         │
├─────────────────────────────────────────────────────────────────────────────┤
│ HUMAN GOVERNANCE & ACCOUNTABILITY ROUTES:                                   │
│                                                                             │
│ • REVIEW QUEUE (/review)                                                    │
│   - Active case triage for uncertain / conflict parcels                     │
│   - Officer credentials, decision notes, and locking                        │
│   - Field verification orders & Printable Decision Records                  │
│                                                                             │
│ • AUDIT TRAIL (/audit)                                                      │
│   - Immutable append-only transaction ledger                                │
│   - Chronological event replay and provenance verification                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ ADMINISTRATIVE / SYSTEM REPOSITORY ROUTE:                                   │
│                                                                             │
│ • DATA SOURCES & REPOSITORY (/data-sources)                                 │
│   - Technical inspection of imported layers, CRS metadata, schemas          │
│   - Ingestion of staged drone fixtures and real-world reference datasets    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Recommendation for `/overview` and Sidebar
1. **Deduplicate the Sidebar:**
   - Remove redundant routes: Merge the concepts of "Harmonization" and "WebGIS workspace" into the single canonical **Workspace** (`/map`).
   - Remove the dead unrouted item `Data quality`.
   - Rename `WebGIS workspace` to simply **Workspace**.
2. **Repurpose or Consolidate `/overview`:**
   - If `/overview` is retained, eliminate the marketing hero, eliminate the headless "Run harmonization" button, and eliminate the mini-map teaser. Transform it into a dedicated **Executive System Health & Administrative Summary**:
     - System readiness (PostGIS connection, engine version, ML model status).
     - Dataset inventory status (number of parcels, repair rates, CRS conformity).
     - Recent run activity ledger.
   - If a dedicated summary is not needed, set the default application landing route to **Workspace** (`/map`), which is the actual working tool.

---

## 13. Files That Would Need Modification In Future Implementation Phases

*(Note: Listed for planning purposes only. NOT modified during this audit.)*

1. `frontend/src/App.tsx` — Streamline sidebar navigation array `nav`, remove dead `Data quality` item, clean up routing.
2. `frontend/src/pages/Dashboard.tsx` — Strip marketing hero, remove headless run button and mini-map teaser, refactor into an institutional administrative dashboard (or consolidate into `/data-sources`).
3. `frontend/src/components/Workflow.tsx` — Update terminology to reflect ML ranking, or retire if superseded by the 9-stage pipeline.
4. `frontend/src/styles.css` — Clean up legacy classes associated with `.hero-diagram`, `.preview-map`, and `.disabled-nav`.

---

## 14. Files That Should Remain Untouched

- `backend/*` (All matching, reconciliation, persistence, ML, and API routes)
- `frontend/src/components/MapView.tsx`
- `frontend/src/components/EvidencePanel.tsx`
- `frontend/src/components/ReviewQueue.tsx`
- `frontend/src/pages/AuditTrail.tsx`
- `frontend/src/components/RunControl.tsx`
- `frontend/src/pages/Workspace.tsx`
- `frontend/src/pages/Landing.tsx`
- `frontend/src/components/pipeline/*`
- `frontend/src/services/api.ts`
- `frontend/src/types/index.ts`

---

## 15. Open Questions & Ambiguities

1. **Role of `/overview` vs `/map` as Application Entry Point:**
   - When an authenticated user clicks "Open Workspace" from the Landing Page, should they land directly in the functional GIS Workspace (`/map`), bypassing `/overview` entirely?
2. **Consolidation of `/data-sources` and `/harmonization`:**
   - Since source toggling and harmonization runs occur inside `RunControl.tsx` within the Workspace, should the standalone `/harmonization` route be formally retired, and `/data-sources` strictly focused on technical schema/CRS inspection?
3. **Dead Sidebar Item `Data quality`:**
   - Should `Data quality` (`<small>05</small>`) be removed from the sidebar navigation completely, or is there a planned Phase 9 requirement for an automated topological data quality audit screen?

---

## 16. Audit Conclusion

The `/overview` page and its associated sidebar links currently represent a transitional state from Phase 3/4. It presents significant informational duplication with both the cinematic Landing Page (marketing hero, process diagram) and the institutional Workspace (data counts, harmonization execution, map preview). 

By streamlining the application shell around the three core pillars—**Workspace (`/map`)**, **Review Queue (`/review`)**, and **Audit Trail (`/audit`)**—the product will achieve institutional clarity with zero cognitive friction.
