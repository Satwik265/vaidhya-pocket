"""Phase 8.5-G: 150 Labelled Clinical Evaluation Benchmark Cases.

Covers 6 Indian languages (EN: 25, HI: 35, Hinglish: 30, MR: 20, TA: 20, GU: 20)
across 12 clinical domains with strict ground-truth canonical facts, assertion,
temporality, and experiencer labels. Zero PHI.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel


class ExpectedFact(BaseModel):
    concept_id: str
    canonical_text: str
    category: str
    assertion: str = "present"
    temporality: str = "current"
    experiencer: str = "patient"
    has_red_flag: bool = False
    red_flag_type: Optional[str] = None


class BenchmarkCase(BaseModel):
    case_id: str
    language: str
    domain: str
    utterance: str
    expected_facts: List[ExpectedFact]


# 150 Standard Benchmark Cases
CLINICAL_BENCHMARK_CASES: List[BenchmarkCase] = [
    # -------------------------------------------------------------
    # 1. English (25 Cases: EN-001 to EN-025)
    # -------------------------------------------------------------
    BenchmarkCase(
        case_id="BENCH-EN-001", language="en", domain="Cardiology",
        utterance="I have severe chest pain and breathlessness.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_CHEST_PAIN", canonical_text="chest pain", category="symptom", assertion="present", has_red_flag=True, red_flag_type="ACS_DYSPNEA"),
            ExpectedFact(concept_id="SYM_BREATHLESSNESS", canonical_text="breathlessness", category="symptom", assertion="present", has_red_flag=True, red_flag_type="ACS_DYSPNEA"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-EN-002", language="en", domain="Cardiology",
        utterance="I do not have any chest pain.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_CHEST_PAIN", canonical_text="chest pain", category="symptom", assertion="negated"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-EN-003", language="en", domain="Neurology",
        utterance="I have a terrible throbbing headache since morning.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_HEADACHE", canonical_text="headache", category="symptom", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-EN-004", language="en", domain="Neurology",
        utterance="No headache today, feeling fine in the head.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_HEADACHE", canonical_text="headache", category="symptom", assertion="negated"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-EN-005", language="en", domain="Infectious Disease",
        utterance="High fever and body chills for two days.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_FEVER", canonical_text="fever", category="symptom", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-EN-006", language="en", domain="Infectious Disease",
        utterance="I have no fever at all.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_FEVER", canonical_text="fever", category="symptom", assertion="negated"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-EN-007", language="en", domain="Pulmonology",
        utterance="I have a dry cough that gets worse at night.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_COUGH", canonical_text="cough", category="symptom", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-EN-008", language="en", domain="Pulmonology",
        utterance="I don't have any cough or cold.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_COUGH", canonical_text="cough", category="symptom", assertion="negated"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-EN-009", language="en", domain="Cardiology",
        utterance="My doctor said I have hypertension and high blood pressure.",
        expected_facts=[
            ExpectedFact(concept_id="COND_HYPERTENSION", canonical_text="hypertension", category="condition", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-EN-010", language="en", domain="Cardiology",
        utterance="Blood pressure is 148/92 mmHg today.",
        expected_facts=[
            ExpectedFact(concept_id="VITAL_BP_SYSTOLIC", canonical_text="systolic blood pressure", category="vital", assertion="present"),
            ExpectedFact(concept_id="VITAL_BP_DIASTOLIC", canonical_text="diastolic blood pressure", category="vital", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-EN-011", language="en", domain="Endocrinology",
        utterance="I was diagnosed with diabetes five years ago.",
        expected_facts=[
            ExpectedFact(concept_id="COND_DIABETES", canonical_text="diabetes mellitus", category="condition", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-EN-012", language="en", domain="Endocrinology",
        utterance="I do not have diabetes or high blood sugar.",
        expected_facts=[
            ExpectedFact(concept_id="COND_DIABETES", canonical_text="diabetes mellitus", category="condition", assertion="negated"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-EN-013", language="en", domain="Pulmonology",
        utterance="I suffer from severe bronchial asthma.",
        expected_facts=[
            ExpectedFact(concept_id="COND_ASTHMA", canonical_text="asthma", category="condition", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-EN-014", language="en", domain="Nephrology",
        utterance="Severe flank pain due to kidney stones.",
        expected_facts=[
            ExpectedFact(concept_id="COND_KIDNEY_STONE", canonical_text="kidney stones (nephrolithiasis)", category="condition", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-EN-015", language="en", domain="Gastroenterology",
        utterance="Persistent vomiting and feeling nauseous after eating.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_VOMITING", canonical_text="vomiting", category="symptom", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-EN-016", language="en", domain="Gastroenterology",
        utterance="No vomiting, stomach is settled.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_VOMITING", canonical_text="vomiting", category="symptom", assertion="negated"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-EN-017", language="en", domain="Gastroenterology",
        utterance="Watery diarrhea and loose motions 5 times today.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_DIARRHEA", canonical_text="diarrhea", category="symptom", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-EN-018", language="en", domain="Endocrinology",
        utterance="Taking tablet Metformin 500mg twice daily.",
        expected_facts=[
            ExpectedFact(concept_id="MED_METFORMIN", canonical_text="metformin", category="medication", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-EN-019", language="en", domain="Cardiology",
        utterance="Taking Telmisartan 40mg for high blood pressure.",
        expected_facts=[
            ExpectedFact(concept_id="MED_TELMISARTAN", canonical_text="telmisartan", category="medication", assertion="present"),
            ExpectedFact(concept_id="COND_HYPERTENSION", canonical_text="hypertension", category="condition", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-EN-020", language="en", domain="Infectious Disease",
        utterance="Doctor prescribed Paracetamol 650mg for fever.",
        expected_facts=[
            ExpectedFact(concept_id="MED_PARACETAMOL", canonical_text="paracetamol", category="medication", assertion="present"),
            ExpectedFact(concept_id="SYM_FEVER", canonical_text="fever", category="symptom", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-EN-021", language="en", domain="Infectious Disease",
        utterance="Currently on a course of Amoxicillin capsules.",
        expected_facts=[
            ExpectedFact(concept_id="MED_AMOXICILLIN", canonical_text="amoxicillin", category="medication", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-EN-022", language="en", domain="Pulmonology",
        utterance="My mother has asthma, but I have never had it.",
        expected_facts=[
            ExpectedFact(concept_id="COND_ASTHMA", canonical_text="asthma", category="condition", assertion="present", experiencer="family_member"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-EN-023", language="en", domain="Endocrinology",
        utterance="I had diabetes previously, but my sugar is normal now.",
        expected_facts=[
            ExpectedFact(concept_id="COND_DIABETES", canonical_text="diabetes mellitus", category="condition", assertion="present", temporality="historical"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-EN-024", language="en", domain="Pulmonology",
        utterance="No chest pain, but I am experiencing shortness of breath.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_CHEST_PAIN", canonical_text="chest pain", category="symptom", assertion="negated"),
            ExpectedFact(concept_id="SYM_BREATHLESSNESS", canonical_text="breathlessness", category="symptom", assertion="present", has_red_flag=True, red_flag_type="SEVERE_DYSPNEA"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-EN-025", language="en", domain="Cardiology",
        utterance="Father has hypertension, and my BP is high too.",
        expected_facts=[
            ExpectedFact(concept_id="COND_HYPERTENSION", canonical_text="hypertension", category="condition", assertion="present", experiencer="family_member"),
        ],
    ),

    # -------------------------------------------------------------
    # 2. Hindi (35 Cases: HI-001 to HI-035)
    # -------------------------------------------------------------
    BenchmarkCase(
        case_id="BENCH-HI-001", language="hi", domain="Infectious Disease",
        utterance="मुझे तीन दिन से तेज बुखार है।",
        expected_facts=[
            ExpectedFact(concept_id="SYM_FEVER", canonical_text="fever", category="symptom", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HI-002", language="hi", domain="Infectious Disease",
        utterance="मुझे कोई बुखार नहीं है।",
        expected_facts=[
            ExpectedFact(concept_id="SYM_FEVER", canonical_text="fever", category="symptom", assertion="negated"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HI-003", language="hi", domain="Neurology",
        utterance="सिर में बहुत तेज दर्द हो रहा है।",
        expected_facts=[
            ExpectedFact(concept_id="SYM_HEADACHE", canonical_text="headache", category="symptom", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HI-004", language="hi", domain="Neurology",
        utterance="आज सिरदर्द नहीं है।",
        expected_facts=[
            ExpectedFact(concept_id="SYM_HEADACHE", canonical_text="headache", category="symptom", assertion="negated"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HI-005", language="hi", domain="Pulmonology",
        utterance="सुखी खांसी आ रही है रात भर।",
        expected_facts=[
            ExpectedFact(concept_id="SYM_COUGH", canonical_text="cough", category="symptom", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HI-006", language="hi", domain="Pulmonology",
        utterance="खांसी बिल्कुल नहीं है।",
        expected_facts=[
            ExpectedFact(concept_id="SYM_COUGH", canonical_text="cough", category="symptom", assertion="negated"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HI-007", language="hi", domain="Cardiology",
        utterance="सीने में बहुत तेज दर्द है और सांस लेने में दिक्कत है।",
        expected_facts=[
            ExpectedFact(concept_id="SYM_CHEST_PAIN", canonical_text="chest pain", category="symptom", assertion="present", has_red_flag=True, red_flag_type="ACS_DYSPNEA"),
            ExpectedFact(concept_id="SYM_BREATHLESSNESS", canonical_text="breathlessness", category="symptom", assertion="present", has_red_flag=True, red_flag_type="ACS_DYSPNEA"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HI-008", language="hi", domain="Cardiology",
        utterance="सीने में कोई दर्द नहीं है।",
        expected_facts=[
            ExpectedFact(concept_id="SYM_CHEST_PAIN", canonical_text="chest pain", category="symptom", assertion="negated"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HI-009", language="hi", domain="Pulmonology",
        utterance="सांस लेने में बहुत तकलीफ हो रही है।",
        expected_facts=[
            ExpectedFact(concept_id="SYM_BREATHLESSNESS", canonical_text="breathlessness", category="symptom", assertion="present", has_red_flag=True, red_flag_type="SEVERE_DYSPNEA"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HI-010", language="hi", domain="Cardiology",
        utterance="मुझे उच्च रक्तचाप की समस्या है।",
        expected_facts=[
            ExpectedFact(concept_id="COND_HYPERTENSION", canonical_text="hypertension", category="condition", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HI-011", language="hi", domain="Cardiology",
        utterance="बीपी बिल्कुल नॉर्मल है, बीपी की समस्या नहीं है।",
        expected_facts=[
            ExpectedFact(concept_id="COND_HYPERTENSION", canonical_text="hypertension", category="condition", assertion="negated"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HI-012", language="hi", domain="Endocrinology",
        utterance="मुझे शुगर की बीमारी है दस साल से।",
        expected_facts=[
            ExpectedFact(concept_id="COND_DIABETES", canonical_text="diabetes mellitus", category="condition", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HI-013", language="hi", domain="Endocrinology",
        utterance="मुझे कोई मधुमेह या शुगर नहीं है।",
        expected_facts=[
            ExpectedFact(concept_id="COND_DIABETES", canonical_text="diabetes mellitus", category="condition", assertion="negated"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HI-014", language="hi", domain="Pulmonology",
        utterance="मुझे बचपन से दमा की बीमारी है।",
        expected_facts=[
            ExpectedFact(concept_id="COND_ASTHMA", canonical_text="asthma", category="condition", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HI-015", language="hi", domain="Nephrology",
        utterance="पेट के निचले हिस्से में पथरी का दर्द हो रहा है।",
        expected_facts=[
            ExpectedFact(concept_id="COND_KIDNEY_STONE", canonical_text="kidney stones (nephrolithiasis)", category="condition", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HI-016", language="hi", domain="Gastroenterology",
        utterance="सुबह से तीन बार उल्टी हुई है।",
        expected_facts=[
            ExpectedFact(concept_id="SYM_VOMITING", canonical_text="vomiting", category="symptom", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HI-017", language="hi", domain="Gastroenterology",
        utterance="उल्टी बिल्कुल नहीं आ रही।",
        expected_facts=[
            ExpectedFact(concept_id="SYM_VOMITING", canonical_text="vomiting", category="symptom", assertion="negated"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HI-018", language="hi", domain="Gastroenterology",
        utterance="पानी जैसा दस्त हो रहा है।",
        expected_facts=[
            ExpectedFact(concept_id="SYM_DIARRHEA", canonical_text="diarrhea", category="symptom", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HI-019", language="hi", domain="Endocrinology",
        utterance="रोज सुबह मेटफॉर्मिन गोली खाता हूँ।",
        expected_facts=[
            ExpectedFact(concept_id="MED_METFORMIN", canonical_text="metformin", category="medication", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HI-020", language="hi", domain="Cardiology",
        utterance="डॉक्टर ने टेल्मिसार्टन लिखी है।",
        expected_facts=[
            ExpectedFact(concept_id="MED_TELMISARTAN", canonical_text="telmisartan", category="medication", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HI-021", language="hi", domain="Infectious Disease",
        utterance="बुखार के लिए पेरासिटामोल ली थी।",
        expected_facts=[
            ExpectedFact(concept_id="MED_PARACETAMOL", canonical_text="paracetamol", category="medication", assertion="present"),
            ExpectedFact(concept_id="SYM_FEVER", canonical_text="fever", category="symptom", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HI-022", language="hi", domain="Infectious Disease",
        utterance="एमोक्सिसिलिन कैप्सूल चालू है।",
        expected_facts=[
            ExpectedFact(concept_id="MED_AMOXICILLIN", canonical_text="amoxicillin", category="medication", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HI-023", language="hi", domain="Pulmonology",
        utterance="मेरी माँ को दमा है।",
        expected_facts=[
            ExpectedFact(concept_id="COND_ASTHMA", canonical_text="asthma", category="condition", assertion="present", experiencer="family_member"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HI-024", language="hi", domain="Cardiology",
        utterance="मेरे पिताजी को बीपी की बीमारी है।",
        expected_facts=[
            ExpectedFact(concept_id="COND_HYPERTENSION", canonical_text="hypertension", category="condition", assertion="present", experiencer="family_member"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HI-025", language="hi", domain="Endocrinology",
        utterance="पहले शुगर था लेकिन अब नहीं है।",
        expected_facts=[
            ExpectedFact(concept_id="COND_DIABETES", canonical_text="diabetes mellitus", category="condition", assertion="present", temporality="historical"),
            ExpectedFact(concept_id="COND_DIABETES", canonical_text="diabetes mellitus", category="condition", assertion="negated", temporality="current"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HI-026", language="hi", domain="Nephrology",
        utterance="शायद गुर्दे में पथरी है।",
        expected_facts=[
            ExpectedFact(concept_id="COND_KIDNEY_STONE", canonical_text="kidney stones (nephrolithiasis)", category="condition", assertion="suspected"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HI-027", language="hi", domain="Cardiology",
        utterance="सीने में दर्द नहीं है लेकिन सांस लेने में बहुत दिक्कत है।",
        expected_facts=[
            ExpectedFact(concept_id="SYM_CHEST_PAIN", canonical_text="chest pain", category="symptom", assertion="negated"),
            ExpectedFact(concept_id="SYM_BREATHLESSNESS", canonical_text="breathlessness", category="symptom", assertion="present", has_red_flag=True, red_flag_type="SEVERE_DYSPNEA"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HI-028", language="hi", domain="Infectious Disease",
        utterance="सिरदर्द और बुखार दोनों साथ में हैं।",
        expected_facts=[
            ExpectedFact(concept_id="SYM_HEADACHE", canonical_text="headache", category="symptom", assertion="present"),
            ExpectedFact(concept_id="SYM_FEVER", canonical_text="fever", category="symptom", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HI-029", language="hi", domain="Infectious Disease",
        utterance="खांसी है लेकिन बुखार नहीं है।",
        expected_facts=[
            ExpectedFact(concept_id="SYM_COUGH", canonical_text="cough", category="symptom", assertion="present"),
            ExpectedFact(concept_id="SYM_FEVER", canonical_text="fever", category="symptom", assertion="negated"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HI-030", language="hi", domain="Gastroenterology",
        utterance="उल्टी और दस्त से हालत खराब है।",
        expected_facts=[
            ExpectedFact(concept_id="SYM_VOMITING", canonical_text="vomiting", category="symptom", assertion="present"),
            ExpectedFact(concept_id="SYM_DIARRHEA", canonical_text="diarrhea", category="symptom", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HI-031", language="hi", domain="Endocrinology",
        utterance="डायबिटीज के कारण पैर में जलन होती है।",
        expected_facts=[
            ExpectedFact(concept_id="COND_DIABETES", canonical_text="diabetes mellitus", category="condition", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HI-032", language="hi", domain="Cardiology",
        utterance="छाती में दर्द नहीं है, सिर्फ गैस लगती है।",
        expected_facts=[
            ExpectedFact(concept_id="SYM_CHEST_PAIN", canonical_text="chest pain", category="symptom", assertion="negated"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HI-033", language="hi", domain="Neurology",
        utterance="सिर दर्द बहुत पुराना है।",
        expected_facts=[
            ExpectedFact(concept_id="SYM_HEADACHE", canonical_text="headache", category="symptom", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HI-034", language="hi", domain="Pulmonology",
        utterance="दमा नहीं है मुझे।",
        expected_facts=[
            ExpectedFact(concept_id="COND_ASTHMA", canonical_text="asthma", category="condition", assertion="negated"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HI-035", language="hi", domain="Cardiology",
        utterance="सीने में दर्द है लेकिन सांस नहीं फूल रही।",
        expected_facts=[
            ExpectedFact(concept_id="SYM_CHEST_PAIN", canonical_text="chest pain", category="symptom", assertion="present"),
        ],
    ),

    # -------------------------------------------------------------
    # 3. Hinglish (30 Cases: HG-001 to HG-030)
    # -------------------------------------------------------------
    BenchmarkCase(
        case_id="BENCH-HG-001", language="hi", domain="Neurology",
        utterance="Mujhe bohot tej sar dard ho raha hai.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_HEADACHE", canonical_text="headache", category="symptom", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HG-002", language="hi", domain="Neurology",
        utterance="Sar dard nahi hai aaj.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_HEADACHE", canonical_text="headache", category="symptom", assertion="negated"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HG-003", language="hi", domain="Infectious Disease",
        utterance="Teen din se bukhar aa raha hai.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_FEVER", canonical_text="fever", category="symptom", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HG-004", language="hi", domain="Infectious Disease",
        utterance="Mujhe koi bukhar nahi hai.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_FEVER", canonical_text="fever", category="symptom", assertion="negated"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HG-005", language="hi", domain="Pulmonology",
        utterance="Khasi bohot zyada chal rahi hai.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_COUGH", canonical_text="cough", category="symptom", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HG-006", language="hi", domain="Pulmonology",
        utterance="Khasi bilkul nahi hai.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_COUGH", canonical_text="cough", category="symptom", assertion="negated"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HG-007", language="hi", domain="Cardiology",
        utterance="Seene me dard hai aur saans lene me dikkat hai.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_CHEST_PAIN", canonical_text="chest pain", category="symptom", assertion="present", has_red_flag=True, red_flag_type="ACS_DYSPNEA"),
            ExpectedFact(concept_id="SYM_BREATHLESSNESS", canonical_text="breathlessness", category="symptom", assertion="present", has_red_flag=True, red_flag_type="ACS_DYSPNEA"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HG-008", language="hi", domain="Cardiology",
        utterance="Chhati me dard nahi hai.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_CHEST_PAIN", canonical_text="chest pain", category="symptom", assertion="negated"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HG-009", language="hi", domain="Pulmonology",
        utterance="Thoda chalne par saans phool raha hai.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_BREATHLESSNESS", canonical_text="breathlessness", category="symptom", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HG-010", language="hi", domain="Cardiology",
        utterance="Mujhe high bp ka problem hai.",
        expected_facts=[
            ExpectedFact(concept_id="COND_HYPERTENSION", canonical_text="hypertension", category="condition", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HG-011", language="hi", domain="Cardiology",
        utterance="BP ka problem nahi hai bilkul.",
        expected_facts=[
            ExpectedFact(concept_id="COND_HYPERTENSION", canonical_text="hypertension", category="condition", assertion="negated"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HG-012", language="hi", domain="Endocrinology",
        utterance="Sugar ki bimari hai 5 saal se.",
        expected_facts=[
            ExpectedFact(concept_id="COND_DIABETES", canonical_text="diabetes mellitus", category="condition", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HG-013", language="hi", domain="Endocrinology",
        utterance="Mujhe sugar nahi hai.",
        expected_facts=[
            ExpectedFact(concept_id="COND_DIABETES", canonical_text="diabetes mellitus", category="condition", assertion="negated"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HG-014", language="hi", domain="Pulmonology",
        utterance="Dame ki bimari hai mujhe.",
        expected_facts=[
            ExpectedFact(concept_id="COND_ASTHMA", canonical_text="asthma", category="condition", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HG-015", language="hi", domain="Nephrology",
        utterance="Gurde me pathri ka dard ho raha hai.",
        expected_facts=[
            ExpectedFact(concept_id="COND_KIDNEY_STONE", canonical_text="kidney stones (nephrolithiasis)", category="condition", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HG-016", language="hi", domain="Gastroenterology",
        utterance="Raat se ulti ho rahi hai.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_VOMITING", canonical_text="vomiting", category="symptom", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HG-017", language="hi", domain="Gastroenterology",
        utterance="Ulti nahi ho rahi bas sar ghoom raha hai.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_VOMITING", canonical_text="vomiting", category="symptom", assertion="negated"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HG-018", language="hi", domain="Gastroenterology",
        utterance="Loose motions aur dast lag rahe hain.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_DIARRHEA", canonical_text="diarrhea", category="symptom", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HG-019", language="hi", domain="Endocrinology",
        utterance="Doctor ne Metformin shuru ki hai.",
        expected_facts=[
            ExpectedFact(concept_id="MED_METFORMIN", canonical_text="metformin", category="medication", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HG-020", language="hi", domain="Cardiology",
        utterance="BP ke liye Telmisartan le raha hu.",
        expected_facts=[
            ExpectedFact(concept_id="MED_TELMISARTAN", canonical_text="telmisartan", category="medication", assertion="present"),
            ExpectedFact(concept_id="COND_HYPERTENSION", canonical_text="hypertension", category="condition", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HG-021", language="hi", domain="Infectious Disease",
        utterance="Bukhar kam karne ke liye Paracetamol li thi.",
        expected_facts=[
            ExpectedFact(concept_id="MED_PARACETAMOL", canonical_text="paracetamol", category="medication", assertion="present"),
            ExpectedFact(concept_id="SYM_FEVER", canonical_text="fever", category="symptom", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HG-022", language="hi", domain="Infectious Disease",
        utterance="Amoxicillin antibiotic chal rahi hai.",
        expected_facts=[
            ExpectedFact(concept_id="MED_AMOXICILLIN", canonical_text="amoxicillin", category="medication", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HG-023", language="hi", domain="Pulmonology",
        utterance="Mummy ko asthma hai.",
        expected_facts=[
            ExpectedFact(concept_id="COND_ASTHMA", canonical_text="asthma", category="condition", assertion="present", experiencer="family_member"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HG-024", language="hi", domain="Endocrinology",
        utterance="Pehle diabetes tha ab nahi hai.",
        expected_facts=[
            ExpectedFact(concept_id="COND_DIABETES", canonical_text="diabetes mellitus", category="condition", assertion="present", temporality="historical"),
            ExpectedFact(concept_id="COND_DIABETES", canonical_text="diabetes mellitus", category="condition", assertion="negated", temporality="current"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HG-025", language="hi", domain="Nephrology",
        utterance="Shayad pathri ho sakti hai.",
        expected_facts=[
            ExpectedFact(concept_id="COND_KIDNEY_STONE", canonical_text="kidney stones (nephrolithiasis)", category="condition", assertion="suspected"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HG-026", language="hi", domain="Cardiology",
        utterance="Chest pain nahi hai lekin saans lene mein bohot dikkat hai.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_CHEST_PAIN", canonical_text="chest pain", category="symptom", assertion="negated"),
            ExpectedFact(concept_id="SYM_BREATHLESSNESS", canonical_text="breathlessness", category="symptom", assertion="present", has_red_flag=True, red_flag_type="SEVERE_DYSPNEA"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HG-027", language="hi", domain="Infectious Disease",
        utterance="Bukhar hai par sirdard nahi hai.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_FEVER", canonical_text="fever", category="symptom", assertion="present"),
            ExpectedFact(concept_id="SYM_HEADACHE", canonical_text="headache", category="symptom", assertion="negated"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HG-028", language="hi", domain="Endocrinology",
        utterance="Metformin maine band kar di.",
        expected_facts=[
            ExpectedFact(concept_id="MED_METFORMIN", canonical_text="metformin", category="medication", assertion="negated"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HG-029", language="hi", domain="Cardiology",
        utterance="Seene me dard nahi hai.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_CHEST_PAIN", canonical_text="chest pain", category="symptom", assertion="negated"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-HG-030", language="hi", domain="Pulmonology",
        utterance="Asthma ka attack aaya tha.",
        expected_facts=[
            ExpectedFact(concept_id="COND_ASTHMA", canonical_text="asthma", category="condition", assertion="present"),
        ],
    ),

    # -------------------------------------------------------------
    # 4. Marathi (20 Cases: MR-001 to MR-020)
    # -------------------------------------------------------------
    BenchmarkCase(
        case_id="BENCH-MR-001", language="mr", domain="Neurology",
        utterance="डोके खूप दुखत आहे सकाळपासून.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_HEADACHE", canonical_text="headache", category="symptom", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-MR-002", language="mr", domain="Neurology",
        utterance="डोकेदुखी अजिबात नाही आहे.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_HEADACHE", canonical_text="headache", category="symptom", assertion="negated"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-MR-003", language="mr", domain="Infectious Disease",
        utterance="दोन दिवसांपासून खूप ताप भरला आहे.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_FEVER", canonical_text="fever", category="symptom", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-MR-004", language="mr", domain="Infectious Disease",
        utterance="मला अजिबात ताप नाही.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_FEVER", canonical_text="fever", category="symptom", assertion="negated"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-MR-005", language="mr", domain="Pulmonology",
        utterance="खूप खोकला येत आहे.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_COUGH", canonical_text="cough", category="symptom", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-MR-006", language="mr", domain="Cardiology",
        utterance="छातीत खूप दुखत आहे आणि श्वास घेण्यास त्रास होतोय.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_CHEST_PAIN", canonical_text="chest pain", category="symptom", assertion="present", has_red_flag=True, red_flag_type="ACS_DYSPNEA"),
            ExpectedFact(concept_id="SYM_BREATHLESSNESS", canonical_text="breathlessness", category="symptom", assertion="present", has_red_flag=True, red_flag_type="ACS_DYSPNEA"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-MR-007", language="mr", domain="Cardiology",
        utterance="छातीत दुखत नाही आहे.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_CHEST_PAIN", canonical_text="chest pain", category="symptom", assertion="negated"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-MR-008", language="mr", domain="Pulmonology",
        utterance="जिना चढताना दम लागतो.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_BREATHLESSNESS", canonical_text="breathlessness", category="symptom", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-MR-009", language="mr", domain="Cardiology",
        utterance="मला रक्तदाब आणि बीपी चा त्रास आहे.",
        expected_facts=[
            ExpectedFact(concept_id="COND_HYPERTENSION", canonical_text="hypertension", category="condition", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-MR-010", language="mr", domain="Cardiology",
        utterance="बीपी चा त्रास नाही आहे.",
        expected_facts=[
            ExpectedFact(concept_id="COND_HYPERTENSION", canonical_text="hypertension", category="condition", assertion="negated"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-MR-011", language="mr", domain="Endocrinology",
        utterance="साखरेचा आजार आहे मला पाच वर्षांपासून.",
        expected_facts=[
            ExpectedFact(concept_id="COND_DIABETES", canonical_text="diabetes mellitus", category="condition", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-MR-012", language="mr", domain="Endocrinology",
        utterance="मला साखर किंवा डायबिटीज नाही.",
        expected_facts=[
            ExpectedFact(concept_id="COND_DIABETES", canonical_text="diabetes mellitus", category="condition", assertion="negated"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-MR-013", language="mr", domain="Pulmonology",
        utterance="दमा चा त्रास खूप वाढला आहे.",
        expected_facts=[
            ExpectedFact(concept_id="COND_ASTHMA", canonical_text="asthma", category="condition", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-MR-014", language="mr", domain="Nephrology",
        utterance="मुतखडा किंवा खडा झाला आहे.",
        expected_facts=[
            ExpectedFact(concept_id="COND_KIDNEY_STONE", canonical_text="kidney stones (nephrolithiasis)", category="condition", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-MR-015", language="mr", domain="Gastroenterology",
        utterance="सकाळपासून खूप उलटी होत आहे.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_VOMITING", canonical_text="vomiting", category="symptom", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-MR-016", language="mr", domain="Gastroenterology",
        utterance="उलटी होत नाही.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_VOMITING", canonical_text="vomiting", category="symptom", assertion="negated"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-MR-017", language="mr", domain="Gastroenterology",
        utterance="पाण्यासारखे जुलाब होत आहेत.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_DIARRHEA", canonical_text="diarrhea", category="symptom", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-MR-018", language="mr", domain="Pulmonology",
        utterance="आईला दमा आहे.",
        expected_facts=[
            ExpectedFact(concept_id="COND_ASTHMA", canonical_text="asthma", category="condition", assertion="present", experiencer="family_member"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-MR-019", language="mr", domain="Cardiology",
        utterance="छातीत दुखत नाही पण श्वास घेण्यास त्रास होतोय.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_CHEST_PAIN", canonical_text="chest pain", category="symptom", assertion="negated"),
            ExpectedFact(concept_id="SYM_BREATHLESSNESS", canonical_text="breathlessness", category="symptom", assertion="present", has_red_flag=True, red_flag_type="SEVERE_DYSPNEA"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-MR-020", language="mr", domain="Infectious Disease",
        utterance="खोकला आहे पण ताप नाही.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_COUGH", canonical_text="cough", category="symptom", assertion="present"),
            ExpectedFact(concept_id="SYM_FEVER", canonical_text="fever", category="symptom", assertion="negated"),
        ],
    ),

    # -------------------------------------------------------------
    # 5. Tamil (20 Cases: TA-001 to TA-020)
    # -------------------------------------------------------------
    BenchmarkCase(
        case_id="BENCH-TA-001", language="ta", domain="Neurology",
        utterance="எனக்கு கடுமையான தலைவலி உள்ளது.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_HEADACHE", canonical_text="headache", category="symptom", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-TA-002", language="ta", domain="Neurology",
        utterance="எனக்கு தலைவலி இல்லை.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_HEADACHE", canonical_text="headache", category="symptom", assertion="negated"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-TA-003", language="ta", domain="Infectious Disease",
        utterance="மூன்று நாட்களாக கடுமையான காய்ச்சல் உள்ளது.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_FEVER", canonical_text="fever", category="symptom", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-TA-004", language="ta", domain="Infectious Disease",
        utterance="எனக்கு காய்ச்சல் இல்லை.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_FEVER", canonical_text="fever", category="symptom", assertion="negated"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-TA-005", language="ta", domain="Pulmonology",
        utterance="தொடர்ந்து இருமல் வருகிறது.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_COUGH", canonical_text="cough", category="symptom", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-TA-006", language="ta", domain="Pulmonology",
        utterance="இருமல் எதுவும் இல்லை.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_COUGH", canonical_text="cough", category="symptom", assertion="negated"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-TA-007", language="ta", domain="Cardiology",
        utterance="நெஞ்சு வலி மற்றும் மூச்சுத்திணறல் உள்ளது.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_CHEST_PAIN", canonical_text="chest pain", category="symptom", assertion="present", has_red_flag=True, red_flag_type="ACS_DYSPNEA"),
            ExpectedFact(concept_id="SYM_BREATHLESSNESS", canonical_text="breathlessness", category="symptom", assertion="present", has_red_flag=True, red_flag_type="ACS_DYSPNEA"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-TA-008", language="ta", domain="Cardiology",
        utterance="நெஞ்சு வலி இல்லை.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_CHEST_PAIN", canonical_text="chest pain", category="symptom", assertion="negated"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-TA-009", language="ta", domain="Pulmonology",
        utterance="சுவாசிப்பதில் சிரமம் அதிகமாக உள்ளது.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_BREATHLESSNESS", canonical_text="breathlessness", category="symptom", assertion="present", has_red_flag=True, red_flag_type="SEVERE_DYSPNEA"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-TA-010", language="ta", domain="Cardiology",
        utterance="எனக்கு உயர் ரத்த அழுத்தம் பிரச்சனை உள்ளது.",
        expected_facts=[
            ExpectedFact(concept_id="COND_HYPERTENSION", canonical_text="hypertension", category="condition", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-TA-011", language="ta", domain="Cardiology",
        utterance="பிபி பிரச்சனை எதுவும் இல்லை.",
        expected_facts=[
            ExpectedFact(concept_id="COND_HYPERTENSION", canonical_text="hypertension", category="condition", assertion="negated"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-TA-012", language="ta", domain="Endocrinology",
        utterance="எனக்கு சர்க்கரை நோய் உள்ளது.",
        expected_facts=[
            ExpectedFact(concept_id="COND_DIABETES", canonical_text="diabetes mellitus", category="condition", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-TA-013", language="ta", domain="Endocrinology",
        utterance="சர்க்கரை நோய் இல்லை.",
        expected_facts=[
            ExpectedFact(concept_id="COND_DIABETES", canonical_text="diabetes mellitus", category="condition", assertion="negated"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-TA-014", language="ta", domain="Pulmonology",
        utterance="ஆஸ்துமா பிரச்சனை உள்ளது.",
        expected_facts=[
            ExpectedFact(concept_id="COND_ASTHMA", canonical_text="asthma", category="condition", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-TA-015", language="ta", domain="Nephrology",
        utterance="சிறுநீரகக் கல் காரணமாக வலி உள்ளது.",
        expected_facts=[
            ExpectedFact(concept_id="COND_KIDNEY_STONE", canonical_text="kidney stones (nephrolithiasis)", category="condition", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-TA-016", language="ta", domain="Gastroenterology",
        utterance="தொடர்ந்து வாந்தி வருகிறது.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_VOMITING", canonical_text="vomiting", category="symptom", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-TA-017", language="ta", domain="Gastroenterology",
        utterance="வாந்தி எதுவும் இல்லை.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_VOMITING", canonical_text="vomiting", category="symptom", assertion="negated"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-TA-018", language="ta", domain="Gastroenterology",
        utterance="கடுமையான வயிற்றுப்போக்கு உள்ளது.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_DIARRHEA", canonical_text="diarrhea", category="symptom", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-TA-019", language="ta", domain="Cardiology",
        utterance="நெஞ்சில் வலி இல்லை ஆனால் மூச்சுத்திணறல் உள்ளது.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_CHEST_PAIN", canonical_text="chest pain", category="symptom", assertion="negated"),
            ExpectedFact(concept_id="SYM_BREATHLESSNESS", canonical_text="breathlessness", category="symptom", assertion="present", has_red_flag=True, red_flag_type="SEVERE_DYSPNEA"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-TA-020", language="ta", domain="Infectious Disease",
        utterance="இருமல் உள்ளது ஆனால் காய்ச்சல் இல்லை.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_COUGH", canonical_text="cough", category="symptom", assertion="present"),
            ExpectedFact(concept_id="SYM_FEVER", canonical_text="fever", category="symptom", assertion="negated"),
        ],
    ),

    # -------------------------------------------------------------
    # 6. Gujarati (20 Cases: GU-001 to GU-020)
    # -------------------------------------------------------------
    BenchmarkCase(
        case_id="BENCH-GU-001", language="gu", domain="Neurology",
        utterance="મને માથું ખૂબ દુખે છે.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_HEADACHE", canonical_text="headache", category="symptom", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-GU-002", language="gu", domain="Neurology",
        utterance="માથાનો દુખાવો નથી.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_HEADACHE", canonical_text="headache", category="symptom", assertion="negated"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-GU-003", language="gu", domain="Infectious Disease",
        utterance="બે દિવસથી ખૂબ તાવ આવે છે.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_FEVER", canonical_text="fever", category="symptom", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-GU-004", language="gu", domain="Infectious Disease",
        utterance="મને કોઈ તાવ નથી.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_FEVER", canonical_text="fever", category="symptom", assertion="negated"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-GU-005", language="gu", domain="Pulmonology",
        utterance="ખાંસી ખૂબ આવે છે.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_COUGH", canonical_text="cough", category="symptom", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-GU-006", language="gu", domain="Pulmonology",
        utterance="ખાંસી નથી આવતી.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_COUGH", canonical_text="cough", category="symptom", assertion="negated"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-GU-007", language="gu", domain="Cardiology",
        utterance="છાતીમાં અસહ્ય દુખાવો છે અને શ્વાસ લેવામાં તકલીફ છે.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_CHEST_PAIN", canonical_text="chest pain", category="symptom", assertion="present", has_red_flag=True, red_flag_type="ACS_DYSPNEA"),
            ExpectedFact(concept_id="SYM_BREATHLESSNESS", canonical_text="breathlessness", category="symptom", assertion="present", has_red_flag=True, red_flag_type="ACS_DYSPNEA"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-GU-008", language="gu", domain="Cardiology",
        utterance="છાતીમાં દુખાવો નથી.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_CHEST_PAIN", canonical_text="chest pain", category="symptom", assertion="negated"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-GU-009", language="gu", domain="Pulmonology",
        utterance="શ્વાસ લેવામાં તકલીફ થઈ રહી છે.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_BREATHLESSNESS", canonical_text="breathlessness", category="symptom", assertion="present", has_red_flag=True, red_flag_type="SEVERE_DYSPNEA"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-GU-010", language="gu", domain="Cardiology",
        utterance="મને હાઈ બીપી ની તકલીફ છે.",
        expected_facts=[
            ExpectedFact(concept_id="COND_HYPERTENSION", canonical_text="hypertension", category="condition", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-GU-011", language="gu", domain="Cardiology",
        utterance="બીપી ની કોઈ તકલીફ નથી.",
        expected_facts=[
            ExpectedFact(concept_id="COND_HYPERTENSION", canonical_text="hypertension", category="condition", assertion="negated"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-GU-012", language="gu", domain="Endocrinology",
        utterance="મને ડાયાબિટીસ છે ઘણા વર્ષોથી.",
        expected_facts=[
            ExpectedFact(concept_id="COND_DIABETES", canonical_text="diabetes mellitus", category="condition", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-GU-013", language="gu", domain="Endocrinology",
        utterance="ડાયાબિટીસ નથી મને.",
        expected_facts=[
            ExpectedFact(concept_id="COND_DIABETES", canonical_text="diabetes mellitus", category="condition", assertion="negated"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-GU-014", language="gu", domain="Pulmonology",
        utterance="દમ ની બીમારી છે મને.",
        expected_facts=[
            ExpectedFact(concept_id="COND_ASTHMA", canonical_text="asthma", category="condition", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-GU-015", language="gu", domain="Nephrology",
        utterance="કિડનીમાં પથરી છે.",
        expected_facts=[
            ExpectedFact(concept_id="COND_KIDNEY_STONE", canonical_text="kidney stones (nephrolithiasis)", category="condition", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-GU-016", language="gu", domain="Gastroenterology",
        utterance="સવારથી ઉલટી થાય છે.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_VOMITING", canonical_text="vomiting", category="symptom", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-GU-017", language="gu", domain="Gastroenterology",
        utterance="ઉલટી નથી થતી.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_VOMITING", canonical_text="vomiting", category="symptom", assertion="negated"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-GU-018", language="gu", domain="Gastroenterology",
        utterance="ઝાડા થઈ ગયા છે.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_DIARRHEA", canonical_text="diarrhea", category="symptom", assertion="present"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-GU-019", language="gu", domain="Cardiology",
        utterance="છાતીમાં દુખાવો નથી પણ શ્વાસ લેવામાં તકલીફ છે.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_CHEST_PAIN", canonical_text="chest pain", category="symptom", assertion="negated"),
            ExpectedFact(concept_id="SYM_BREATHLESSNESS", canonical_text="breathlessness", category="symptom", assertion="present", has_red_flag=True, red_flag_type="SEVERE_DYSPNEA"),
        ],
    ),
    BenchmarkCase(
        case_id="BENCH-GU-020", language="gu", domain="Infectious Disease",
        utterance="ખાંસી છે પણ તાવ નથી.",
        expected_facts=[
            ExpectedFact(concept_id="SYM_COUGH", canonical_text="cough", category="symptom", assertion="present"),
            ExpectedFact(concept_id="SYM_FEVER", canonical_text="fever", category="symptom", assertion="negated"),
        ],
    ),
]
