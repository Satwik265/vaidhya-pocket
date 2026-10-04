import { SampleScenario } from '../types';

export const SAMPLE_SCENARIOS: SampleScenario[] = [
  {
    id: 'malaria-fever',
    title: 'Acute Febrile Illness / Suspected Malaria',
    category: 'Infectious Disease',
    description: 'Rural primary care visit for high fever, rigors, headache, and fatigue in an endemic area.',
    patientInfo: {
      name: 'Kwame Mensah',
      age: 28,
      sex: 'Male',
      medicalHistory: 'No chronic illness. Prior episode of malaria 2 years ago treated with AL.',
      currentMedications: 'Paracetamol 500mg as needed for fever',
      knownAllergies: 'NKDA (No Known Drug Allergies)',
      encounterType: 'Acute Unscheduled Visit',
      clinicLocation: 'Sub-District Health Center'
    },
    transcript: `Doctor: Good morning Kwame, come in and sit down. What brings you to the clinic today?
Patient: Morning doctor. I've been feeling very unwell for the past 3 days. I started having intense chills and shivering on Tuesday evening, followed by high fever and severe headache.
Doctor: I see. Have you noticed any other symptoms? Nausea, vomiting, joint body aches, or abdominal pain?
Patient: Yes, my whole body aches, especially my joints and back. I felt nauseous yesterday and vomited once after breakfast. I couldn't eat much today.
Doctor: Any cough, chest pain, difficulty breathing, or neck stiffness?
Patient: No cough or chest pain. My neck is fine, just a very heavy headache behind my eyes.
Doctor: Okay. Have you been sleeping under an insecticide-treated bed net consistently?
Patient: Mostly yes, but I traveled to my family's farm last week and forgot my net for two nights.
Doctor: Alright. Let's do a physical examination. I will check your vitals first. Temperature is 38.9°C, blood pressure is 118/76 mmHg, heart rate is 104 beats per minute, respiratory rate is 18, and oxygen saturation is 98% on room air.
Doctor: On examination, eyes show mild conjunctival pallor, no jaundice. Chest is clear on auscultation. Abdomen is soft, non-tender, but I can feel mild splenomegaly about 2cm below the left costal margin. No neck stiffness or rash.
Doctor: We will do a Malaria Rapid Diagnostic Test (mRDT) and a hemoglobin check right away.
Patient: Doctor, the nurse took the finger prick blood test earlier.
Doctor: Perfect. Let me read the result: mRDT is positive for Plasmodium falciparum. Hemoglobin level is 10.2 g/dL, which indicates mild anemia.
Doctor: So you have uncomplicated Plasmodium falciparum malaria. We will start you on Artemether-Lumefantrine (Coartem) 80/480mg, taken twice daily for 3 days. Take each dose with a fatty meal or milk so it absorbs properly. I'll also give you Paracetamol 1000mg three times a day for fever and body aches. Drink plenty of clean ORS or boiled water.
Patient: Thank you doctor. Should I come back?
Doctor: Yes, if your fever doesn't come down after 48 hours, or if you start vomiting repeatedly, feel unusually weak, or pass dark urine, come back immediately. Otherwise, review in 1 week if not fully recovered.`
  },
  {
    id: 'hypertension-diabetes',
    title: 'Uncontrolled Hypertension & Type 2 Diabetes',
    category: 'Chronic Care',
    description: 'Routine follow-up for hypertension and diabetes with elevated blood pressure and medication adherence check.',
    patientInfo: {
      name: 'Maria Santos',
      age: 54,
      sex: 'Female',
      medicalHistory: 'Type 2 Diabetes Mellitus (8 yrs), Essential Hypertension (5 yrs), Mild Osteoarthritis',
      currentMedications: 'Metformin 500mg BD, Amlodipine 5mg OD, Ibuprofen 400mg PRN for knee pain',
      knownAllergies: 'ACE Inhibitors (causes severe dry cough)',
      encounterType: 'Routine Chronic Disease Follow-up',
      clinicLocation: 'Community Primary Clinic'
    },
    transcript: `Doctor: Hello Maria, good to see you again. How have you been feeling since our last visit two months ago?
Patient: Good morning Doctor. Overall I feel okay, but I've been having mild morning headaches at the back of my head for the past two weeks, and sometimes my feet feel a little swollen in the evening.
Doctor: Thanks for letting me know. Are you taking your medications regularly every day?
Patient: To be honest doctor, I ran out of Amlodipine about 3 weeks ago because I couldn't make the trip to the central pharmacy, so I've only been taking the Metformin. Also, my knees were hurting so I took Ibuprofen almost daily last week.
Doctor: I understand. Taking NSAIDs like Ibuprofen daily can raise your blood pressure and strain your kidneys, so we need to be careful with that. Let's check your vitals now.
Doctor: Blood pressure is elevated today at 158/96 mmHg. Heart rate is 78 bpm. Weight is 74 kg.
Doctor: Physical exam shows mild +1 bilateral pedal edema up to the ankles. Heart sounds S1 and S2 present, no murmurs. Lungs clear to auscultation bilaterally. Fasting capillary blood glucose taken by nurse this morning was 8.6 mmol/L (155 mg/dL).
Doctor: Urine dipstick shows negative for protein and glucose today.
Doctor: Maria, your blood pressure is high today because you ran out of Amlodipine and took frequent Ibuprofen. We need to resume your blood pressure medicine immediately. We will increase Amlodipine to 10mg once daily to better control your BP. We'll continue Metformin 500mg twice daily with meals.
Doctor: For knee pain, please stop daily Ibuprofen. Use Paracetamol 500mg as needed instead, and try warm compresses. I will also refer you to our community health worker to help arrange local pharmacy refill delivery so you don't run out.
Patient: That would be so helpful doctor. When should I check my blood pressure again?
Doctor: Please visit the clinic nurse next week for a quick BP check, and see me in 4 weeks for repeat blood pressure, fasting blood glucose, and renal function test.`
  },
  {
    id: 'pediatric-urti',
    title: 'Pediatric Cough & Fever (Otitis Media)',
    category: 'Pediatrics',
    description: 'Mother brings 4-year-old child with 2-day fever, ear pulling, and runny nose.',
    patientInfo: {
      name: 'Liam O\'Connor (Mother: Sarah)',
      age: 4,
      sex: 'Male',
      medicalHistory: 'Fully immunized for age. No prior hospitalizations.',
      currentMedications: 'Children\'s Paracetamol syrup given twice yesterday',
      knownAllergies: 'NKDA',
      encounterType: 'Acute Pediatric Walk-in',
      clinicLocation: 'Maternal & Child Health Wing'
    },
    transcript: `Doctor: Hello Sarah, welcome. I see you brought little Liam today. What's been going on?
Mother: Doctor, Liam developed a fever two nights ago. He has a runny nose and woke up crying last night pulling at his right ear. He refused to eat his breakfast this morning.
Doctor: Poor little guy. Has he had any difficulty breathing, fast breathing, noisy wheezing, or stridor?
Mother: No fast breathing or wheezing, just congestion and ear pain.
Doctor: Has he had any vomiting, diarrhea, or rash?
Mother: No vomiting or diarrhea. He drank some apple juice earlier.
Doctor: Good. Let's examine Liam. Vitals: Temperature is 38.3°C, Heart rate is 110 bpm, Respiratory rate is 24 breaths/min (normal for age), Oxygen saturation 99% on room air. Weight is 16 kg.
Doctor: On physical exam: Child is alert, sitting on mother's lap, mild clear nasal discharge. Throat is mildly erythematous, tonsils 1+, no exudate. Otoscopy reveals right tympanic membrane is bulging, erythematous, with loss of landmarks. Left tympanic membrane is clear and translucent. Lungs clear bilaterally with good air entry, no chest indrawing or retractions. Abdomen soft and non-tender.
Doctor: Liam has Acute Right Otitis Media (middle ear infection) along with a viral upper respiratory infection.
Doctor: Because of his age, fever, and bulging ear drum, we will prescribe Amoxicillin oral suspension 400mg/5ml, 5ml (400mg) twice daily for 7 days. Give him Paracetamol syrup 250mg/5ml, 5ml every 6 hours as needed for pain and fever. Keep him well hydrated with water and soups.
Mother: Thank you doctor. When should I bring him back?
Doctor: Return immediately if he develops difficulty breathing, extreme lethargy, persistent vomiting, or if ear pain and fever persist after 48 hours of antibiotics.`
  },
  {
    id: 'antenatal-check',
    title: 'Routine Antenatal Care (2nd Trimester)',
    category: 'Maternal Care',
    description: 'Routine 24-week prenatal visit with routine blood test review showing mild gestational anemia.',
    patientInfo: {
      name: 'Amina Yusuf',
      age: 26,
      sex: 'Female',
      medicalHistory: 'G2P1L1, 24 weeks gestation by LMP. Normal spontaneous vaginal delivery 3 yrs ago.',
      currentMedications: 'Prenatal Multivitamin, Folic Acid 5mg daily',
      knownAllergies: 'NKDA',
      encounterType: 'Antenatal Consultation',
      clinicLocation: 'MCH Outreach Clinic'
    },
    transcript: `Doctor: Good morning Amina. Welcome to your 24-week antenatal checkup. How are you feeling, and are you feeling good baby movements?
Patient: Morning doctor. Yes, the baby is kicking very actively, especially in the evening! But I feel a bit more tired than usual in the afternoon.
Doctor: That's great about the baby movements. Any headache, vision changes, abdominal pain, vaginal bleeding, or fluid leaking?
Patient: No headache, no bleeding, no fluid leaking.
Doctor: Excellent. Let's check your vitals and examination.
Doctor: Blood pressure is 112/70 mmHg, pulse is 76 bpm, weight is 62 kg (gained 2 kg over last 4 weeks).
Doctor: Examination: Mild conjunctival paleness. Fundal height corresponds to 24 weeks gestation. Fetal heart rate is 142 beats per minute, regular rhythm using Doppler. No pedal edema. Urine dipstick: Protein negative, Glucose negative.
Doctor: Let's review your second trimester lab panel: Hemoglobin is 10.1 g/dL (mild anemia of pregnancy). Blood group O positive, Syphilis (VDRL) non-reactive, HIV rapid screening negative, Blood sugar 1-hour post 50g glucose loading is 6.2 mmol/L (normal, rules out gestational diabetes).
Doctor: Amina, baby is growing well and your blood pressure is normal. You have mild gestational iron-deficiency anemia, which is very common around 24 weeks. We will add Ferrous Sulfate 200mg (60mg elemental iron) taken once daily with orange juice or water on an empty stomach. Continue your Folic acid and prenatal vitamin.
Doctor: Also eat iron-rich foods like dark leafy greens, beans, and lean meats. Avoid drinking tea or coffee directly with your iron tablet because it reduces iron absorption.
Patient: Thank you doctor! When is my next visit?
Doctor: Return in 4 weeks at 28 weeks for your routine checkup, Tetanus toxoid booster, and repeat Hb check.`
  },
  {
    id: 'gastroenteritis-dehydration',
    title: 'Acute Gastroenteritis with Mild Dehydration',
    category: 'Gastrointestinal',
    description: 'Adult presenting with 1-day watery diarrhea and cramps after eating local street food.',
    patientInfo: {
      name: 'Rajesh Kumar',
      age: 32,
      sex: 'Male',
      medicalHistory: 'No known underlying medical conditions.',
      currentMedications: 'None',
      knownAllergies: 'NKDA',
      encounterType: 'Acute Walk-in Visit',
      clinicLocation: 'Primary Care Outpatient Clinic'
    },
    transcript: `Doctor: Hello Rajesh. What brings you to the clinic today?
Patient: Doctor, I started having frequent loose watery stools yesterday midnight. I've been to the toilet about 6 times since morning. I also have abdominal cramping and mild nausea.
Doctor: Any blood or mucus in the stool? High fever or severe vomiting?
Patient: No blood, just clear watery stool. I vomited once yesterday night after dinner, but today I've been able to sip some tea without vomiting. No high fever.
Doctor: Did you eat anything unusual recently?
Patient: I ate spicy street food from a roadside stall yesterday afternoon.
Doctor: I see. Let's do an examination. Vitals: Blood pressure 110/72 mmHg, Heart rate 92 bpm, Temperature 37.4°C, Respiratory rate 16, O2 sat 99%.
Doctor: Physical exam: Mucous membranes are slightly dry, skin turgor is normal with immediate recoil. Abdomen is soft, hyperactive bowel sounds in all four quadrants, mild diffuse tenderness on palpation, no localized guarding or rebound tenderness.
Doctor: You have acute non-cholera, non-dysenteric gastroenteritis with mild dehydration, likely foodborne.
Doctor: Treatment plan: Antibiotics are NOT indicated right now as there is no bloody stool or systemic fever. The main treatment is oral rehydration. I am giving you Oral Rehydration Salts (ORS) packets — dissolve 1 packet in exactly 1 liter of clean water and drink 1 glass after every loose stool. Also start Zinc Sulfate 20mg once daily for 10 days to aid mucosal recovery.
Doctor: Continue eating light meals like rice, bananas, porridge. Avoid fatty foods or dairy for 2 days.
Patient: Do I need any antibiotics or anti-diarrhea pills?
Doctor: No anti-motility pills like Loperamide, as we want your body to naturally flush out the toxin. If stool becomes bloody, or if you develop high fever, intractable vomiting, or dizziness, return immediately.`
  },
  {
    id: 'spanish-consultation-fever',
    title: 'Spanish Consultation (Gastroenteritis & Fever)',
    category: 'Spanish Consultation',
    description: 'Spanish language consultation for high fever, severe headache, and acute watery diarrhea.',
    patientInfo: {
      name: 'Carlos Rodríguez',
      age: 38,
      sex: 'Male',
      medicalHistory: 'Controlled essential hypertension.',
      currentMedications: 'Enalapril 10mg daily',
      knownAllergies: 'Penicillin allergy (causes skin rash)',
      encounterType: 'Acute Urgent Care Visit',
      clinicLocation: 'Centro de Salud Rural'
    },
    transcript: `Doctor: Buenos días Carlos, tome asiento. ¿Cuál es el motivo de su consulta el día de hoy?
Paciente: Buenos días doctor. Desde hace tres días tengo mucha fiebre, escalofríos y un dolor de cabeza muy fuerte. Además, ayer empecé con diarrea líquida y dolor abdominal.
Doctor: Entiendo. ¿Ha tenido náuseas o vómitos? ¿Ha notado sangre en la diarrea?
Paciente: Tuve dos episodios de vómito anoche y mucha náusea. No he visto sangre en las deposiciones, pero son totalmente líquidas.
Doctor: ¿Toma alguna medicina actualmente o tiene alguna alergia conocida?
Paciente: Tomo Enalapril de 10mg para la presión arterial todos los días. Soy alérgico a la penicilina, me da sarpullido.
Doctor: De acuerdo. Vamos a examinarlo y tomar sus funciones vitales. Presión arterial: 118/78 mmHg, Temperatura: 38.8°C, Frecuencia cardíaca: 96 latidos por minuto, Frecuencia respiratoria: 18.
Doctor: Al examen físico: Paciente febril, mucosas ligeramente secas. Abdomen blando, ruidos hidroaéreos aumentados, dolor leve a la palpación difusa sin irritación peritoneal.
Doctor: El diagnóstico es una Gastroenteritis Aguda Infecciosa con deshidratación leve y Síndrome Febril.
Doctor: Plan de tratamiento: Vamos a iniciar Sales de Rehidratación Oral (SRO), 1 sobre disuelto en 1 litro de agua hervida, tomando a libre demanda tras cada deposición. Para la fiebre, Paracetamol 500mg cada 8 horas por 3 días. No utilizaremos penicilina ni derivados debido a su alergia.
Paciente: Muchas gracias doctor. ¿Cuándo debo regresar a control?
Doctor: Si la fiebre no cede en 48 horas, si presenta vómitos persistentes o sangre en las heces, regrese de inmediato. Si mejora, control en 5 días.`
  }
];
