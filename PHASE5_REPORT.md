# Phase 5.1 — supervised candidate-match ranking

## Objective and delivered architecture

A real fitted `HistGradientBoostingClassifier` now scores each candidate pair
produced by the existing PostGIS/STRtree intersection filter. A separately fitted
`LogisticRegression` provides the baseline. Neither model uses deterministic
decisions as training labels. The deterministic 65% geometry / 35% attributes,
GNSS boost, 75/40 thresholds, validation flags, selected footprint, human review
and audit behavior are preserved.

Source preparation → metric candidate generation → shared ML features → fitted
classifier probability → separate ranked candidate list → existing deterministic
proposal and human review governance.

## Dataset, labels and split

The existing generator supplies 500 parcels, 475 corresponding footprints and
350 GNSS observations. Ground truth is the generator's P{i} ↔ B{i} relationship
when B{i} exists. Correct pairs have label 1; incorrect buildings have label 0.
Missing-building parcels have only negative examples. This is a **synthetic
training benchmark — not a production accuracy estimate**.

Candidates include the known positive, four nearest incorrect footprints, two
survey-similar incorrect footprints, and all overlapping incorrect footprints
when available, deduplicated per parcel. The resulting 3,402 pairs include 475
positives and 2,927 negatives. Nearby and attribute-similar selection contribute
2,000 and 1,000 pair memberships respectively (some overlap).

Geographic partitioning occurs before pair sampling. Both parcel and building
IDs are disjoint across partitions; all pairs for a parcel stay together.

| Partition | Geography | Parcels | Pairs | Positive | Negative |
|---|---|---:|---:|---:|---:|
| Train | Wards 1–3 | 300 | 2,049 | 285 | 1,764 |
| Validation | Ward 4 | 100 | 677 | 95 | 582 |
| Held-out test | Ward 5 | 100 | 676 | 95 | 581 |

These are adjacent geographic strips, not independent real-world surveys; they
share the same synthetic generating process and repeating scenarios. The split
prevents pair/parcel/building reuse, but does not prove domain generalization.

## Features and model protocol

The 16 features cover IoU, centroid/boundary distance, geometric areas and area
difference, survey/owner/combined attribute similarity, normalized survey equality,
GNSS containment/related survey, original validity and repair indicators.
[Exact definitions](backend/ml/README.md) specify units and missing semantics.
Every geometric measurement is in EPSG:32643. IDs, scenarios, confidence scores,
labels and split metadata are excluded from the feature vector.

Unavailable evidence is JSON null / estimator NaN. The baseline uses median
imputation plus missing indicators and standardization, fitted only on training
data. HGB handles missing values natively. GNSS containment without an observation
is unavailable, not a negative survey result. The existing attribute helper is
reused after placeholder values are marked missing for ML feature extraction.

Both models use seed 26013. The predeclared HGB configuration is 100 iterations,
15 maximum leaves, L2 regularization 1, and no early stopping. The baseline uses
logistic regression with 1,000 maximum iterations. No model tuning was performed;
validation is reported separately. The classification threshold is fixed at 0.5.
Test evaluation was run only after fitting and freezing both models. Neither
validation nor test data was used for fitting or preprocessing statistics.

## Actual measured evaluation

Generated, trained and evaluated locally using scikit-learn 1.9.1.

| Model | Test precision | Test recall | Test F1 | Test ROC-AUC |
|---|---:|---:|---:|---:|
| Logistic regression | 1.0 | 1.0 | 1.0 | 1.0 |
| HistGradientBoosting | 1.0 | 1.0 | 1.0 | 1.0 |

Both test confusion matrices are `[[581, 0], [0, 95]]`, with rows = true
negative/positive and columns = predicted negative/positive. Test support is
581 negatives and 95 positives. Validation baseline precision was
0.9895833333, recall 1.0, F1 0.9947643979 and ROC-AUC 1.0; HGB validation metrics
were all 1.0. Machine-readable outputs are saved in
[metrics.json](backend/ml/artifacts/metrics.json) and
[model_metadata.json](backend/ml/artifacts/model_metadata.json).

These perfect test values were measured, not hardcoded. Both models tie, so this
benchmark establishes no HGB advantage. Large geometric separation makes the
synthetic task easy. There are **zero overlapping incorrect pairs** in the
existing generator; none were invented to claim coverage. The benchmark does
not establish performance for ambiguous overlapping real records.

25 known positive pairs have zero overlap. They are included in training labels
but excluded by the application's unchanged intersection candidate filter. Its
synthetic correspondence candidate recall is therefore 450/475 (94.74%) before
ML. The ranker cannot recover excluded candidates. Most application candidate
lists contain one item; this benchmark is mainly binary pair discrimination,
not evidence of improved ranking among difficult overlapping alternatives.

## Artifacts, inference and API

`backend/ml/artifacts` contains `match_ranker.joblib`, `baseline.joblib`,
`feature_names.json`, `metrics.json` and `model_metadata.json`. The reproducible
`dataset.json` is generated locally and ignored by Git. Metadata records the
training timestamp, seed, sklearn version, dataset version/hash, split counts,
feature names, validation metrics and test metrics.

Version: `synthetic-hgb-v1-6d8638ed6839`.

`ml.predict.Ranker` loads the trusted local artifact and checks feature order,
feature count, class labels and sklearn runtime version. Training and inference
share `ml.features.extract`. Each new persisted result exposes:

- `deterministic_confidence`, alongside the unchanged `confidence`;
- `model_available`, `model_version`;
- `ml_ranked_candidate_id`, `ml_match_probability`, `ml_rank`;
- `ml_candidates`, containing every candidate's probability, rank and features.

The top-level probability belongs to the explicitly named ML-ranked candidate,
not necessarily the deterministic `matched_footprint_id`. Ties use candidate ID
only as a stable output-order rule, not as a model input. No candidate means null
probability/rank even if the model is available. Saved historical results are
not silently rescored. The existing run/results/review persistence stores these
additional JSON fields without a database schema change.

Missing/corrupt/incompatible artifacts, disabled ML, or inference errors leave
deterministic results valid and expose `model_available=false`. Disable with
`ML_ENABLED=false`. Joblib files must be trusted; no model upload API was added.
Input evidence is exposed, but causal explanations or feature importance are
not claimed. Probabilities are uncalibrated synthetic-classifier estimates.

## Frontend and verification

The existing WebGIS evidence panel gains one Match ranking section, with both
scores, candidate identity/rank, model version, expandable inputs and synthetic
context. No application redesign was performed.

- Backend tests: **15 passed, 1 skipped**. Coverage includes features, labels,
  meaningful negatives, partition disjointness, reproducible data, both models,
  serialization, inference, bad feature contracts, missing/corrupt artifacts,
  API integration and deterministic parity with ML disabled. Existing Phase 3/4
  tests remain intact and pass. Two pre-existing test-client deprecation warnings.
- Frontend TypeScript check and production build: **passed**.
- Browser test: **passed**, including ML evidence, real harmonization, saved
  review decision, audit display, reload and responsive layouts. Screenshot
  inspection confirms the addition fits the existing evidence panel.
- Live PostGIS remains **unverified** because no dedicated MVP database is
  configured. Training and inference were verified with the SQLite demo adapter.
- No credentials were created and `D:\Bhumi-Setu` was not accessed or modified.

## Limitations and next data step

The demo's parcel-scale comparison polygons are not ordinary building-versus-
legal-parcel ground truth. Synthetic owners/surveys, repeating scenarios and easy
negative sampling limit transferability. Class proportions are sampled and
probabilities require calibration on representative real data. The classifier
cannot prove ownership, replace government verification, override data quality
flags or approve records. No new auto-accept policy was added.

Future work should capture reviewed **candidate-pair** labels with source/run/
model provenance, adjudicate ambiguous labels, and evaluate on independently
held-out geographic surveys. A rejection of the chosen candidate does not label
every other candidate as wrong; investigation is not a binary ground-truth label.
Assess candidate recall, overlapping hard negatives, calibration, top-k ranking
and subgroup error rates before production use. Computer vision, drone/ORI
extraction, segmentation, change detection, deep learning, OCR and chatbots were
not built. Phase 5.1 stops here.
