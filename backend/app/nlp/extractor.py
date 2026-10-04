"""Deterministic clinical fact extraction engine.

Extracts canonical clinical concepts, evaluates negation scope, attaches exact
character offsets and verbatim evidence, and NEVER fabricates unstated facts.
"""

import re
from typing import List, Dict, Any, Optional
from ..clinical.models import (
    ClinicalFact,
    FactCategory,
    FactAssertion,
    FactTemporality,
    FactExperiencer,
    FactSource,
    FactProvenance,
)

# Standard concept dictionary (English & Hindi clinical terms)
CLINICAL_DICTIONARY: List[Dict[str, Any]] = [
    {
        "concept_id": "SYM_HEADACHE",
        "canonical_text": "headache",
        "category": FactCategory.SYMPTOM,
        "patterns": [
            r"\bsar\s+dard\b",
            r"\bsirdard\b",
            r"\bsar\s+mein\s+dard\b",
            r"\bheadache\b",
            r"\bhead\s+pain\b",
            r"\bmatha\s+dukhna\b",
            r"सिरदर्द",
            r"सर\s*दर्द",
            r"सिर\s*दर्द",
            r"सिर\s+में\s+दर्द",
            # Marathi
            r"डोके\s*(?:खूप\s*)?दुखत",
            r"डोकेदुखी",
            r"\bdoke\s*(?:khup\s*)?dukhta\b",
            # Gujarati
            r"માથું\s*(?:ખૂબ\s*)?દુખે",
            r"માથાનો\s*દુખાવો",
            r"\bmathu\s*(?:khup\s*)?dukhe\b",
            # Tamil
            r"தலைவலி",
            r"\bthalai\s*vali\b",
        ],
    },
    {
        "concept_id": "COND_HYPERTENSION",
        "canonical_text": "hypertension",
        "category": FactCategory.CONDITION,
        "patterns": [
            r"\bbp\s+ka\s+problem\b",
            r"\bhigh\s+bp\b",
            r"\bhypertension\b",
            r"\bblood\s+pressure\b",
            r"\bhigh\s+blood\s+pressure\b",
            r"\bbp\b",
            r"\buccha\s+raktchap\b",
            r"उच्च\s+रक्तचाप",
            r"बीपी",
            r"बीपी\s*(?:की\s*समस्या|का\s*प्रॉब्लम)?",
            # Marathi
            r"बीपी\s*(?:चा\s*त्रास)?",
            r"रक्तदाब",
            r"\bbp\s*cha\s*tras\b",
            # Gujarati
            r"બીપી\s*(?:ની\s*તકલીફ)?",
            r"હાઈ\s*બીપી",
            r"રક્તચાપ",
            r"\bbp\s*ni\s*taklif\b",
            # Tamil
            r"பிபி\s*(?:பிரச்சினை)?",
            r"இரத்த\s*அழுத்தம்",
            r"ரத்த\s*அழுத்தம்",
            r"\bbp\s*pirachinai\b",
        ],
    },
    {
        "concept_id": "SYM_CHEST_PAIN",
        "canonical_text": "chest pain",
        "category": FactCategory.SYMPTOM,
        "patterns": [
            r"\bseene\s+me(in)?\s+dard\b",
            r"\bsine\s+me(in)?\s+dard\b",
            r"\bchhati\s+me(in)?\s+dard\b",
            r"\bchest\s+pain\b",
            r"\bchest\s+tightness\b",
            r"सीने\s+में\s+दर्द",
            r"छाती\s+में\s+दर्द",
            # Marathi
            r"छातीत\s*(?:खूप\s*)?दुखत",
            r"छातीत\s*वेदना",
            r"छातीत\s*त्रास",
            r"\bchhatit\s*(?:khup\s*)?dukhta\b",
            # Gujarati
            r"છાતીમાં\s*(?:અસહ્ય\s*)?દુખાવો",
            r"છાતીમાં\s*ભાર",
            r"\bchhatima\s*(?:asahya\s*)?dukhavo\b",
            # Tamil
            r"நெஞ்சு\s*வலி",
            r"நெஞ்சில்\s*வலி",
            r"\bnenju\s*vali\b",
        ],
    },
    {
        "concept_id": "SYM_FEVER",
        "canonical_text": "fever",
        "category": FactCategory.SYMPTOM,
        "patterns": [
            r"\bbukhar\b",
            r"\btaap\b",
            r"\bbadan\s+garam\b",
            r"\bfever\b",
            r"\bhigh\s+temp(erature)?\b",
            r"बुखार",
            r"ताप",
            # Marathi
            r"खूप\s*ताप",
            r"ताप",
            r"\bkhup\s*taap\b",
            # Gujarati
            r"તાવ",
            r"ખૂબ\s*તાવ",
            r"\btaav\b",
            # Tamil
            r"காய்ச்சல்",
            r"கடுமையான\s*காய்ச்சல்",
            r"\bkaichal\b",
        ],
    },
    {
        "concept_id": "SYM_COUGH",
        "canonical_text": "cough",
        "category": FactCategory.SYMPTOM,
        "patterns": [
            r"\bkha?asi\b",
            r"\bkhaansi\b",
            r"\bcough\b",
            r"\bproductive\s+cough\b",
            r"खांसी",
            # Marathi
            r"खोकला",
            r"\bkhokla\b",
            # Gujarati
            r"ખાંસી",
            r"ઉધરસ",
            r"\bkhansi\b",
            # Tamil
            r"இருமல்",
            r"\birumal\b",
        ],
    },
    {
        "concept_id": "SYM_BREATHLESSNESS",
        "canonical_text": "breathlessness",
        "category": FactCategory.SYMPTOM,
        "patterns": [
            r"\bsa?ans\s+phool(na|raha)?\b",
            r"\bsaans\s+lene\s+me(?:in)?\s*(?:\w+\s*){0,2}(?:dikkat|takleef|problem)\b",
            r"\bsaans\s+me(?:in)?\s*(?:\w+\s*){0,2}(?:dikkat|takleef|problem)\b",
            r"\bbreathlessness\b",
            r"\bshortness\s+of\s+breath\b",
            r"\bdam\s+ghutna\b",
            r"\bdyspnea\b",
            r"सांस\s+फूलना",
            r"सांस\s+फूल",
            r"सांस\s+लेने\s+में\s*(?:\S+\s*){0,2}(?:दिक्कत|तकलीफ|परेशानी)",
            # Marathi
            r"श्वास\s+घेण्यास\s+त्रास",
            r"दम\s+लागतो",
            # Gujarati
            r"શ્વાસ\s+લેવામાં\s+તકલીફ",
            # Tamil
            r"மூச்சுத்திணறல்",
            r"சுவாசிப்பதில்\s*சிரமம்",
        ],
    },
    {
        "concept_id": "SYM_VOMITING",
        "canonical_text": "vomiting",
        "category": FactCategory.SYMPTOM,
        "patterns": [
            r"\bulti\b",
            r"\bvomit(ing)?\b",
            r"\bउल्टी\b",
            r"उलटी",
            r"வாந்தி",
        ],
    },
    {
        "concept_id": "SYM_DIARRHEA",
        "canonical_text": "diarrhea",
        "category": FactCategory.SYMPTOM,
        "patterns": [
            r"\bdast\b",
            r"\bloose\s+motions?\b",
            r"\bdiarrhea\b",
            r"\bदस्त\b",
            r"\bजुलाब\b",
            r"ઝાડા",
            r"வயிற்றுப்போக்கு",
        ],
    },
    {
        "concept_id": "COND_DIABETES",
        "canonical_text": "diabetes mellitus",
        "category": FactCategory.CONDITION,
        "patterns": [
            r"\bdiabetes\b",
            r"\btype\s+2\s+diabetes\b",
            r"\bsugar\s+ki\s+bimari\b",
            r"\bsugar\b",
            r"\bmadhumeh\b",
            r"\bमधुमेह\b",
            r"\bशुगर\b",
            r"डायबिटीज",
            # Marathi
            r"साखरेचा\s*आजार",
            # Gujarati
            r"ડાયાબિટીસ",
            r"સુગર",
            # Tamil
            r"சர்க்கரை\s*நோய்",
            r"சர்க்கரை",
            r"நீரிழிவு",
        ],
    },
    {
        "concept_id": "COND_ASTHMA",
        "canonical_text": "asthma",
        "category": FactCategory.CONDITION,
        "patterns": [
            r"\basthma\b",
            r"\bdama\b",
            r"\bdame\s+ki\s+bimari\b",
            r"\bदमा\b",
            r"\bअस्थमा\b",
            r"दमा",
            r"ஆஸ்துமா",
        ],
    },
    {
        "concept_id": "COND_KIDNEY_STONE",
        "canonical_text": "kidney stones (nephrolithiasis)",
        "category": FactCategory.CONDITION,
        "patterns": [
            r"\bpathri\b",
            r"\bgurde\s+ki\s+pathri\b",
            r"\bkidney\s+stones?\b",
            r"\bnephrolithiasis\b",
            r"\bपथरी\b",
            r"खडा",
            r"પથરી",
            r"சிறுநீரகக்\s*கல்",
        ],
    },
    {
        "concept_id": "MED_METFORMIN",
        "canonical_text": "metformin",
        "category": FactCategory.MEDICATION,
        "patterns": [
            r"\bmetformin\b",
            r"\bglucophage\b",
            r"मेटफॉर्मिन",
        ],
    },
    {
        "concept_id": "MED_TELMISARTAN",
        "canonical_text": "telmisartan",
        "category": FactCategory.MEDICATION,
        "patterns": [
            r"\btelmisartan\b",
            r"\btelma\b",
            r"टेल्मिसार्टन",
        ],
    },
    {
        "concept_id": "MED_PARACETAMOL",
        "canonical_text": "paracetamol",
        "category": FactCategory.MEDICATION,
        "patterns": [
            r"\bparacetamol\b",
            r"\bpcm\b",
            r"\bcrocin\b",
            r"\bdolo\b",
            r"पेरासिटामोल",
        ],
    },
    {
        "concept_id": "MED_AMOXICILLIN",
        "canonical_text": "amoxicillin",
        "category": FactCategory.MEDICATION,
        "patterns": [
            r"\bamoxicillin\b",
            r"\bmox\b",
            r"एमोक्सिसिलिन",
        ],
    },
    {
        "concept_id": "ALG_PENICILLIN",
        "canonical_text": "penicillin allergy",
        "category": FactCategory.ALLERGY,
        "patterns": [
            r"\bpenicillin\s+allergy\b",
            r"\ballergic\s+to\s+penicillin\b",
            r"\bpenicillin\s+se\s+allergy\b",
            r"पेनिसिलिन\s*(?:से\s*)?एलर्जी",
        ],
    },
    {
        "concept_id": "ALG_SULFA",
        "canonical_text": "sulfa allergy",
        "category": FactCategory.ALLERGY,
        "patterns": [
            r"\bsulfa\s+allergy\b",
            r"\ballergic\s+to\s+sulfa\b",
            r"सल्फा\s*(?:से\s*)?एलर्जी",
        ],
    },
]

# Multilingual Post-Negation patterns
POST_NEGATION_PATTERNS = [
    r"\b(nahi|nahin|nhi|ni)\s+(hai|tha|thi|hote)?\b",
    r"\b(ka\s+problem|ki\s+bimari|ki\s+shikayat)?\s*(nahi|nahin|nhi)\s*(hai|tha)?\b",
    r"नहीं\s*(?:है|था|थी)?",
    # Marathi: nahi, nahit, nahiye
    r"\b(nahi|nahit|nahiye)\s*(ahe|hota|hoti)?\b",
    r"नाही\s*(?:आहे|होता|होती)?",
    r"नाहीत",
    # Gujarati: nathi
    r"\bnathi\s*(?:che|hatu)?\b",
    r"નથી\s*(?:છે|હતું)?",
    # Tamil: illai, illa
    r"\b(illai|illa)\s*(?:irukku|irunthathu)?\b",
    r"இல்லை",
    r"இல்ல",
    # English
    r"\bnot\s+present\b",
    r"\bdenied\b",
    r"\babsent\b",
    r"\bruled\s+out\b",
]

# Multilingual Pre-Negation patterns
PRE_NEGATION_PATTERNS = [
    r"\b(no|not|do\s+not\s+have|don\'?t\s+have|does\s+not\s+have|doesn\'?t\s+have|denies|denied|without|negative\s+for|rules?\s+out)\b",
    r"\b(koi|kisi\s+bhi)\s*(\w+\s*){0,2}(nahi|nahin|नहीं)\b",
    r"કોઈ\s*(\w+\s*){0,2}નથી",
    r"कोणताही\s*(\w+\s*){0,2}नाही",
]

# Multilingual Contrastive Conjunctions
CONTRASTIVE_CONJUNCTIONS = [
    # Hindi / Urdu
    r"\blekin\b",
    r"\bpar\b",
    r"\bparantu\b",
    r"\bmagar\b",
    r"\bkintu\b",
    r"\baur\b",
    r"लेकिन",
    r"परंतु",
    r"पर",
    r"और",
    # Marathi
    r"\bpan\b",
    r"\baani\b",
    r"पण",
    r"आणि",
    # Gujarati
    r"\bane\b",
    r"પરંતુ",
    r"અને",
    # Tamil
    r"\baanaal\b",
    r"\bmatrum\b",
    r"ஆனால்",
    r"மற்றும்",
    # English
    r"\bbut\b",
    r"\bhowever\b",
    r"\balso\b",
    r"\band\b",
    r"\byet\b",
    r"\balthough\b",
]


def extract_clinical_facts(
    text: str,
    language: str = "hi",
    source_id: str = "encounter-live",
) -> List[ClinicalFact]:
    """Extracts clinical facts from transcript with evidence grounding and negation detection."""
    if not text or not text.strip():
        return []

    lower_text = text.lower()
    extracted_facts: List[ClinicalFact] = []
    seen_facts: set[tuple[str, str, str, str]] = set()

    # 1. Vital Signs: Blood pressure extraction (e.g. "Blood pressure 148/92")
    bp_match = re.search(r"\b(?:blood\s+pressure|bp|raktchap)?\s*[:=]?\s*(\d{2,3})\s*/\s*(\d{2,3})\s*(?:mm\s*hg)?\b", lower_text)
    if bp_match and bp_match.group(1) and bp_match.group(2):
        sys_val = int(bp_match.group(1))
        dia_val = int(bp_match.group(2))
        if 50 <= sys_val <= 300 and 30 <= dia_val <= 200:
            start_c, end_c = bp_match.span()
            matched_bp = text[start_c:end_c]
            # Systolic
            sys_fact = ClinicalFact(
                concept_id="VITAL_BP_SYSTOLIC",
                canonical_text="systolic blood pressure",
                category=FactCategory.VITAL,
                assertion=FactAssertion.PRESENT,
                temporality=FactTemporality.CURRENT,
                experiencer=FactExperiencer.PATIENT,
                evidence=matched_bp,
                source=FactSource.PATIENT_TRANSCRIPT,
                confidence=0.98,
                language=language,
                provenance=FactProvenance(
                    source_id=source_id,
                    start_char=start_c,
                    end_char=end_c,
                    matched_text=matched_bp,
                    engine="medscribe-deterministic-nlp",
                ),
            )
            extracted_facts.append(sys_fact)
            seen_facts.add(("VITAL_BP_SYSTOLIC", sys_fact.assertion.value, sys_fact.temporality.value, sys_fact.experiencer.value))

            # Diastolic
            dia_fact = ClinicalFact(
                concept_id="VITAL_BP_DIASTOLIC",
                canonical_text="diastolic blood pressure",
                category=FactCategory.VITAL,
                assertion=FactAssertion.PRESENT,
                temporality=FactTemporality.CURRENT,
                experiencer=FactExperiencer.PATIENT,
                evidence=matched_bp,
                source=FactSource.PATIENT_TRANSCRIPT,
                confidence=0.98,
                language=language,
                provenance=FactProvenance(
                    source_id=source_id,
                    start_char=start_c,
                    end_char=end_c,
                    matched_text=matched_bp,
                    engine="medscribe-deterministic-nlp",
                ),
            )
            extracted_facts.append(dia_fact)
            seen_facts.add(("VITAL_BP_DIASTOLIC", dia_fact.assertion.value, dia_fact.temporality.value, dia_fact.experiencer.value))

    # Experiencer check (e.g. "Mother had asthma")
    has_family = bool(re.search(r"\b(mother|mummy|maa|father|papa|brother|bhai|sister|behan|family)\b", lower_text))
    default_experiencer = FactExperiencer.FAMILY_MEMBER if has_family else FactExperiencer.PATIENT

    # Uncertainty / Conditional checks
    is_suspected = bool(re.search(r"\b(shayad|lagta\s+hai|ho\s+sakta\s+hai|suspect|maybe|perhaps|possible)\b", lower_text))
    is_conditional = bool(re.search(r"\b(agar|yadi|jab|if|whenever|in\s+case)\b", lower_text))

    # Check for historical past markers and current negation
    has_historical_marker = bool(re.search(r"\b(pehle|past\s+me|purani|earlier|previously|history\s+of|had\b|tha\b|thi\b|the\b|years\s+ago|months\s+ago)\b", lower_text))
    has_current_negation = (
        bool(re.search(r"\b(ab\s+nahi|ab\s+nahin|now\s+no|not\s+anymore|ab\s+theek|now\s+resolved|not\s+now|no\s+longer)\b", lower_text))
        or bool(re.search(r"\b(don'?t|do\s+not|no\b|nahi|nahin)\b.*?\b(now|ab)\b", lower_text))
        or bool(re.search(r"\b(now|ab)\b.*?\b(nahi|nahin|not|no\b)\b", lower_text))
    )

    for item in CLINICAL_DICTIONARY:
        concept_id = item["concept_id"]

        best_match = None
        for pattern_str in item["patterns"]:
            match = re.search(pattern_str, lower_text, re.IGNORECASE)
            if match:
                best_match = match
                break

        if not best_match:
            continue

        start_char, end_char = best_match.span()
        matched_text = text[start_char:end_char]

        # Case: Contrastive past affirmed + current negated: "Pehle diabetes tha, ab nahi hai" or "I don't have diabetes now, but I had it five years ago"
        if has_historical_marker and has_current_negation:
            clauses = re.split(r"[,;।|]|\b(?:lekin|par|magar|kintu|but|however)\b", text, flags=re.IGNORECASE)
            hist_clause = next((c for c in clauses if re.search(r"\b(pehle|past\s+me|purani|earlier|previously|history\s+of|had|tha|thi|the|years\s+ago|months\s+ago)\b", c, re.I)), clauses[-1] if len(clauses) > 1 else text)
            curr_clause = next((c for c in clauses if re.search(r"\b(ab|now|don'?t|not|nahi|nahin)\b", c, re.I)), clauses[0] if len(clauses) > 1 else text)

            # 1. Historical Fact
            hist_ev = hist_clause.strip()
            h_start = text.find(hist_ev) if hist_ev in text else start_char
            h_end = h_start + len(hist_ev) if h_start >= 0 else end_char

            hist_key = (concept_id, FactAssertion.PRESENT.value, FactTemporality.HISTORICAL.value, default_experiencer.value)
            if hist_key not in seen_facts:
                seen_facts.add(hist_key)
                hist_fact = ClinicalFact(
                    concept_id=concept_id,
                    canonical_text=item["canonical_text"],
                    category=item["category"],
                    assertion=FactAssertion.PRESENT,
                    temporality=FactTemporality.HISTORICAL,
                    experiencer=default_experiencer,
                    evidence=hist_ev or matched_text,
                    source=FactSource.PATIENT_TRANSCRIPT,
                    confidence=0.95,
                    language=language,
                    provenance=FactProvenance(
                        source_id=source_id,
                        start_char=max(0, h_start),
                        end_char=max(0, h_end),
                        matched_text=matched_text,
                        engine="medscribe-deterministic-nlp",
                    ),
                )
                extracted_facts.append(hist_fact)

            # 2. Current Negated Fact
            curr_ev = curr_clause.strip()
            c_start = text.find(curr_ev) if curr_ev in text else end_char
            c_end = c_start + len(curr_ev) if c_start >= 0 else len(text)

            curr_key = (concept_id, FactAssertion.NEGATED.value, FactTemporality.CURRENT.value, default_experiencer.value)
            if curr_key not in seen_facts:
                seen_facts.add(curr_key)
                curr_fact = ClinicalFact(
                    concept_id=concept_id,
                    canonical_text=item["canonical_text"],
                    category=item["category"],
                    assertion=FactAssertion.NEGATED,
                    temporality=FactTemporality.CURRENT,
                    experiencer=default_experiencer,
                    evidence=curr_ev or "not present now",
                    source=FactSource.PATIENT_TRANSCRIPT,
                    confidence=0.95,
                    language=language,
                    provenance=FactProvenance(
                        source_id=source_id,
                        start_char=max(0, c_start),
                        end_char=max(0, c_end),
                        matched_text=curr_ev or matched_text,
                        engine="medscribe-deterministic-nlp",
                    ),
                )
                extracted_facts.append(curr_fact)

            continue

        # Standard non-contrastive case:
        is_negated, evidence_start, evidence_end, trigger_word = check_negation_scope(
            text, start_char, end_char
        )

        assertion = FactAssertion.NEGATED if is_negated else (
            FactAssertion.SUSPECTED if is_suspected else (
                FactAssertion.CONDITIONAL if is_conditional else FactAssertion.PRESENT
            )
        )
        temporality = FactTemporality.HISTORICAL if has_historical_marker else FactTemporality.CURRENT
        verbatim_evidence = text[evidence_start:evidence_end].strip() or matched_text

        fact_key = (concept_id, assertion.value, temporality.value, default_experiencer.value)
        if fact_key in seen_facts:
            continue
        seen_facts.add(fact_key)

        provenance = FactProvenance(
            source_id=source_id,
            start_char=evidence_start,
            end_char=evidence_end,
            matched_text=matched_text,
            engine="medscribe-deterministic-nlp",
        )

        fact = ClinicalFact(
            concept_id=concept_id,
            canonical_text=item["canonical_text"],
            category=item["category"],
            assertion=assertion,
            temporality=temporality,
            experiencer=default_experiencer,
            evidence=verbatim_evidence,
            source=FactSource.PATIENT_TRANSCRIPT,
            confidence=0.92 if is_negated else 0.95,
            language=language,
            provenance=provenance,
        )
        extracted_facts.append(fact)

    return extracted_facts


def check_negation_scope(
    text: str, match_start: int, match_end: int
) -> tuple[bool, int, int, Optional[str]]:
    """Checks whether the concept at [match_start:match_end] is negated within its clause."""
    lower_text = text.lower()

    # Define post-window (up to 30 characters after match, stopping at contrastive conjunction or punctuation)
    post_text = lower_text[match_end : match_end + 35]
    pre_text = lower_text[max(0, match_start - 30) : match_start]

    # Check for boundary cutoff in post-text (e.g. "lekin", "but", ",")
    post_limit = len(post_text)
    for conj in CONTRASTIVE_CONJUNCTIONS:
        c_match = re.search(conj, post_text)
        if c_match and c_match.start() < post_limit:
            post_limit = c_match.start()
    bounded_post = post_text[:post_limit]

    # 1. Check post-negation (e.g. "BP ka problem nahi hai")
    for neg_pat in POST_NEGATION_PATTERNS:
        n_match = re.search(neg_pat, bounded_post)
        if n_match:
            ev_start = match_start
            ev_end = match_end + n_match.end()
            return True, ev_start, ev_end, n_match.group(0)

    # 2. Check pre-negation (e.g. "no chest pain", "denies fever")
    pre_limit = 0
    for conj in CONTRASTIVE_CONJUNCTIONS:
        c_matches = list(re.finditer(conj, pre_text))
        if c_matches:
            last_c = c_matches[-1]
            if last_c.end() > pre_limit:
                pre_limit = last_c.end()
    bounded_pre = pre_text[pre_limit:]

    for neg_pat in PRE_NEGATION_PATTERNS:
        n_match = re.search(neg_pat, bounded_pre)
        if n_match:
            ev_start = max(0, match_start - 30) + pre_limit + n_match.start()
            ev_end = match_end
            return True, ev_start, ev_end, n_match.group(0)

    # Clause boundaries for evidence window
    ev_start = match_start
    ev_end = match_end
    # Include up to trailing verb or conjunction
    trailing_verb = re.search(r"^\s*(hai|tha|rehta hai|aa raha hai)", lower_text[match_end : match_end + 20])
    if trailing_verb:
        ev_end = match_end + trailing_verb.end()

    return False, ev_start, ev_end, None
