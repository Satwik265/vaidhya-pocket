import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

// Middleware for JSON body parsing (increase limit for audio uploads)
app.use(express.json({ limit: '50mb' }));

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'MedScribe Lite' });
});

// SOAP Note Generation API endpoint
app.post('/api/speech/transcribe', (_req, res) => {
  // Sovereign mode: no cloud speech. On-device ASR (sherpa-onnx / IndicConformer INT8) is the Finale build.
  res.status(410).json({ error: 'cloud_disabled_sovereign_mode', message: 'Use on-device ASR.' });
});

app.post('/api/medscribe/generate', (_req, res) => {
  // Sovereign mode: cloud SOAP generation removed. SOAP drafts are produced on-device by
  // src/utils/offlineLocalEngine.ts, optionally via the evidence-gated local LLM (src/llm/).
  res.status(410).json({ error: 'cloud_disabled_sovereign_mode', message: 'Use on-device SOAP engine.' });
});

// Helper for deterministic SOCRATES fallback when offline or on API timeout
function getSocratesFallback(
  turnCount: number,
  language: string = 'en',
  previousAnswer: string = ''
) {
  const isSpanish = language === 'es';

  // Check for immediate red-flag words in previous answer
  const lowerAns = previousAnswer.toLowerCase();
  const redFlags: string[] = [];
  let triagePriority: 'routine' | 'urgent' | 'emergency' = 'routine';

  if (
    lowerAns.includes('chest pain') ||
    lowerAns.includes('pecho') ||
    lowerAns.includes('crushing') ||
    lowerAns.includes('opresivo') ||
    lowerAns.includes('left arm') ||
    lowerAns.includes('brazo izquierdo') ||
    lowerAns.includes('shortness of breath') ||
    lowerAns.includes('falta de aire') ||
    lowerAns.includes('fainting') ||
    lowerAns.includes('desmayo')
  ) {
    redFlags.push('Potential Acute Cardiopulmonary Red Flag detected in symptom report');
    triagePriority = 'urgent';
  }

  if (turnCount === 0) {
    return {
      question: isSpanish
        ? '¿Cuál es el motivo principal o síntoma de su consulta el día de hoy?'
        : 'What is your main health concern or symptom bringing you in today?',
      category: 'chief_complaint',
      suggestedOptions: isSpanish
        ? [
            'Dolor o malestar en el pecho',
            'Dolor abdominal o de estómago',
            'Fiebre, escalofríos y fatiga',
            'Tos y dificultad para respirar',
            'Dolor de cabeza severo / mareos',
            'Dolor articular o de espalda',
            'Otro síntoma o consulta',
          ]
        : [
            'Chest Pain / Discomfort',
            'Abdominal / Stomach Pain',
            'Fever, Chills & Fatigue',
            'Cough & Breathing Difficulty',
            'Severe Headache / Dizziness',
            'Joint or Back Pain',
            'Other Health Concern',
          ],
      inputType: 'choice_or_voice',
      redFlags,
      triagePriority,
      isComplete: false,
    };
  }

  if (turnCount === 1) {
    return {
      question: isSpanish
        ? '¿Cuándo comenzó este malestar y fue de inicio repentino o gradual?'
        : 'When did this symptom start, and did it come on suddenly or gradually?',
      category: 'socrates_onset',
      suggestedOptions: isSpanish
        ? [
            'Comenzó de forma repentina hoy',
            'Comenzó gradualmente hace 1–3 días',
            'Lleva aproximadamente 1 semana',
            'Persistente desde hace más de 2 semanas',
            'Es un episodio recurrente crónico',
          ]
        : [
            'Started suddenly today',
            'Started gradually 1–3 days ago',
            'Persistent for about 1 week',
            'Ongoing for 2+ weeks',
            'Chronic / recurrent flare-up',
          ],
      inputType: 'choice_or_voice',
      redFlags,
      triagePriority,
      isComplete: false,
    };
  }

  if (turnCount === 2) {
    return {
      question: isSpanish
        ? '¿Cómo describiría la sensación de este dolor o malestar?'
        : 'How would you describe the character or sensation of this pain/discomfort?',
      category: 'socrates_character',
      suggestedOptions: isSpanish
        ? [
            'Punzante o agudo',
            'Sordo o continuo',
            'Opresivo o como pesadez',
            'Ardor o quemazón',
            'Pulsátil o palpitante',
            'Cólico o intermitente',
          ]
        : [
            'Sharp / Stabbing',
            'Dull / Continuous Ache',
            'Pressure / Heavy / Crushing',
            'Burning / Acidity',
            'Throbbing / Pulsing',
            'Cramping / Spasmodic',
          ],
      inputType: 'choice_or_voice',
      redFlags,
      triagePriority,
      isComplete: false,
    };
  }

  if (turnCount === 3) {
    return {
      question: isSpanish
        ? '¿El dolor o malestar se extiende o irradia hacia alguna otra parte del cuerpo?'
        : 'Does the pain or discomfort radiate or spread anywhere else in your body?',
      category: 'socrates_radiation',
      suggestedOptions: isSpanish
        ? [
            'No, permanece en un solo lugar',
            'Se irradia al brazo o hombro izquierdo',
            'Se extiende al cuello, mandíbula o garganta',
            'Se refleja hacia la espalda',
            'Se propaga hacia el abdomen o piernas',
          ]
        : [
            'No, stays in one exact spot',
            'Radiates to left arm or shoulder',
            'Spreads to neck, jaw, or throat',
            'Radiates through to the back',
            'Spreads towards abdomen or legs',
          ],
      inputType: 'choice_or_voice',
      redFlags,
      triagePriority,
      isComplete: false,
    };
  }

  if (turnCount === 4) {
    return {
      question: isSpanish
        ? 'En una escala del 1 al 10, ¿qué tan intenso o severo es su malestar en este momento?'
        : 'On a scale from 1 to 10, how severe is your pain or discomfort right now?',
      category: 'socrates_severity',
      suggestedOptions: isSpanish
        ? ['1-3 (Leve)', '4-6 (Moderado)', '7-8 (Severo)', '9-10 (Insoportable / Muy Severo)']
        : ['1-3 (Mild)', '4-6 (Moderate)', '7-8 (Severe)', '9-10 (Extremely Severe)'],
      inputType: 'scale_1_to_10',
      redFlags,
      triagePriority,
      isComplete: false,
    };
  }

  if (turnCount === 5) {
    return {
      question: isSpanish
        ? '¿Ha sentido alguno de los siguientes síntomas asociados?'
        : 'Are you experiencing any of these associated symptoms along with your main concern?',
      category: 'socrates_associated',
      suggestedOptions: isSpanish
        ? [
            'Falta de aire o dificultad para respirar',
            'Náuseas o vómitos',
            'Sudoración fría excesiva',
            'Mareos o sensación de desmayo',
            'Fiebre o escalofríos',
            'Ninguno de los anteriores',
          ]
        : [
            'Shortness of breath / Difficulty breathing',
            'Nausea or vomiting',
            'Cold sweats / Diaphoresis',
            'Dizziness or lightheadedness',
            'Fever or chills',
            'None of the above',
          ],
      inputType: 'choice_or_voice',
      redFlags,
      triagePriority,
      isComplete: false,
    };
  }

  if (turnCount === 6) {
    return {
      question: isSpanish
        ? '¿Tiene antecedentes médicos diagnosticados (como Hipertensión, Diabetes o problemas cardíacos)?'
        : 'Do you have any diagnosed medical conditions (such as Hypertension, Diabetes, or Heart disease)?',
      category: 'past_history',
      suggestedOptions: isSpanish
        ? [
            'Hipertensión arterial (Presión alta)',
            'Diabetes tipo 2 (Azúcar en sangre)',
            'Enfermedad cardíaca o infarto previo',
            'Asma o afección respiratoria crónica',
            'Problemas de tiroides o renales',
            'Sin antecedentes médicos conocidos',
          ]
        : [
            'High Blood Pressure (Hypertension)',
            'Diabetes (Type 2 / High Blood Sugar)',
            'Heart Disease / Prior Cardiac Stent',
            'Asthma / Chronic Respiratory Illness',
            'Thyroid or Kidney Disorder',
            'No known past medical conditions',
          ],
      inputType: 'choice_or_voice',
      redFlags,
      triagePriority,
      isComplete: false,
    };
  }

  // Turn 7: Medications & Allergies (Final)
  return {
    question: isSpanish
      ? '¿Toma medicamentos habitualmente o tiene alguna alergia conocida a medicamentos?'
      : 'Are you taking any daily prescription medications, or do you have any drug allergies?',
    category: 'medications_allergies',
    suggestedOptions: isSpanish
      ? [
          'Tomo medicamentos para la presión / diabetes',
          'Tomo analgésicos o antiinflamatorios',
          'Tomo anticoagulantes o aspirina diaria',
          'Alergia conocida a la Penicilina',
          'Sin medicamentos diarios ni alergias conocidas',
        ]
      : [
          'Taking daily BP or Diabetes medications',
          'Taking Painkillers / NSAIDs',
          'Taking Blood Thinners / Aspirin',
          'Known Penicillin or Sulfa allergy',
          'No daily medications or known allergies',
        ],
    inputType: 'choice_or_voice',
    redFlags,
    triagePriority,
    isComplete: true,
  };
}

// Helper for deterministic AYUSH / Ayurveda Dashavidha Pariksha fallback
function getAyushFallback(
  turnCount: number,
  language: string = 'en',
  previousAnswer: string = ''
) {
  const isSpanish = language === 'es';
  const lowerAns = previousAnswer.toLowerCase();
  const redFlags: string[] = [];
  let triagePriority: 'routine' | 'urgent' | 'emergency' = 'routine';

  if (
    lowerAns.includes('chest pain') ||
    lowerAns.includes('pecho') ||
    lowerAns.includes('breathless') ||
    lowerAns.includes('respirar') ||
    lowerAns.includes('fainting') ||
    lowerAns.includes('desmayo') ||
    lowerAns.includes('severe bleeding') ||
    lowerAns.includes('hemorragia')
  ) {
    redFlags.push('Urgent physiological red flag detected during Ayurvedic intake - Recommend immediate physician triage');
    triagePriority = 'urgent';
  }

  switch (turnCount) {
    case 0:
      return {
        question: isSpanish
          ? '¿Cuál es su motivo principal de consulta o malestar que le trae a la consulta de Ayurveda hoy?'
          : 'What is your primary health complaint or symptom bringing you to the Ayurveda (AYUSH) OPD today?',
        category: 'ayush_chief_complaint',
        suggestedOptions: isSpanish
          ? [
              'Dolor articular, rigidez o inflamación (Sandhivata / Amavata)',
              'Acidez estomacal, ardor o reflujo (Amlapitta)',
              'Dificultad digestiva, gases o distensión (Grahani / Ajirna)',
              'Tos crónica, asma o catarro (Kasa / Shwasa)',
              'Problemas de la piel, picazón o erupciones (Kushtha / Twak Roga)',
              'Estrés, insomnio, fatiga o debilidad general (Anidra / Daurbalya)',
              'Fiebre, dolor corporal o malestar (Jvara)',
            ]
          : [
              'Joint Pain, Stiffness or Swelling (Sandhivata / Amavata)',
              'Hyperacidity, Burning Sensation & Acid Reflux (Amlapitta)',
              'Indigestion, Gas, Bloating & Constipation (Grahani / Ajirna)',
              'Chronic Cough, Breathing Distress or Congestion (Kasa / Shwasa)',
              'Skin Conditions, Itching, Rashes or Acne (Kushtha / Twak Roga)',
              'Stress, Insomnia, Fatigue & General Weakness (Anidra / Daurbalya)',
              'Fever, Body Aches & Chills (Jvara)',
            ],
        inputType: 'choice_or_voice',
        redFlags,
        triagePriority,
        isComplete: false,
      };

    case 1:
      return {
        question: isSpanish
          ? 'Evaluación de Prakriti (Constitución natural): ¿Cuál de estos rasgos describe mejor su tendencia corporal y mental habitual desde siempre?'
          : 'Prakriti Assessment (Natural Constitution): Which of these descriptions best matches your lifelong bodily and mental tendencies?',
        category: 'ayush_prakriti',
        suggestedOptions: isSpanish
          ? [
              'Vata: Estructura delgada, piel seca, apetito variable, mente activa y rápida',
              'Pitta: Estructura media, cuerpo cálido, apetito fuerte, intolerancia al calor',
              'Kapha: Estructura ancha o robusta, piel suave, digestión lenta y regular, mente calmada',
              'Vata-Pitta: Delgada a media, digestión variable con tendencia a acidez y piel mixta',
              'Pitta-Kapha: Complexión fuerte, buen apetito con calor corporal y resistencia',
            ]
          : [
              'Vata: Slender frame, dry skin, variable appetite, quick active mind, light sleep',
              'Pitta: Medium frame, warm body, sharp appetite, heat intolerance, goal-oriented',
              'Kapha: Broad/sturdy build, smooth skin, slow steady digestion, calm calm temperament',
              'Vata-Pitta: Slender to medium build, variable digestion with acid tendency, warm yet sensitive',
              'Pitta-Kapha: Strong solid frame, hearty appetite, oily skin, good physical stamina',
            ],
        inputType: 'choice_or_voice',
        redFlags,
        triagePriority,
        isComplete: false,
      };

    case 2:
      return {
        question: isSpanish
          ? 'Evaluación de Vikriti (Desbalance actual): ¿Qué molestias o síntomas predominan más en su cuerpo en este momento?'
          : 'Vikriti Assessment (Current Morbidity / Imbalance): Which symptom pattern is most actively bothering you right now?',
        category: 'ayush_vikriti',
        suggestedOptions: isSpanish
          ? [
              'Agravación Vata: Dolores agudos, sequedad, gases, frialdad, ansiedad o insomnio',
              'Agravación Pitta: Sensación de ardor, acidez, calor excesivo, enrojecimiento o irritabilidad',
              'Agravación Kapha: Pesadez corporal, letargo, exceso de moco, congestión o retención',
              'Vata-Pitta: Dolor combinado con ardor o inflamación caliente en articulaciones/estómago',
              'Kapha-Vata: Rigidez matutina severa, pesadez con dolor frío y circulación lenta',
            ]
          : [
              'Vata Aggravation: Sharp shooting pain, dryness, bloating, cold sensitivity, restlessness or poor sleep',
              'Pitta Aggravation: Burning sensation, sour burping, excessive heat, inflammation, red rashes or irritability',
              'Kapha Aggravation: Heaviness, sluggishness, excessive phlegm/mucus, water retention or drowsiness',
              'Vata-Pitta: Throbbing pain accompanied by burning heat or joint inflammation',
              'Kapha-Vata: Severe morning stiffness, heavy dull aching with cold joints and sluggish bowels',
            ],
        inputType: 'choice_or_voice',
        redFlags,
        triagePriority,
        isComplete: false,
      };

    case 3:
      return {
        question: isSpanish
          ? 'Ahara Shakti & Agni (Capacidad digestiva): ¿Cómo es su fuego digestivo (Agni) y apetito diario?'
          : 'Ahara Shakti & Agni (Digestive Fire): How would you describe your daily appetite and digestive power?',
        category: 'ayush_ahara_shakti_agni',
        suggestedOptions: isSpanish
          ? [
              'Samagni: Apetito equilibrado y digestión suave a horas regulares',
              'Vishamagni: Apetito muy variable (a veces come mucho, a veces sin hambre), gases frecuentes',
              'Tikshnagni: Apetito feroz y voraz, no tolera retrasar comidas, acidez frecuente',
              'Mandagni: Apetito bajo o nulo, digestión muy pesada que tarda horas, pesadez',
            ]
          : [
              'Samagni: Balanced, predictable appetite with comfortable digestion at regular hours',
              'Vishamagni: Irregular appetite (hungry at unpredictable times), frequent gas & bloating',
              'Tikshnagni: Intense sharp hunger, cannot tolerate delayed meals, heartburn if empty stomach',
              'Mandagni: Low/sluggish appetite, feels heavy for hours after small meals, slow digestion',
            ],
        inputType: 'choice_or_voice',
        redFlags,
        triagePriority,
        isComplete: false,
      };

    case 4:
      return {
        question: isSpanish
          ? 'Kostha (Evacuación intestinal) y Dieta: ¿Cómo son sus hábitos evacuatorios y qué tipo de comida consume habitualmente?'
          : 'Kostha (Bowel Tendencies) & Ahara (Diet): How are your bowel movements and what dietary patterns do you follow?',
        category: 'ayush_kostha_ahara',
        suggestedOptions: isSpanish
          ? [
              'Krura Kostha: Estreñimiento frecuente, heces duras y secas, requiere laxantes',
              'Mridu Kostha: Evacuación rápida y fácil, tendencia a heces sueltas o blandas',
              'Madhyama Kostha: Evacuación normal regular 1-2 veces al día sin esfuerzo',
              'Dieta picante / frita frecuente con horarios irregulares de comida',
              'Dieta fría / refrigerada o comida rápida procesada con digestión pesada',
            ]
          : [
              'Krura Kostha: Tendency to hard dry stools, chronic constipation or difficulty passing',
              'Mridu Kostha: Loose or soft stools, rapid bowel evacuation (especially with milk/fruit)',
              'Madhyama Kostha: Regular, comfortable bowel movement once or twice daily',
              'Frequent spicy, fried, or sour foods with irregular meal timings',
              'Frequent cold, refrigerated, or packaged foods causing heaviness',
            ],
        inputType: 'choice_or_voice',
        redFlags,
        triagePriority,
        isComplete: false,
      };

    case 5:
      return {
        question: isSpanish
          ? 'Vihara (Estilo de vida, sueño y estrés): ¿Cómo es su calidad de descanso nocturno y nivel de esfuerzo diario?'
          : 'Vihara (Lifestyle, Sleep & Physical Habits): How is your night sleep (Nidra) and daily physical exertion routine?',
        category: 'ayush_vihara_nidra',
        suggestedOptions: isSpanish
          ? [
              'Sukha Nidra: Sueño reparador y profundo de 7-8 horas, despierta con energía',
              'Alpanidra / Anidra: Dificultad para conciliar o despertares frecuentes en la noche',
              'Ratri Jagarana: Suele acostarse muy tarde (pasada la medianoche) o turnos nocturnos',
              'Sedentario: Poca actividad física, trabajo sentado la mayor parte del día',
              'Estrés mental alto (Chinta / Shoka) con tensión en el trabajo o familia',
            ]
          : [
              'Sukha Nidra: Sound, restful continuous sleep (7–8 hours), waking up refreshed',
              'Alpanidra / Anidra: Disturbed sleep, difficulty falling asleep, or frequent night awakenings',
              'Ratri Jagarana: Late night wakefulness (past midnight) or irregular shift routines',
              'Sedentary lifestyle with minimal daily physical exercise or walking',
              'High mental stress, worry or work anxiety (Chinta / Manasika Shrama)',
            ],
        inputType: 'choice_or_voice',
        redFlags,
        triagePriority,
        isComplete: false,
      };

    case 6:
      return {
        question: isSpanish
          ? 'Sattva y Vyayama Shakti: ¿Cómo califica su resistencia al esfuerzo físico y su fortaleza mental ante dificultades?'
          : 'Sattva (Mental Resilience) & Vyayama Shakti (Stamina): How do you rate your physical endurance and psychic stamina?',
        category: 'ayush_sattva_vyayama',
        suggestedOptions: isSpanish
          ? [
              'Pravara: Alta resistencia física y mente tranquila, fuerte y resiliente ante el estrés',
              'Madhyama: Resistencia y tolerancia moderadas, se fatiga tras esfuerzo prolongado',
              'Avara: Se fatiga muy rápidamente, vulnerable a la ansiedad, baja tolerancia al dolor',
              'Buena energía física pero agotamiento mental por sobrecarga',
            ]
          : [
              'Pravara: High physical stamina and calm, resilient mental endurance under pressure',
              'Madhyama: Moderate physical work capacity and average emotional resilience',
              'Avara: Easily fatigued by light exertion, low pain threshold, prone to worry',
              'Good physical stamina but high mental exhaustion / burnout',
            ],
        inputType: 'choice_or_voice',
        redFlags,
        triagePriority,
        isComplete: false,
      };

    default:
      return {
        question: isSpanish
          ? 'Examen Dashavidha Pariksha completado. Hemos registrado su Prakriti, Vikriti, Agni, Kostha y Ahara-Vihara para el médico de Ayurveda. ¿Desea confirmar y finalizar?'
          : 'Dashavidha Pariksha intake completed. We have recorded your Prakriti, Vikriti, Agni, Kostha, Ahara-Vihara and symptom chronology for the Ayurvedic physician. Ready to complete?',
        category: 'conclusion',
        suggestedOptions: isSpanish
          ? [
              'Sí, confirmar y enviar historial al consultorio de Ayurveda',
              'Revisar resumen antes de finalizar',
            ]
          : [
              'Yes, confirm and submit intake to the Ayurveda OPD queue',
              'Review clinical summary before finishing',
            ],
        inputType: 'choice_or_voice',
        redFlags,
        triagePriority,
        isComplete: true,
      };
  }
}

// Adaptive Turn-Based Kiosk Interview API
app.post('/api/kiosk/interview-turn', (req, res) => {
  // Sovereign mode: deterministic SOCRATES / AYUSH interview only. No cloud model is called.
  const {
    language = 'en',
    department = 'Allopathic',
    clinicalDepartment,
    turns = [],
  } = req.body || {};
  const selectedDept = String(clinicalDepartment || department || 'Allopathic').toLowerCase();
  const isAyurveda = selectedDept.includes('ayurveda') || selectedDept.includes('ayush');
  const lastTurn = turns.length > 0 ? turns[turns.length - 1] : null;
  const answer = lastTurn?.answer || '';
  res.json(
    isAyurveda
      ? getAyushFallback(turns.length, language, answer)
      : getSocratesFallback(turns.length, language, answer)
  );
});

// Document extraction uses real OCR / vision inference.
// Zero-Fabrication Invariant: On failure, returns OCR_FAILED without synthetic fallbacks.


/**
 * POST /api/kiosk/extract-document
 * Disabled cloud route (sovereign mode). On-device OCR replaces it.
 */
app.post('/api/kiosk/extract-document', (_req, res) => {
  // Sovereign mode: cloud vision extraction removed. Documents are read by on-device OCR in the browser
  // (src/ocr/browserOcr.ts). Fail closed, never fabricate.
  res.status(410).json({ error: 'cloud_disabled_sovereign_mode', message: 'Use on-device OCR.' });
});

// ==========================================
// EMERGENCY TRIAGE QUEUE ENDPOINTS (Phase 6f)
// Real-time server-side tracking of critical kiosk red flags
// ==========================================

interface ServerTriageAlert {
  id: string;
  timestamp: string;
  patientName: string;
  age: number | string;
  gender: string;
  abhaId?: string;
  kioskStationId: string;
  emergencyCategory: string;
  detectedPattern: string;
  matchedKeywords: string[];
  severity: 'CRITICAL_EMERGENCY' | 'HIGH_PRIORITY';
  triageColor: 'Red' | 'Yellow';
  triggerInputText: string;
  status: 'active' | 'staff_en_route' | 'attended' | 'resolved';
  staffNotes?: string;
  actionDirectives: string[];
  acknowledgedAt?: string;
}

let activeTriageAlerts: ServerTriageAlert[] = [];

app.get('/api/triage/alerts', (req, res) => {
  res.json({
    alerts: activeTriageAlerts,
    total: activeTriageAlerts.length,
    activeCount: activeTriageAlerts.filter((a) => a.status === 'active').length,
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/triage/alerts', (req, res) => {
  const alert: ServerTriageAlert = req.body;
  if (!alert || !alert.id) {
    return res.status(400).json({ error: 'Valid alert payload required' });
  }

  // Deduplicate if alert from same kiosk/patient with same pattern is already active
  const existingIdx = activeTriageAlerts.findIndex(
    (a) =>
      a.id === alert.id ||
      (a.kioskStationId === alert.kioskStationId &&
        a.detectedPattern === alert.detectedPattern &&
        a.status === 'active')
  );

  if (existingIdx >= 0) {
    activeTriageAlerts[existingIdx] = {
      ...activeTriageAlerts[existingIdx],
      ...alert,
      triggerInputText: alert.triggerInputText || activeTriageAlerts[existingIdx].triggerInputText,
    };
    return res.json({ success: true, alert: activeTriageAlerts[existingIdx], updated: true });
  }

  activeTriageAlerts.unshift(alert);
  if (activeTriageAlerts.length > 100) {
    activeTriageAlerts = activeTriageAlerts.slice(0, 100);
  }

  res.status(201).json({ success: true, alert, created: true });
});

app.patch('/api/triage/alerts/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const alertIndex = activeTriageAlerts.findIndex((a) => a.id === id);

  if (alertIndex === -1) {
    return res.status(404).json({ error: 'Alert not found' });
  }

  activeTriageAlerts[alertIndex] = {
    ...activeTriageAlerts[alertIndex],
    ...updates,
    acknowledgedAt:
      updates.status && updates.status !== 'active'
        ? new Date().toISOString()
        : activeTriageAlerts[alertIndex].acknowledgedAt,
  };

  res.json({ success: true, alert: activeTriageAlerts[alertIndex] });
});

app.delete('/api/triage/alerts', (req, res) => {
  activeTriageAlerts = [];
  res.json({ success: true, message: 'All triage alerts cleared' });
});

// ==========================================
// MOCKED ABDM / HOSPITAL INFORMATION SYSTEM (HIS) FHIR PUSH ENDPOINT
// SIH 26047 Evaluation Sandbox (Simulated Gateway)
// ==========================================
interface ABDMPushRecord {
  transactionId: string;
  timestamp: string;
  status: 'ACCEPTED_BY_HIS' | 'QUEUED_FOR_CONSULTATION';
  mockGateway: string;
  disclaimer: string;
  kioskStationId: string;
  patientName: string;
  abhaId?: string;
  age?: number | string;
  gender?: string;
  department: string;
  chiefComplaint: string;
  bundleId: string;
  resourceCounts: {
    Patient: number;
    Encounter: number;
    Condition: number;
    MedicationRequest: number;
    Composition: number;
    DiagnosticReport?: number;
    Observation?: number;
  };
  fhirBundle: any;
  structuredSummary?: any;
}

let abdmConsultationQueue: ABDMPushRecord[] = [];

// POST /api/abdm/push
app.post('/api/abdm/push', (req, res) => {
  const { fhirBundle, patientInfo, abhaId, department, kioskStationId = 'KIOSK-TER-01', structuredSummary } = req.body;

  if (!fhirBundle || !fhirBundle.entry) {
    return res.status(400).json({ error: 'Valid HL7 FHIR R4 Bundle required.' });
  }

  const txId = `ABDM-MOCK-TX-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const counts: Record<string, number> = {};
  (fhirBundle.entry || []).forEach((e: any) => {
    const rt = e.resource?.resourceType || 'Resource';
    counts[rt] = (counts[rt] || 0) + 1;
  });

  const record: ABDMPushRecord = {
    transactionId: txId,
    timestamp: new Date().toISOString(),
    status: 'ACCEPTED_BY_HIS',
    mockGateway: 'National Health Stack / ABDM Health Information Exchange (Mock Sandbox Gateway)',
    disclaimer: 'Simulated ABDM/HIS gateway for Smart India Hackathon 26047 testing. No live NHA ABDM production credentials claimed.',
    kioskStationId,
    patientName: patientInfo?.name || 'Anonymous Patient',
    abhaId: abhaId || patientInfo?.id || '91-8765-4321-0987',
    age: patientInfo?.age,
    gender: patientInfo?.gender || patientInfo?.sex,
    department: department || 'General Medicine (OPD)',
    chiefComplaint: structuredSummary?.sections?.chiefComplaint || patientInfo?.medicalHistory || 'Outpatient Consultation',
    bundleId: fhirBundle.id || `bundle-${Date.now()}`,
    resourceCounts: {
      Patient: counts['Patient'] || 1,
      Encounter: counts['Encounter'] || 1,
      Condition: counts['Condition'] || 0,
      MedicationRequest: counts['MedicationRequest'] || 0,
      Composition: counts['Composition'] || 1,
      DiagnosticReport: counts['DiagnosticReport'] || 0,
      Observation: counts['Observation'] || 0,
    },
    fhirBundle,
    structuredSummary,
  };

  abdmConsultationQueue.unshift(record);
  if (abdmConsultationQueue.length > 50) {
    abdmConsultationQueue = abdmConsultationQueue.slice(0, 50);
  }

  res.status(201).json({
    success: true,
    record,
    transactionId: txId,
    message: 'FHIR R4 Bundle pushed successfully to Mock ABDM / Hospital Information System gateway.',
  });
});

// GET /api/abdm/queue
app.get('/api/abdm/queue', (req, res) => {
  res.json({
    success: true,
    totalQueued: abdmConsultationQueue.length,
    records: abdmConsultationQueue,
  });
});


async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MedScribe Lite server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
