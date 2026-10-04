"""Sovereign Clinical Language Identification for Python AI Core."""

import re
from typing import Optional, List, Dict, Tuple
from enum import Enum
from pydantic import BaseModel, Field


class SupportedClinicalLanguage(str, Enum):
    EN = "en"
    HI = "hi"
    MR = "mr"
    TA = "ta"
    GU = "gu"


class ScriptCategory(str, Enum):
    DEVANAGARI = "Devanagari"
    TAMIL = "Tamil"
    GUJARATI = "Gujarati"
    LATIN = "Latin"
    MIXED = "Mixed"


class LIDMethod(str, Enum):
    UNICODE_SCRIPT = "unicode_script"
    LEXICAL_HEURISTIC = "lexical_heuristic"
    ENSEMBLE = "ensemble"
    PRIOR = "prior"


class LanguageScore(BaseModel):
    language: SupportedClinicalLanguage
    confidence: float


class LanguageIdentificationResult(BaseModel):
    language: SupportedClinicalLanguage
    locale: str
    confidence: float
    method: LIDMethod
    script: ScriptCategory
    is_code_switched: bool
    alternatives: List[LanguageScore] = Field(default_factory=list)
    is_low_confidence: bool


# Distinctive lexical markers for Romanized inputs
ROMANIZED_MARKERS: Dict[SupportedClinicalLanguage, List[str]] = {
    SupportedClinicalLanguage.HI: [
        "hai", "hain", "mein", "se", "ka", "ki", "ke", "mujhe", "mera", "meri",
        "dard", "bukhar", "khansi", "ho", "raha", "rahi", "nahi", "nahin", "bahut", "lekin"
    ],
    SupportedClinicalLanguage.MR: [
        "ahe", "ahet", "mala", "majha", "majhi", "tras", "khup", "dukhta", "dukhtay",
        "hota", "hoti", "zala", "nahi", "nahit", "pan", "aani", "pasun", "potat"
    ],
    SupportedClinicalLanguage.TA: [
        "irukku", "enakku", "ennoda", "vali", "kaichal", "sali", "romba", "illai",
        "varuthu", "marumozhi", "nenjil", "vayitril"
    ],
    SupportedClinicalLanguage.GU: [
        "che", "mane", "maro", "mari", "maru", "dukhe", "dukhavo", "taav", "khansi",
        "nathi", "pan", "ane", "chhatima", "petma"
    ],
    SupportedClinicalLanguage.EN: [
        "the", "and", "is", "in", "of", "for", "with", "to", "pain", "fever", "cough",
        "severe", "since", "days", "have", "chest", "head", "stomach", "doctor"
    ],
}

DEVANAGARI_HINDI_MARKERS = {
    "है", "हैं", "में", "से", "का", "की", "के", "मुझे", "दर्द", "बुखार", "खांसी", "रहा", "नहीं", "बहुत", "था", "थी"
}

DEVANAGARI_MARATHI_MARKERS = {
    "आहे", "आहेत", "मला", "माझा", "माझी", "त्रास", "खूप", "दुखत", "दुखते", "झाला", "नाही", "आणि", "पण", "पासून"
}

LOCALE_MAP = {
    SupportedClinicalLanguage.EN: "en-IN",
    SupportedClinicalLanguage.HI: "hi-IN",
    SupportedClinicalLanguage.MR: "mr-IN",
    SupportedClinicalLanguage.TA: "ta-IN",
    SupportedClinicalLanguage.GU: "gu-IN",
}


def identify_clinical_language(
    text: str, prior_hint: Optional[SupportedClinicalLanguage] = None
) -> LanguageIdentificationResult:
    """Identifies the clinical language of a patient or clinician utterance."""
    if not text or not text.strip():
        fallback = prior_hint or SupportedClinicalLanguage.HI
        return LanguageIdentificationResult(
            language=fallback,
            locale=LOCALE_MAP[fallback],
            confidence=0.5,
            method=LIDMethod.PRIOR,
            script=ScriptCategory.LATIN,
            is_code_switched=False,
            alternatives=[],
            is_low_confidence=True,
        )

    clean_text = text.strip()
    has_devanagari = bool(re.search(r"[\u0900-\u097F]", clean_text))
    has_tamil = bool(re.search(r"[\u0B80-\u0BFF]", clean_text))
    has_gujarati = bool(re.search(r"[\u0A80-\u0AFF]", clean_text))
    has_latin = bool(re.search(r"[a-zA-Z]", clean_text))

    script_count = sum([has_devanagari, has_tamil, has_gujarati, has_latin])
    script = ScriptCategory.LATIN
    if script_count > 1:
        script = ScriptCategory.MIXED
    elif has_tamil:
        script = ScriptCategory.TAMIL
    elif has_gujarati:
        script = ScriptCategory.GUJARATI
    elif has_devanagari:
        script = ScriptCategory.DEVANAGARI

    # Tokenize
    tokens = [t for t in re.split(r"[\s\.,;:!?\(\)\[\]]+", clean_text.lower()) if t]

    # Tamil script
    if has_tamil and not has_devanagari and not has_gujarati:
        return LanguageIdentificationResult(
            language=SupportedClinicalLanguage.TA,
            locale=LOCALE_MAP[SupportedClinicalLanguage.TA],
            confidence=0.98,
            method=LIDMethod.UNICODE_SCRIPT,
            script=script,
            is_code_switched=has_latin,
            alternatives=[],
            is_low_confidence=False,
        )

    # Gujarati script
    if has_gujarati and not has_devanagari and not has_tamil:
        return LanguageIdentificationResult(
            language=SupportedClinicalLanguage.GU,
            locale=LOCALE_MAP[SupportedClinicalLanguage.GU],
            confidence=0.98,
            method=LIDMethod.UNICODE_SCRIPT,
            script=script,
            is_code_switched=has_latin,
            alternatives=[],
            is_low_confidence=False,
        )

    # Devanagari script: Disambiguate Hindi vs Marathi
    if has_devanagari:
        hi_hits = sum(1 for t in tokens if t in DEVANAGARI_HINDI_MARKERS)
        mr_hits = sum(1 for t in tokens if t in DEVANAGARI_MARATHI_MARKERS)
        selected = SupportedClinicalLanguage.MR if mr_hits > hi_hits else SupportedClinicalLanguage.HI
        other = SupportedClinicalLanguage.HI if selected == SupportedClinicalLanguage.MR else SupportedClinicalLanguage.MR
        confidence = 0.95 if (hi_hits > 0 or mr_hits > 0) else 0.88
        return LanguageIdentificationResult(
            language=selected,
            locale=LOCALE_MAP[selected],
            confidence=confidence,
            method=LIDMethod.ENSEMBLE if (hi_hits > 0 or mr_hits > 0) else LIDMethod.UNICODE_SCRIPT,
            script=script,
            is_code_switched=has_latin,
            alternatives=[LanguageScore(language=other, confidence=0.2)],
            is_low_confidence=False,
        )

    # Romanized / Latin text: Lexical heuristics
    scores: Dict[SupportedClinicalLanguage, float] = {}
    total_tokens = len(tokens) or 1
    for lang, markers in ROMANIZED_MARKERS.items():
        hits = sum(1 for t in tokens if t in markers)
        scores[lang] = hits / total_tokens

    if prior_hint and prior_hint in scores:
        scores[prior_hint] += 0.15

    # Check code-switching (English medical terms + Indic markers)
    medical_terms = {"pain", "chest", "fever", "cough", "headache", "bp", "sugar", "doctor", "tablet"}
    has_med = any(t in medical_terms for t in tokens)
    has_indic = (
        scores[SupportedClinicalLanguage.HI] > 0
        or scores[SupportedClinicalLanguage.MR] > 0
        or scores[SupportedClinicalLanguage.TA] > 0
        or scores[SupportedClinicalLanguage.GU] > 0
    )
    is_code_switched = has_med and has_indic

    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    top_lang, top_score = ranked[0]
    second_score = ranked[1][1] if len(ranked) > 1 else 0.0

    if top_score > 0.08:
        confidence = min(0.92, 0.65 + (top_score - second_score) * 0.5)
        selected = top_lang
        method = LIDMethod.LEXICAL_HEURISTIC
    elif prior_hint:
        selected = prior_hint
        confidence = 0.65
        method = LIDMethod.PRIOR
    else:
        selected = SupportedClinicalLanguage.EN
        confidence = 0.60
        method = LIDMethod.LEXICAL_HEURISTIC

    alternatives = [
        LanguageScore(language=l, confidence=round(s, 2))
        for l, s in ranked[1:]
        if s > 0.05
    ]

    return LanguageIdentificationResult(
        language=selected,
        locale=LOCALE_MAP[selected],
        confidence=round(confidence, 2),
        method=method,
        script=script,
        is_code_switched=is_code_switched,
        alternatives=alternatives,
        is_low_confidence=confidence < 0.65,
    )
