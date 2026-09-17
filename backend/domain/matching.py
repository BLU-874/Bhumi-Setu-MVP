"""Adapted from the read-only Bhumi-Setu prototype. Deterministic evidence scoring.
Inputs must share one planar CRS. The service uses EPSG:32643 for Pune.
Weights, rounding, thresholds and GNSS containment boost are preserved.
"""
import re

from shapely.geometry import shape, mapping
from shapely.validation import make_valid
from rapidfuzz import fuzz

# --- Canonical attribute schema we want to harmonize everything into ---
# Maps a canonical field -> list of possible field names seen across sources
FIELD_ALIASES = {
    "survey_no": ["survey_no", "SurveyNumber", "surveyNo", "survey_number"],
    "owner": ["owner", "ownerName", "owner_name"],
    "area": ["area_sqm", "areaSqM", "area", "area_sq_m"],
}

# Weights for the final confidence score
GEOMETRY_WEIGHT = 0.65
ATTRIBUTE_WEIGHT = 0.35

# Thresholds used to bucket results for the frontend / dashboard
CONFIDENCE_MATCH = 75      # >= this -> "matched" (green)
CONFIDENCE_REVIEW = 40     # >= this -> "needs review" (yellow); below -> "conflict" (red)

# Validation thresholds are intentionally separate from matching thresholds.
# They surface evidence for review without changing the established Day 1/2
# confidence calculation or its status buckets.
AREA_DIFFERENCE_TOLERANCE_PCT = 15.0
LOW_OVERLAP_THRESHOLD_PCT = 50.0
SURVEY_NUMBER_PATTERN = re.compile(r"^SR-\d{3,}$", re.IGNORECASE)
REQUIRED_CADASTRAL_FIELDS = ("parcel_id", "survey_no", "owner", "area_sqm")


def fix_topology(geom):
    """Automated topology correction: repair minor self-intersections /
    invalid rings so downstream spatial ops don't silently fail."""
    if not geom.is_valid:
        geom = make_valid(geom)
    # buffer(0) is a common cheap trick to clean up slivers/duplicate points
    return geom.buffer(0) if geom.is_valid else geom


def normalize_attributes(properties: dict) -> dict:
    """Map arbitrary source field names onto our canonical schema."""
    normalized = {}
    lower_props = {k.lower(): (k, v) for k, v in properties.items()}
    for canonical, aliases in FIELD_ALIASES.items():
        for alias in aliases:
            if alias.lower() in lower_props:
                normalized[canonical] = lower_props[alias.lower()][1]
                break
        else:
            normalized[canonical] = None
    return normalized


def _is_present(value) -> bool:
    """Treat empty strings and common placeholder values as missing."""
    return value is not None and str(value).strip().lower() not in {"", "n/a", "unknown", "null"}


def _survey_key(value) -> str | None:
    """Return a comparison key for survey-number duplicate checks."""
    if not _is_present(value):
        return None
    return "".join(ch for ch in str(value) if ch.isalnum()).lower()


def _as_positive_float(value) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number > 0 else None


def _area_consistency(cadastral_area, footprint_area) -> tuple[bool, float | None]:
    """Compare declared areas independently of the geometric overlap score."""
    cadastral = _as_positive_float(cadastral_area)
    footprint = _as_positive_float(footprint_area)
    if cadastral is None or footprint is None:
        return False, None
    difference_pct = abs(cadastral - footprint) / max(cadastral, footprint) * 100
    return difference_pct <= AREA_DIFFERENCE_TOLERANCE_PCT, round(difference_pct, 1)


def _recommendation(status: str, flags: list[str]) -> str:
    if status == "matched" and not flags:
        return "High-confidence proposal"
    if status == "conflict":
        return "Conflict investigation required"
    return "Human review recommended"


def attribute_similarity(attrs_a: dict, attrs_b: dict) -> float:
    """Fuzzy-match normalized attribute values between the two sources.
    Returns a 0-1 similarity score."""
    scores = []

    # Survey number: exact-ish match after stripping non-alphanumerics
    sa, sb = attrs_a.get("survey_no"), attrs_b.get("survey_no")
    if sa and sb:
        clean = lambda s: "".join(ch for ch in str(s) if ch.isalnum()).lower()
        scores.append(fuzz.ratio(clean(sa), clean(sb)) / 100)

    # Owner name: fuzzy string match (handles typos / formatting differences)
    oa, ob = attrs_a.get("owner"), attrs_b.get("owner")
    if oa and ob:
        if str(ob).strip().lower() in ("unknown", "n/a", ""):
            scores.append(0.0)
        else:
            scores.append(fuzz.ratio(str(oa).lower(), str(ob).lower()) / 100)

    # Area: closeness as a ratio (allows ~15% drone-measurement error)
    aa, ab = attrs_a.get("area"), attrs_b.get("area")
    if aa and ab:
        try:
            aa, ab = float(aa), float(ab)
            diff_ratio = 1 - min(abs(aa - ab) / max(aa, ab), 1.0)
            scores.append(diff_ratio)
        except (TypeError, ValueError):
            pass

    if not scores:
        return 0.0
    return sum(scores) / len(scores)


def harmonize(
    cadastral_fc: dict,
    buildings_fc: dict | None = None,
    gnss_fc: dict | None = None,
    building_candidates: dict | None = None,
) -> dict:
    """Main entry point: returns a GeoJSON FeatureCollection of harmonized
    parcel records with confidence scores and match status, plus a
    top-level summary block.

    All inputs must share the same CRS. The service uses Pune UTM 43N.
    GNSS containment supplies the prototype's eight-point boost. The demo
    observations are synthetic; containment alone does not prove accuracy.
    """

    # Pre-parse complete layers; otherwise use the bulk candidate mapping.
    building_records = []

    if buildings_fc is not None:
        for feat in buildings_fc["features"]:
            source_geom = shape(feat["geometry"])
            geom = fix_topology(source_geom)
            building_records.append({
                "geom": geom,
                "source_geometry_valid": source_geom.is_valid,
                "properties": feat["properties"],
                "raw": feat,
            })

    # Pre-parse GNSS ground-truth points, if supplied
    gnss_points = []
    if gnss_fc:
        for feat in gnss_fc["features"]:
            gnss_points.append({
                "geom": shape(feat["geometry"]),
                "properties": feat["properties"],
            })

    results = []
    matched_count = 0
    review_count = 0
    conflict_count = 0

    # Duplicates are a cadastral-record quality issue, so calculate them
    # across the whole layer before processing individual matches.
    survey_counts = {}
    for feat in cadastral_fc["features"]:
        survey_key = _survey_key(normalize_attributes(feat.get("properties", {})).get("survey_no"))
        if survey_key:
            survey_counts[survey_key] = survey_counts.get(survey_key, 0) + 1

    for feat in cadastral_fc["features"]:
        source_c_geom = shape(feat["geometry"])
        c_geom = fix_topology(source_c_geom)
        c_props = feat["properties"]
        c_attrs = normalize_attributes(c_props)

        best = None
        best_iou = 0.0

        # --- Spatial matching: find best-overlapping footprint (IoU) ---
        # If a PostGIS candidate provider is available, only retrieve
        # buildings that spatially intersect this parcel.
        if building_candidates is not None:
            parcel_id = c_props.get("parcel_id")

            candidate_features = building_candidates.get(
                parcel_id,
                []
            )

            candidate_records = []

            for candidate_feat in candidate_features:
                source_geom = shape(
                    candidate_feat["geometry"]
                )

                geom = fix_topology(
                    source_geom
                )

                candidate_records.append({
                    "geom": geom,
                    "source_geometry_valid": source_geom.is_valid,
                    "properties": candidate_feat["properties"],
                    "raw": candidate_feat,
                })

        else:
            candidate_records = building_records

        for b in candidate_records:
            if not c_geom.intersects(b["geom"]):
                continue

            inter = c_geom.intersection(b["geom"]).area
            union = c_geom.union(b["geom"]).area
            iou = inter / union if union > 0 else 0.0

            if iou > best_iou:
                best_iou = iou
                best = b

        if best is not None:
            b_attrs = normalize_attributes(best["properties"])
            attr_score = attribute_similarity(c_attrs, b_attrs)
            confidence = round(
                (best_iou * GEOMETRY_WEIGHT + attr_score * ATTRIBUTE_WEIGHT) * 100, 1
            )
            matched_feature_id = best["properties"].get("footprint_id")
            matched_props = best["properties"]
        else:
            attr_score = 0.0
            confidence = 0.0
            matched_feature_id = None
            matched_props = None

        # Preserve the containment-only boost. Missing observations are neutral.
        # Related survey mismatch is flagged separately, without altering scoring.
        gnss_verified = False
        gnss_point_id = None
        gnss_match_method = "no GNSS point available for this parcel"
        gnss_related_survey_matches = None
        for pt in gnss_points:
            if c_geom.contains(pt["geom"]):
                gnss_verified = True
                gnss_point_id = pt["properties"].get("point_id")
                gnss_match_method = "GNSS point contained by cadastral parcel"
                gnss_related_survey_matches = (
                    _survey_key(pt["properties"].get("related_survey_no"))
                    == _survey_key(c_attrs.get("survey_no"))
                )
                break

        base_confidence = confidence
        if gnss_verified:
            confidence = round(min(confidence + 8, 100), 1)

        if confidence >= CONFIDENCE_MATCH:
            status = "matched"
            matched_count += 1
        elif confidence >= CONFIDENCE_REVIEW:
            status = "needs_review"
            review_count += 1
        else:
            status = "conflict"
            conflict_count += 1

        # --- Day 3 validation and explainability ---
        required_missing = [field for field in REQUIRED_CADASTRAL_FIELDS if not _is_present(c_props.get(field))]
        survey_number = c_attrs.get("survey_no")
        survey_number_valid = bool(
            _is_present(survey_number) and SURVEY_NUMBER_PATTERN.fullmatch(str(survey_number).strip())
        )
        duplicate_survey_number = bool(survey_counts.get(_survey_key(survey_number), 0) > 1)
        footprint_area = normalize_attributes(matched_props).get("area") if matched_props else None
        area_consistent, area_difference_pct = _area_consistency(c_attrs.get("area"), footprint_area)
        overlap_pct = round(best_iou * 100, 1)
        geometry_valid = source_c_geom.is_valid and (best is None or best["source_geometry_valid"])
        geometry_repaired = not source_c_geom.is_valid or (best is not None and not best["source_geometry_valid"])

        validation_flags = []
        if not survey_number_valid:
            validation_flags.append("Invalid survey number format")
        if required_missing:
            validation_flags.append("Missing required attributes: " + ", ".join(required_missing))
        if duplicate_survey_number:
            validation_flags.append("Duplicate survey number")
        if not geometry_valid:
            validation_flags.append("Invalid source geometry repaired before matching")
        if best is None:
            validation_flags.append("No overlapping footprint match found")
        else:
            if not area_consistent:
                if area_difference_pct is None:
                    validation_flags.append("Area comparison unavailable")
                else:
                    validation_flags.append("Area difference exceeds tolerance")
            if overlap_pct < LOW_OVERLAP_THRESHOLD_PCT:
                validation_flags.append("Low geometry overlap")
        if gnss_verified and gnss_related_survey_matches is False:
            validation_flags.append("GNSS point survey number does not match parcel")

        validation = {
            "survey_number_valid": survey_number_valid,
            "required_fields_complete": not required_missing,
            "missing_required_fields": required_missing,
            "area_consistent": area_consistent,
            "area_difference_pct": area_difference_pct,
            "area_tolerance_pct": AREA_DIFFERENCE_TOLERANCE_PCT,
            "duplicate_survey_number": duplicate_survey_number,
            "geometry_valid": geometry_valid,
            "geometry_repaired": geometry_repaired,
            "geometry_overlap_quality": "good" if overlap_pct >= LOW_OVERLAP_THRESHOLD_PCT else "low",
            "geometry_overlap_pct": overlap_pct,
            "gnss_verified": gnss_verified,
            "gnss_match_method": gnss_match_method,
            "gnss_related_survey_matches": gnss_related_survey_matches,
            "attribute_match_pct": round(attr_score * 100, 1),
        }
        confidence_explanation = {
            "formula": "geometry overlap × 65% + attribute similarity × 35% + GNSS containment boost (up to 8 points)",
            "geometry_weight_pct": GEOMETRY_WEIGHT * 100,
            "geometry_contribution": round(best_iou * GEOMETRY_WEIGHT * 100, 1),
            "attribute_weight_pct": ATTRIBUTE_WEIGHT * 100,
            "attribute_contribution": round(attr_score * ATTRIBUTE_WEIGHT * 100, 1),
            "base_confidence": base_confidence,
            "gnss_boost": round(confidence - base_confidence, 1),
            "final_confidence": confidence,
        }

        results.append({
            "type": "Feature",
            "geometry": mapping(c_geom),
            "properties": {
                "parcel_id": c_props.get("parcel_id"),
                "cadastral": c_props,
                "matched_footprint_id": matched_feature_id,
                "footprint_properties": matched_props,
                "geometry_overlap_pct": overlap_pct,
                "attribute_match_pct": round(attr_score * 100, 1),
                "gnss_verified": gnss_verified,
                "gnss_point_id": gnss_point_id,
                "confidence": confidence,
                "status": status,
                "validation": validation,
                "validation_flags": validation_flags,
                "recommendation": _recommendation(status, validation_flags),
                "confidence_explanation": confidence_explanation,
            },
        })

    total = len(results)
    summary = {
        "total_parcels": total,
        "matched": matched_count,
        "needs_review": review_count,
        "conflict": conflict_count,
        "avg_confidence": round(sum(r["properties"]["confidence"] for r in results) / total, 1)
        if total else 0,
    }

    return {
        "type": "FeatureCollection",
        "features": results,
        "summary": summary,
    }
