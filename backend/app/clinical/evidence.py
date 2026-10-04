"""Clinical evidence verification and audit invariants."""

from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class ClinicalEvidence(BaseModel):
    """Verbatim text evidence supporting a clinical fact assertion."""

    model_config = ConfigDict(frozen=True)

    verbatim_text: str = Field(..., min_length=1, description="Verbatim patient or clinician utterance")
    negation_trigger: Optional[str] = Field(None, description="Trigger phrase causing negation (e.g. 'nahi hai')")
    temporal_trigger: Optional[str] = Field(None, description="Duration/onset phrase (e.g. '3 din se')")
