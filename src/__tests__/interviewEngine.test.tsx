import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InterviewEngine } from '../components/kiosk/InterviewEngine';
import { LanguageProvider } from '../i18n/LanguageContext';

describe('InterviewEngine Component', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url) => {
        if (url.includes('/api/kiosk/interview-turn')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                question: 'What is your main health concern or symptom bringing you in today?',
                category: 'chief_complaint',
                suggestedOptions: [
                  'Chest Pain / Discomfort',
                  'Abdominal / Stomach Pain',
                  'Fever & Chills',
                  'Severe Headache',
                ],
                inputType: 'choice_or_voice',
                redFlags: [],
                triagePriority: 'routine',
                isComplete: false,
              }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders initial question and multiple choice option cards', async () => {
    render(
      <LanguageProvider>
        <InterviewEngine onComplete={vi.fn()} />
      </LanguageProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByText('What is your main health concern or symptom bringing you in today?')
      ).toBeInTheDocument();
    });

    expect(screen.getByText('Chest Pain / Discomfort')).toBeInTheDocument();
    expect(screen.getByText('Abdominal / Stomach Pain')).toBeInTheDocument();
    expect(screen.getByText('Fever & Chills')).toBeInTheDocument();
    expect(screen.getByText('Severe Headache')).toBeInTheDocument();
  });

  it('submits selected option and triggers next turn fetch', async () => {
    const handleComplete = vi.fn();
    render(
      <LanguageProvider>
        <InterviewEngine onComplete={handleComplete} />
      </LanguageProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Chest Pain / Discomfort')).toBeInTheDocument();
    });

    const chestPainOption = screen.getByText('Chest Pain / Discomfort');
    fireEvent.click(chestPainOption);

    // Fetch should be called for turn 2
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  it('displays emergency red-flag banner when red flag is present', async () => {
    (global.fetch as any).mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            question: 'How severe is the pain?',
            category: 'socrates_severity',
            suggestedOptions: ['1-3', '4-6', '7-8', '9-10'],
            inputType: 'scale_1_to_10',
            redFlags: ['Crushing retrosternal chest pain radiating to left arm'],
            triagePriority: 'emergency',
            isComplete: false,
          }),
      })
    );

    render(
      <LanguageProvider>
        <InterviewEngine onComplete={vi.fn()} />
      </LanguageProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Potential Clinical Red Flag Detected/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Crushing retrosternal chest pain radiating to left arm/i)
      ).toBeInTheDocument();
    });
  });

  it('correctly handles ayush_kostha_ahara and ayush_vihara_nidra question types and updates AYUSH state', async () => {
    const handleComplete = vi.fn();

    // Turn 0 returns ayush_chief_complaint
    (global.fetch as any).mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            question: 'What is your primary complaint bringing you to the Ayurveda OPD today?',
            category: 'ayush_chief_complaint',
            suggestedOptions: ['Joint Pain (Sandhivata)', 'Hyperacidity (Amlapitta)'],
            inputType: 'choice_or_voice',
            redFlags: [],
            triagePriority: 'routine',
            isComplete: false,
          }),
      })
    );

    // Turn 1 returns ayush_kostha_ahara
    (global.fetch as any).mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            question: 'How are your bowel movements (Kostha) and diet (Ahara)?',
            category: 'ayush_kostha_ahara',
            suggestedOptions: [
              'Krura Kostha (Hard stools / Constipated tendency)',
              'Mridu Kostha (Loose stools / Rapid evacuation)',
              'Madhyama Kostha (Regular normal bowel movement)',
            ],
            inputType: 'choice_or_voice',
            redFlags: [],
            triagePriority: 'routine',
            isComplete: false,
          }),
      })
    );

    // Turn 2 returns ayush_vihara_nidra
    (global.fetch as any).mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            question: 'How is your sleep quality (Nidra) and daily routine (Vihara)?',
            category: 'ayush_vihara_nidra',
            suggestedOptions: [
              'Sukha Nidra (Sound restful sleep)',
              'Alpanidra / Anidra (Disturbed / Insomnia)',
              'Atinidra (Excessive sleep / Drowsiness)',
            ],
            inputType: 'choice_or_voice',
            redFlags: [],
            triagePriority: 'routine',
            isComplete: true,
          }),
      })
    );

    render(
      <LanguageProvider>
        <InterviewEngine
          clinicalDepartment="Ayurveda (AYUSH)"
          onComplete={handleComplete}
        />
      </LanguageProvider>
    );

    // Answer Turn 0: chief complaint
    await waitFor(() => {
      expect(
        screen.getByText('What is your primary complaint bringing you to the Ayurveda OPD today?')
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Joint Pain (Sandhivata)'));

    // Answer Turn 1: ayush_kostha_ahara
    await waitFor(() => {
      expect(
        screen.getByText('How are your bowel movements (Kostha) and diet (Ahara)?')
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Krura Kostha (Hard stools / Constipated tendency)'));

    // Answer Turn 2: ayush_vihara_nidra
    await waitFor(() => {
      expect(
        screen.getByText('How is your sleep quality (Nidra) and daily routine (Vihara)?')
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Sukha Nidra (Sound restful sleep)'));

    // Verify onComplete was called with correctly updated AYUSH intake
    await waitFor(() => {
      expect(handleComplete).toHaveBeenCalled();
      const intake = handleComplete.mock.calls[0][0];
      expect(intake.ayushHistory?.aharaVihara?.kosthaNature).toBe(
        'Krura Kostha (Hard stools / Constipated tendency)'
      );
      expect(intake.ayushHistory?.aharaVihara?.viharaHabits?.nidraPattern).toBe(
        'Sukha Nidra (Sound restful sleep)'
      );
    });
  });
});
