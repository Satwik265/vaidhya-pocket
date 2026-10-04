export interface DrugInteractionRule {
  id: string;
  drugA: string; // Medication name or keywords (case-insensitive)
  drugB: string; // Medication or condition keywords (case-insensitive)
  type: 'drug-drug' | 'drug-condition';
  severity: 'high' | 'medium' | 'low';
  title: string;
  mechanism: string;
  recommendation: string;
}

export const DRUG_INTERACTION_DATABASE: DrugInteractionRule[] = [
  {
    id: 'nsaid-antihypertensive',
    drugA: 'ibuprofen|diclofenac|naproxen|indomethacin|meloxicam',
    drugB: 'amlodipine|lisinopril|enalapril|losartan|valsartan|hydrochlorothiazide|atenolol',
    type: 'drug-drug',
    severity: 'high',
    title: 'NSAID + Antihypertensive Interaction',
    mechanism: 'NSAIDs inhibit renal prostaglandins, causing sodium and water retention and blunting the blood pressure-lowering effect of antihypertensive medications.',
    recommendation: 'Discontinue regular daily NSAID use. Consider Paracetamol for analgesia and monitor blood pressure.',
  },
  {
    id: 'nsaid-ckd',
    drugA: 'ibuprofen|diclofenac|naproxen|indomethacin|meloxicam|ketorolac',
    drugB: 'renal|kidney|ckd|nephropathy|creatinine',
    type: 'drug-condition',
    severity: 'high',
    title: 'NSAID Use in Renal Impairment / CKD',
    mechanism: 'NSAIDs decrease renal blood flow via afferent arteriolar constriction, accelerating renal function decline in patients with baseline kidney dysfunction.',
    recommendation: 'Avoid NSAIDs in patients with renal impairment. Utilize non-pharmacological therapies or short-course Paracetamol.',
  },
  {
    id: 'metformin-ckd',
    drugA: 'metformin',
    drugB: 'renal|kidney|ckd|creatinine|eGFR',
    type: 'drug-condition',
    severity: 'high',
    title: 'Metformin Risk in Renal Dysfunction',
    mechanism: 'Decreased renal clearance of metformin increases the risk of fatal Lactic Acidosis.',
    recommendation: 'Check eGFR/serum creatinine before prescribing. Dose adjustment required if eGFR < 45 mL/min; discontinue if eGFR < 30 mL/min.',
  },
  {
    id: 'ace-arb-potassium',
    drugA: 'lisinopril|enalapril|ramipril|losartan|valsartan|candesartan',
    drugB: 'spironolactone|eplerenone|potassium',
    type: 'drug-drug',
    severity: 'high',
    title: 'Hyperkalemia Risk with Renin-Angiotensin Blockers',
    mechanism: 'Concomitant use decreases aldosterone secretion, leading to severe potassium retention.',
    recommendation: 'Monitor serum potassium levels closely within 1-2 weeks of initiating therapy.',
  },
  {
    id: 'artemether-qt',
    drugA: 'artemether|coartem|lumefantrine',
    drugB: 'ciprofloxacin|erythromycin|haloperidol|quinine|fluconazole',
    type: 'drug-drug',
    severity: 'medium',
    title: 'QT Interval Prolongation Risk with Antimalarial',
    mechanism: 'Additive effects on cardiac repolarization (QTc prolongation) increase risk of ventricular dysrhythmias.',
    recommendation: 'Avoid concomitant administration with QTc-prolonging antimicrobials unless electrocardiographic monitoring is available.',
  },
  {
    id: 'amoxicillin-allopurinol',
    drugA: 'amoxicillin|ampicillin',
    drugB: 'allopurinol',
    type: 'drug-drug',
    severity: 'medium',
    title: 'Increased Risk of Cutaneous Rash',
    mechanism: 'Concomitant allopurinol significantly increases the incidence of maculopapular drug eruptions.',
    recommendation: 'Educate patient regarding skin hypersensitivity signs. Consider alternative antibiotic if gout therapy is essential.',
  },
  {
    id: 'warfarin-nsaid',
    drugA: 'warfarin',
    drugB: 'ibuprofen|diclofenac|aspirin|naproxen',
    type: 'drug-drug',
    severity: 'high',
    title: 'Severe Gastrointestinal Hemorrhage Risk',
    mechanism: 'Combined antiplatelet/anticoagulant effects with gastric mucosal injury drastically elevate bleeding hazards.',
    recommendation: 'Avoid concurrent use. Use Paracetamol for pain control and verify INR levels.',
  },
  {
    id: 'ciprofloxacin-antacid',
    drugA: 'ciprofloxacin|levofloxacin',
    drugB: 'antacid|calcium|magnesium|aluminum|iron|zinc',
    type: 'drug-drug',
    severity: 'medium',
    title: 'Fluoroquinolone Chelation & Reduced Absorption',
    mechanism: 'Multivalent cations chelate fluoroquinolones in the GI tract, causing up to 90% reduction in antibiotic bioavailability.',
    recommendation: 'Administer fluoroquinolone at least 2 hours before or 6 hours after cation-containing antacids/supplements.',
  },
  {
    id: 'paracetamol-curated',
    drugA: 'paracetamol|acetaminophen',
    drugB: 'alcohol|liver|hepatic|cirrhosis',
    type: 'drug-condition',
    severity: 'medium',
    title: 'Paracetamol / Acetaminophen Hepatic Precautions',
    mechanism: 'High doses or chronic alcohol co-ingestion depletes glutathione, increasing toxic NAPQI metabolite formation.',
    recommendation: 'Do not exceed 4,000mg/24h. Exercise caution in severe hepatic impairment or chronic alcoholism.',
  },
];
