"""Deterministic safety triage engine for sovereign local AI runtime.

Invariants:
1. Evaluates canonical ClinicalFact concept combinations (never raw keyword heuristics).
2. Only affirmed findings (assertion == FactAssertion.PRESENT) trigger red flags.
   Explicitly negated findings (e.g. 'Chest pain nahi hai') NEVER trigger red flags.
3. Triage-only action: Alerts recommend urgent clinical triage and escalation to an on-duty medical officer.
4. ZERO treatment directives: Engine strictly forbids recommending medications, prescriptions, or invasive orders.
"""

from typing import List
from pydantic import BaseModel
from ..clinical.models import ClinicalFact, FactAssertion


class RedFlagAlert(BaseModel):
    rule_id: str
    title: str
    severity: str  # "CRITICAL", "HIGH", "MODERATE"
    clinical_summary: str
    matched_concepts: List[str]
    recommended_immediate_action: str
    is_triage_only: bool = True


def evaluate_red_flags(facts: List[ClinicalFact]) -> List[RedFlagAlert]:
    """Evaluates deterministic red flags strictly from affirmed ClinicalFacts."""
    affirmed_facts = [f for f in facts if f.assertion == FactAssertion.PRESENT]
    affirmed_ids = {f.concept_id for f in affirmed_facts}

    alerts: List[RedFlagAlert] = []

    # 1. Acute Coronary Syndrome: Chest Pain + Dyspnea / Breathlessness
    if "SYM_CHEST_PAIN" in affirmed_ids and "SYM_BREATHLESSNESS" in affirmed_ids:
        alerts.append(
            RedFlagAlert(
                rule_id="RED_FLAG_ACS_DYSPNEA",
                title="Possible Acute Coronary Syndrome (Chest Pain + Dyspnea)",
                severity="CRITICAL",
                clinical_summary="Patient reports chest pain associated with breathlessness/shortness of breath. High suspicion for myocardial ischemia or infarction.",
                matched_concepts=["SYM_CHEST_PAIN", "SYM_BREATHLESSNESS"],
                recommended_immediate_action="Priority triage required: Potential acute coronary emergency detected. Alert on-duty medical officer immediately.",
                is_triage_only=True,
            )
        )
    elif "SYM_CHEST_PAIN" in affirmed_ids:
        # Chest pain alone
        alerts.append(
            RedFlagAlert(
                rule_id="RED_FLAG_CHEST_PAIN_ACUTE",
                title="Acute Chest Discomfort / Pain",
                severity="HIGH",
                clinical_summary="Patient reports acute chest discomfort/pain. Urgent cardiovascular evaluation indicated.",
                matched_concepts=["SYM_CHEST_PAIN"],
                recommended_immediate_action="Priority triage required: Acute chest pain reported. Alert on-duty medical officer immediately.",
                is_triage_only=True,
            )
        )
    elif "SYM_BREATHLESSNESS" in affirmed_ids:
        # Severe dyspnea alone
        alerts.append(
            RedFlagAlert(
                rule_id="RED_FLAG_SEVERE_DYSPNEA",
                title="Severe Breathlessness / Respiratory Distress",
                severity="HIGH",
                clinical_summary="Acute dyspnea reported without relief. Urgent respiratory evaluation indicated.",
                matched_concepts=["SYM_BREATHLESSNESS"],
                recommended_immediate_action="Priority triage required: Potential respiratory emergency detected. Alert on-duty medical officer immediately.",
                is_triage_only=True,
            )
        )

    return alerts
