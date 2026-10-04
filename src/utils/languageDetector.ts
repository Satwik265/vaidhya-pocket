/**
 * Utility to detect non-English transcripts (e.g. Spanish)
 * Used by the UI and offline local engine to warn clinicians when offline mode is active.
 */
export function isNonEnglishTranscript(transcript: string): boolean {
  if (!transcript || transcript.trim().length === 0) return false;
  const lower = transcript.toLowerCase();

  // Spanish accent marks / inverted punctuation
  if (/[áéíóúñ¿¡]/.test(lower)) return true;

  // Common Spanish words in clinical dialogue
  const spanishKeywords = [
    'buenos', 'días', 'tardes', 'doctor', 'doctora', 'paciente', 'gracias',
    'fiebre', 'dolor', 'cabeza', 'pecho', 'estomago', 'diarrea', 'vomito', 'vomitos',
    'tengo', 'tiene', 'siento', 'desde', 'hace', 'dias', 'semanas', 'meses',
    'medicina', 'medicamento', 'pastillas', 'alergia', 'presion', 'sangre',
    'consulta', 'motivo', 'sintomas', 'examen', 'tratamiento', 'regresar',
    'mucho', 'mucha', 'senor', 'senora', 'embarazo', 'embarazada'
  ];

  let matches = 0;
  for (const word of spanishKeywords) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(lower)) {
      matches++;
    }
  }

  return matches >= 2;
}
