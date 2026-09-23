# PHASE 5.1 ML INTEGRATION DIAGNOSTIC REPORT

**Date:** September 23, 2026  
**Status:** Read-Only Diagnostic Complete (Zero Files Modified)  
**System:** Bhumi-Setu MVP (Phase 5.1 Supervised ML Candidate Ranking)

---

## Executive Summary

The Phase 5.1 Supervised ML Candidate Ranking integration is **fully functional and working end-to-end**.

- The trained model artifact (`match_ranker.joblib`) is actively loaded by `Ranker` in `backend/ml/predict.py`.
- During reconciliation, `reconciliation.py` invokes `ranker.rank(...)` for every parcel.
- When intersecting building footprint candidates exist, 16 spatial, attribute, and GNSS features are extracted, `predict_proba` is computed, candidate footprints are ranked, and full ML metadata (`ml_ranked_candidate_id`, `ml_rank`, `ml_match_probability`, `ml_candidates`) is saved to the database.
- The FastAPI backend serializes these fields without loss, and the frontend (`ReviewEvidenceStory.tsx` and `EvidencePanel.tsx`) reads the exact matching snake_case properties.
- **Why P0015 shows "Not supplied" / "Not available":**  
  `P0015` has **zero overlapping building footprints** on the ground (it is a conflict parcel with no candidate). In the absence of candidate footprints, the ML model correctly returns `None`, and the UI intentionally renders `"Not supplied"` and `"Not available"`.

---

## 1. Case-by-Case Investigation

### Case: P0015
| Question | Diagnostic Finding |
| :--- | :--- |
| **Candidate exists?** | **NO.** In both the synthetic benchmark and staged runs, parcel `P0015` has 0 intersecting building footprints. |
| **ML invoked?** | **YES.** `ranker.rank()` was called with `candidates = []`. |
| **ML result?** | `{'model_available': True, 'model_version': 'synthetic-hgb-v1-6d8638ed6839', 'ml_ranked_candidate_id': None, 'ml_rank': None, 'ml_match_probability': None, 'ml_candidates': []}` |
| **Why UI says "Not supplied"?** | In `ReviewEvidenceStory.tsx`: `value(p.ml_ranked_candidate_id)` executes where `value(v)` returns `'Not supplied'` when `v == null`. Similarly, `p.ml_match_probability != null ? ... : 'Not available'` returns `'Not available'`. |

### Case: P0012
| Question | Diagnostic Finding |
| :--- | :--- |
| **Candidate exists?** | **YES** in the Benchmark Dataset (`B0012`). (NO in the 6-footprint staged drone fixture). |
| **ML invoked?** | **YES.** 16 normalized spatial/attribute features were extracted for `(P0012, B0012)`. |
| **ML result?** | `ml_ranked_candidate_id: 'B0012'`, `ml_rank: 1`, `ml_match_probability: 0.9991636015481985` (~99.9%). |
| **UI Rendering:** | When the benchmark run is viewed: displays **Model: synthetic-hgb-v1-6d8638ed6839**, **ML-ranked candidate: B0012**, **ML rank: 1**, **Model probability: 99.9%**. |

### Case: P0013
| Question | Diagnostic Finding |
| :--- | :--- |
| **Candidate exists?** | **YES** in the Benchmark Dataset (`B0013`). (NO in the 6-footprint staged drone fixture). |
| **ML invoked?** | **YES.** 16 normalized spatial/attribute features were extracted for `(P0013, B0013)`. |
| **ML result?** | `ml_ranked_candidate_id: 'B0013'`, `ml_rank: 1`, `ml_match_probability: 0.9991636015481985` (~99.9%). |
| **UI Rendering:** | When the benchmark run is viewed: displays **Model: synthetic-hgb-v1-6d8638ed6839**, **ML-ranked candidate: B0013**, **ML rank: 1**, **Model probability: 99.9%**. |

### Verification Case: P0003 (Live in Current Staged Run)
To verify live rendering in the currently active staged drone run (`f983886d`):
```text
ML EVIDENCE
Model: synthetic-hgb-v1-6d8638ed6839
ML-ranked candidate: staged-drone-0003
ML rank: 1
Model probability: 72.8%
```
Rendered live and verified via headless Chromium without errors.

---

## 2. End-to-End ML Pipeline Trace

```text
1. CANDIDATE GENERATION (backend/services/reconciliation.py: line 63–67)
   Spatial index (Shapely STRtree) queries intersecting building footprints for each cadastral parcel.
   • For 450 parcels: Returns 1 candidate footprint.
   • For 50 parcels (including P0014, P0015): Returns 0 candidate footprints.
        │
        ▼
2. DETERMINISTIC ENGINE (backend/domain/matching.py: harmonize())
   Computes 65% geometric IoU + 35% attribute fuzzy match + up to 8 points GNSS containment boost.
        │
        ▼
3. ML RANKING SERVICE (backend/ml/predict.py: Ranker.rank())
   • Checks if candidates exist:
     - If empty: returns model_version with None for candidate, rank, and probability.
     - If candidates exist:
       a. Calls extract(parcel, building, gnss) in backend/ml/features.py (16 features).
       b. Calls self.model.predict_proba([vector(f)])[:, 1].
       c. Sorts candidates by (-probability, candidate_id).
       d. Assigns ml_rank (1, 2, ...).
       e. Returns top candidate ID, probability, rank, and full ml_candidates list.
        │
        ▼
4. RESULT CONSTRUCTION (backend/services/reconciliation.py: line 85)
   p.update(ranker.rank(...)) attaches all ML keys to the feature's properties dictionary.
        │
        ▼
5. DATABASE PERSISTENCE (backend/persistence/store.py: save_run())
   Serializes the entire Feature GeoJSON (including all properties) into SQLite/PostGIS
   table `harmonized_records(run_id, id, feature TEXT)`. No fields are dropped.
        │
        ▼
6. API SERIALIZATION (backend/api/routes.py: /api/results & /api/review-cases)
   Deserializes `feature TEXT` and returns complete JSON to the frontend.
        │
        ▼
7. UI PRESENTATION (ReviewEvidenceStory.tsx & EvidencePanel.tsx)
   Reads properties directly:
   • p.model_available
   • p.model_version
   • p.ml_ranked_candidate_id
   • p.ml_rank
   • p.ml_match_probability
   • p.ml_candidates
```

---

## 3. Technical Audit of `backend/ml/predict.py`

| Audit Question | Finding | Source Code Evidence |
| :--- | :--- | :--- |
| **A. Is trained model loaded?** | **YES.** `joblib.load()` successfully loads the model artifact into memory. | `predict.py: lines 20–26` |
| **B. What model file is loaded?** | `backend/ml/artifacts/match_ranker.joblib` | `predict.py: line 7` |
| **C. Is prediction invoked during reconciliation?** | **YES.** Invoked in the feature iteration loop. | `reconciliation.py: line 85` |
| **D. What features are passed to the model?** | 16 features from `ml/features.py`: IoU, centroid distance (m), boundary distance (m), parcel area, building area, area diff %, survey number similarity, owner similarity, attribute similarity, exact survey match, GNSS inside parcel, GNSS related survey match, and 4 geometry quality flags. | `ml/features.py: lines 11–38` |
| **E. What does prediction return?** | Dict containing `model_available`, `model_version`, `ml_ranked_candidate_id`, `ml_match_probability`, `ml_rank`, and `ml_candidates`. | `predict.py: lines 48–53` |
| **F. Does it return candidate ID?** | **YES.** Returns string ID of the candidate footprint (e.g. `'B0012'` or `'staged-drone-0003'`). | `predict.py: line 48` |
| **G. Does it return rank?** | **YES.** Integer `1` for the top-ranked candidate; `1..N` in `ml_candidates`. | `predict.py: line 49` |
| **H. Does it return probability?** | **YES.** Float probability in range `[0.0, 1.0]` (e.g. `0.99916...` or `0.7275...`). | `predict.py: line 49` |
| **I. Calibrated or raw `predict_proba`?** | **Raw `predict_proba` output** of `HistGradientBoostingClassifier`. No Platt scaling or isotonic calibration wrapper is applied. | `predict.py: line 43` |
| **J. What happens if there are zero candidates?** | Safely short-circuits (`if not candidates: return result`), returning `model_version` with `None` for candidate, rank, and probability. Zero exceptions raised. | `predict.py: lines 37–38` |

---

## 4. UI Conditional Logic & Contract Consistency

In [frontend/src/components/ReviewEvidenceStory.tsx](file:///d:/Bhumi-Setu-MVP/frontend/src/components/ReviewEvidenceStory.tsx):

```tsx
const value = (v: unknown) => v == null || v === '' ? 'Not supplied' : typeof v === 'object' ? JSON.stringify(v) : String(v);

<section>
  <h3>ML evidence</h3>
  <dl>
    <dt>Model</dt>
    <dd>{p.model_available ? value(p.model_version) : 'Unavailable for this run'}</dd>
    <dt>ML-ranked candidate</dt>
    <dd>{value(p.ml_ranked_candidate_id)}</dd>
    <dt>ML rank</dt>
    <dd>{value(p.ml_rank)}</dd>
    <dt>Model probability</dt>
    <dd>{p.ml_match_probability != null ? `${(p.ml_match_probability * 100).toFixed(1)}%` : 'Not available'}</dd>
  </dl>
</section>
```

In [frontend/src/components/EvidencePanel.tsx](file:///d:/Bhumi-Setu-MVP/frontend/src/components/EvidencePanel.tsx):

```tsx
{p.model_available ? (
  <>
    <p className="muted">Bhumi-Setu Match Ranker · {p.model_version}</p>
    {p.ml_ranked_candidate_id ? (
      <>
        <div className="evidence-row"><span>ML-ranked candidate</span><b>{p.ml_ranked_candidate_id}</b></div>
        <div className="evidence-row"><span>Predicted match probability</span><b>{p.ml_match_probability != null ? `${(p.ml_match_probability * 100).toFixed(1)}%` : 'Not available'}</b></div>
        <div className="evidence-row"><span>Candidate rank</span><b>{p.ml_rank ?? 'Not available'}</b></div>
      </>
    ) : (
      <p>No intersecting candidate to rank.</p>
    )}
  </>
) : (
  <p className="muted">ML unavailable for this run. Deterministic evidence remains valid.</p>
)}
```

### Property Name Contract Check
| Property Name | Backend (`predict.py`) | Frontend Type (`types/index.ts`) | UI Component Usage | Match? |
| :--- | :--- | :--- | :--- | :---: |
| Model Availability | `model_available` | `model_available?: boolean` | `p.model_available` | **EXACT MATCH** |
| Model Version | `model_version` | `model_version?: string \| null` | `p.model_version` | **EXACT MATCH** |
| Ranked Candidate ID | `ml_ranked_candidate_id` | `ml_ranked_candidate_id?: string \| null` | `p.ml_ranked_candidate_id` | **EXACT MATCH** |
| Rank Number | `ml_rank` | `ml_rank?: number \| null` | `p.ml_rank` | **EXACT MATCH** |
| Match Probability | `ml_match_probability` | `ml_match_probability?: number \| null` | `p.ml_match_probability` | **EXACT MATCH** |
| Candidate List | `ml_candidates` | `ml_candidates?: [...]` | `p.ml_candidates` | **EXACT MATCH** |

There is **zero naming discrepancy** (no camelCase vs snake_case mismatches).

---

## 5. Root Cause Determination

### **Root Cause: A. Expected behavior for no-candidate cases**

There is no bug, missing integration, or serialization flaw in the ML subsystem.

1. **State A applies to P0015:**
   In the physical spatial reality of the dataset, parcel `P0015` does not overlap any building footprint. It is flagged with `"No overlapping footprint match found"`. Because no candidate exists, ML ranking has no candidate to evaluate. The model safely returns `None`, and the UI displays `"Not supplied"` and `"Not available"`.

2. **State A applies to P0012 and P0013 in the Benchmark Run:**
   In the canonical 475-building benchmark dataset, `P0012` and `P0013` have candidate footprints (`B0012` and `B0013`), and the ML model successfully ranks them with `ml_rank = 1` and `ml_match_probability = 99.9%`.

3. **Active Run Context in Local Dev Storage:**
   If the local Review Queue is currently showing the staged drone run (which only has 6 buildings in the entire village for `P0001`–`P0006`), parcels `P0007`–`P0500` will have no candidate footprints in that specific run. In that run, clicking `P0003` immediately displays:
   `Model: synthetic-hgb-v1-6d8638ed6839`, `ML-ranked candidate: staged-drone-0003`, `ML rank: 1`, `Model probability: 72.8%`.

The Phase 5.1 ML subsystem is operating exactly as designed.
