"""Vector-only contract. No imagery processing or reconciliation policy lives here."""
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

SOURCE_TYPE = 'ai_derived_drone_footprint'
PROVENANCE_FIELDS = ('model_name', 'model_version', 'model_artifact_sha256',
                     'inference_run_id', 'derived_from')


class DerivedFootprint(BaseModel):
    # A deliberately narrow boundary: ownership and reconciliation scores are
    # not outputs of an imagery extraction system.
    model_config = ConfigDict(extra='forbid', strict=True, str_strip_whitespace=True)

    footprint_id: str = Field(min_length=1, max_length=120)
    source_type: Literal['ai_derived_drone_footprint']
    source: Literal['drone_orthophoto']
    area_sqm: float | None = Field(default=None, gt=0, allow_inf_nan=False)
    model_name: str | None = Field(default=None, min_length=1, max_length=200)
    model_version: str | None = Field(default=None, min_length=1, max_length=200)
    model_artifact_sha256: str | None = Field(default=None, pattern=r'^[a-fA-F0-9]{64}$')
    inference_run_id: str | None = Field(default=None, min_length=1, max_length=200)
    derived_from: str | None = Field(default=None, min_length=1, max_length=200)
    segmentation_probability: float | None = Field(default=None, ge=0, le=1, allow_inf_nan=False)
    confidence_method: str = Field(default='not_available', min_length=1, max_length=200)
    demonstration: bool = False

    @model_validator(mode='after')
    def confidence_is_explicit(self):
        if (self.segmentation_probability is None) != (self.confidence_method == 'not_available'):
            raise ValueError('A supplied segmentation probability needs a confidence_method; '
                             'otherwise use null and not_available')
        return self


def validate_collection(kind, collection, source_type=None):
    """Infer the subtype from features, but reject mixed or mislabelled sources."""
    features = collection['features']
    marked = [isinstance(f, dict) and isinstance(f.get('properties'), dict)
              and f['properties'].get('source_type') == SOURCE_TYPE for f in features]
    if source_type is None and not any(marked):
        return collection, None
    if source_type not in (None, SOURCE_TYPE) or kind != 'buildings' or not all(marked):
        raise ValueError('A derived source must contain only AI-derived building footprints')
    validated = []
    for feature in features:
        props = DerivedFootprint.model_validate(feature['properties']).model_dump()
        validated.append({**feature, 'properties': props})
    return {**collection, 'features': validated}, SOURCE_TYPE
