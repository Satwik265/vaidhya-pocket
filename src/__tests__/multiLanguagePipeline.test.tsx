import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { isNonEnglishTranscript } from '../utils/languageDetector';
import { generateOfflineSOAPNote } from '../utils/offlineLocalEngine';
import { SAMPLE_SCENARIOS } from '../data/sampleScenarios';
import { TranscriptInput } from '../components/TranscriptInput';
import { LanguageProvider } from '../i18n';

describe('Multi-Language Clinical Pipeline & UI Guardrails', () => {
  it('correctly identifies Spanish transcripts using keywords and accent marks', () => {
    const spanishText = 'Doctor: Buenos días Carlos. ¿Cuál es el motivo de su consulta hoy? Paciente: Tengo mucha fiebre y dolor de cabeza.';
    const englishText = 'Doctor: Good morning Kwame. What brings you to the clinic today? Patient: I have a high fever.';
    
    expect(isNonEnglishTranscript(spanishText)).toBe(true);
    expect(isNonEnglishTranscript(englishText)).toBe(false);
  });

  it('includes Spanish sample consultation scenario in sampleScenarios list', () => {
    const spanishScenario = SAMPLE_SCENARIOS.find((sc) => sc.id === 'spanish-consultation-fever');
    expect(spanishScenario).toBeDefined();
    expect(spanishScenario?.title).toContain('Spanish Consultation');
    expect(isNonEnglishTranscript(spanishScenario?.transcript || '')).toBe(true);
  });

  it('displays non-English warning banner in TranscriptInput when in offline mode with Spanish transcript', () => {
    const spanishTranscript = 'Doctor: Buenos días. Paciente: Tengo dolor de cabeza y fiebre.';
    
    render(
      <LanguageProvider>
        <TranscriptInput
          transcript={spanishTranscript}
          onChangeTranscript={() => {}}
          onSelectScenario={() => {}}
          onGenerateSOAP={() => {}}
          isGenerating={false}
          isOfflineMode={true}
        />
      </LanguageProvider>
    );

    expect(screen.getByText(/Offline Mode English-Only Limitation/i)).toBeInTheDocument();
  });

  it('does NOT display non-English warning banner when in Cloud mode with Spanish transcript', () => {
    const spanishTranscript = 'Doctor: Buenos días. Paciente: Tengo dolor de cabeza y fiebre.';
    
    render(
      <LanguageProvider>
        <TranscriptInput
          transcript={spanishTranscript}
          onChangeTranscript={() => {}}
          onSelectScenario={() => {}}
          onGenerateSOAP={() => {}}
          isGenerating={false}
          isOfflineMode={false}
        />
      </LanguageProvider>
    );

    expect(screen.queryByText(/Offline Mode English-Only Limitation/i)).not.toBeInTheDocument();
  });

  it('prepends a High severity Language Limitation Alert in offline local engine when non-English transcript is parsed', () => {
    const patientInfo = {
      name: 'Carlos Rodríguez',
      age: 38,
      sex: 'Male',
      medicalHistory: 'Hypertension',
      currentMedications: 'Enalapril',
      knownAllergies: 'Penicillin',
      encounterType: 'Urgent Care',
      clinicLocation: 'Rural Post'
    };
    const spanishTranscript = 'Doctor: Buenos días. Paciente: Tengo dolor de cabeza y fiebre desde hace tres días.';

    const soapNote = generateOfflineSOAPNote(patientInfo, spanishTranscript);

    const langAlert = soapNote.safety_alerts.find((alert) => alert.type === 'Language Limitation Alert');
    expect(langAlert).toBeDefined();
    expect(langAlert?.severity).toBe('High');
    expect(langAlert?.message).toContain('Offline local engine supports English transcripts only');
  });
});
