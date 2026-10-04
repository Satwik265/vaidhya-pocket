"""Clinical fact collection helpers and invariant checks."""

from typing import List
from .models import ClinicalFact, FactAssertion, FactCategory


def get_affirmed_facts(facts: List[ClinicalFact]) -> List[ClinicalFact]:
    """Returns only affirmed/present clinical facts."""
    return [f for f in facts if f.assertion == FactAssertion.PRESENT]


def get_negated_facts(facts: List[ClinicalFact]) -> List[ClinicalFact]:
    """Returns explicitly negated clinical facts."""
    return [f for f in facts if f.assertion == FactAssertion.NEGATED]


def get_facts_by_category(facts: List[ClinicalFact], category: FactCategory) -> List[ClinicalFact]:
    """Filters facts belonging to a specific clinical domain."""
    return [f for f in facts if f.category == category]
