from typing import Optional
from pydantic import BaseModel, Field, ConfigDict, model_validator


class FactProvenance(BaseModel):
    """Immutable audit trail anchoring every extracted clinical fact to its source."""

    model_config = ConfigDict(frozen=True)

    source_id: str = Field(..., description="Encounter ID, turn ID, or document reference ID")
    start_char: int = Field(..., ge=0, description="Start character offset in the source text")
    end_char: int = Field(..., ge=0, description="End character offset in the source text")
    matched_text: Optional[str] = Field(None, description="Exact substring matched in source")
    engine: str = Field("medscribe-deterministic-nlp", description="Extraction engine identifier")

    @model_validator(mode="after")
    def validate_offsets(self) -> "FactProvenance":
        if self.end_char < self.start_char:
            raise ValueError(f"Provenance end_char ({self.end_char}) cannot be less than start_char ({self.start_char}).")
        return self
