"""Speech test fixtures for ASR evaluation across Indian languages.

Includes audio waveforms (clean and noisy) and ground-truth clinical transcripts
for English, Hindi, Hinglish, Marathi, Tamil, and Gujarati.
ALL DATA IS SYNTHETIC CLINICAL TEST DATA (NON-PHI).
"""

import base64
import io
import wave
import numpy as np
from typing import Dict, Any, List


def generate_synthetic_audio_wav(
    duration_s: float = 2.5,
    sample_rate: int = 16000,
    add_noise: bool = False,
    snr_db: float = 12.0,
    is_silence: bool = False,
) -> str:
    """Generates a 16kHz mono PCM WAV base64 string."""
    num_samples = int(duration_s * sample_rate)
    if is_silence:
        signal_data = np.zeros(num_samples, dtype=np.float32)
    else:
        t = np.linspace(0, duration_s, num_samples, endpoint=False)
        # Multi-formant speech-like carrier (F0 ~ 130Hz, F1 ~ 500Hz, F2 ~ 1500Hz, F3 ~ 2500Hz)
        carrier = (
            0.4 * np.sin(2 * np.pi * 130 * t)
            + 0.3 * np.sin(2 * np.pi * 500 * t)
            + 0.2 * np.sin(2 * np.pi * 1500 * t)
            + 0.1 * np.sin(2 * np.pi * 2500 * t)
        )
        # Syllabic envelope modulation (3 to 5 Hz syllables)
        envelope = 0.5 * (1.0 + np.sin(2 * np.pi * 4 * t))
        signal_data = (carrier * envelope).astype(np.float32)

        if add_noise:
            noise = np.random.normal(0, 1, num_samples).astype(np.float32)
            sig_power = np.mean(signal_data ** 2)
            noise_power = sig_power / (10 ** (snr_db / 10))
            noisy_signal = signal_data + np.sqrt(noise_power) * noise
            # Normalize
            max_val = np.max(np.abs(noisy_signal))
            if max_val > 0:
                signal_data = noisy_signal / max_val * 0.85

    # Convert float32 to int16 PCM
    pcm16 = (signal_data * 32767.0).astype(np.int16)

    bio = io.BytesIO()
    with wave.open(bio, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm16.tobytes())

    return base64.b64encode(bio.getvalue()).decode("utf-8")


SPEECH_BENCHMARK_CASES: List[Dict[str, Any]] = [
    {
        "id": "EN_CLEAN_HYPERTENSION",
        "language": "en",
        "speech_condition": "clean",
        "ground_truth": "I do not have high blood pressure but I take Metformin 500 mg daily for diabetes.",
        "simulated_asr_output": "I do not have high blood pressure but I take Metformin 500 mg daily for diabetes.",
        "clinical_terms": ["high blood pressure", "diabetes"],
        "medications": ["Metformin"],
        "numeric_values": ["500 mg"],
        "negation_markers": ["not"],
        "expected_concepts": ["COND_HYPERTENSION", "COND_DIABETES"],
        "audio_base64": generate_synthetic_audio_wav(duration_s=3.0, add_noise=False),
    },
    {
        "id": "EN_NOISY_CHEST_PAIN",
        "language": "en",
        "speech_condition": "noisy",
        "ground_truth": "Patient reports severe chest pain and breathlessness since morning, no headache.",
        "simulated_asr_output": "Patient reports severe chest pain and breathlessness since morning, no headache.",
        "clinical_terms": ["chest pain", "breathlessness", "headache"],
        "medications": [],
        "numeric_values": [],
        "negation_markers": ["no"],
        "expected_concepts": ["SYM_CHEST_PAIN", "SYM_BREATHLESSNESS", "SYM_HEADACHE"],
        "audio_base64": generate_synthetic_audio_wav(duration_s=3.2, add_noise=True, snr_db=10.0),
    },
    {
        "id": "HI_CLEAN_DIABETES",
        "language": "hi",
        "speech_condition": "clean",
        "ground_truth": "मुझे पिछले पांच दिनों से बुखार और खांसी है, लेकिन सीने में दर्द नहीं है।",
        "simulated_asr_output": "मुझे पिछले पांच दिनों से बुखार और खांसी है, लेकिन सीने में दर्द नहीं है।",
        "clinical_terms": ["बुखार", "खांसी", "सीने में दर्द"],
        "medications": [],
        "numeric_values": ["पांच"],
        "negation_markers": ["नहीं"],
        "expected_concepts": ["SYM_FEVER", "SYM_COUGH", "SYM_CHEST_PAIN"],
        "audio_base64": generate_synthetic_audio_wav(duration_s=3.5, add_noise=False),
    },
    {
        "id": "HI_NOISY_MEDICATION",
        "language": "hi",
        "speech_condition": "noisy",
        "ground_truth": "डॉक्टर साहब बीपी की समस्या नहीं है पर सिर दर्द बहुत रहता है।",
        "simulated_asr_output": "डॉक्टर साहब बीपी की समस्या नहीं है पर सिर दर्द बहुत रहता है।",
        "clinical_terms": ["बीपी", "सिर दर्द"],
        "medications": [],
        "numeric_values": [],
        "negation_markers": ["नहीं"],
        "expected_concepts": ["COND_HYPERTENSION", "SYM_HEADACHE"],
        "audio_base64": generate_synthetic_audio_wav(duration_s=3.0, add_noise=True, snr_db=12.0),
    },
    {
        "id": "HINGLISH_CLEAN_METFORMIN",
        "language": "hi",
        "speech_condition": "clean",
        "ground_truth": "Metformin 500 mg maine band kar di hai aur Telmisartan 40 mg chalu hai.",
        "simulated_asr_output": "Metformin 500 mg maine band kar di hai aur Telmisartan 40 mg chalu hai.",
        "clinical_terms": [],
        "medications": ["Metformin", "Telmisartan"],
        "numeric_values": ["500 mg", "40 mg"],
        "negation_markers": ["band"],
        "expected_concepts": [],
        "audio_base64": generate_synthetic_audio_wav(duration_s=3.0, add_noise=False),
    },
    {
        "id": "MR_CLEAN_CHEST_PAIN",
        "language": "mr",
        "speech_condition": "clean",
        "ground_truth": "मला छातीत दुखत नाही पण खूप ताप आणि खोकला आहे.",
        "simulated_asr_output": "मला छातीत दुखत नाही पण खूप ताप आणि खोकला आहे.",
        "clinical_terms": ["छातीत दुखत", "ताप", "खोकला"],
        "medications": [],
        "numeric_values": [],
        "negation_markers": ["नाही"],
        "expected_concepts": ["SYM_CHEST_PAIN", "SYM_FEVER", "SYM_COUGH"],
        "audio_base64": generate_synthetic_audio_wav(duration_s=2.8, add_noise=False),
    },
    {
        "id": "MR_NOISY_HEADACHE",
        "language": "mr",
        "speech_condition": "noisy",
        "ground_truth": "बीपी चा त्रास नाही पण डोके खूप दुखत आहे.",
        "simulated_asr_output": "बीपी चा त्रास नाही पण डोके खूप दुखत आहे.",
        "clinical_terms": ["बीपी", "डोके"],
        "medications": [],
        "numeric_values": [],
        "negation_markers": ["नाही"],
        "expected_concepts": ["COND_HYPERTENSION", "SYM_HEADACHE"],
        "audio_base64": generate_synthetic_audio_wav(duration_s=2.5, add_noise=True, snr_db=10.0),
    },
    {
        "id": "TA_CLEAN_FEVER",
        "language": "ta",
        "speech_condition": "clean",
        "ground_truth": "எனக்கு நெஞ்சு வலி இல்லை ஆனால் கடுமையான காய்ச்சல் மற்றும் இருமல் உள்ளது.",
        "simulated_asr_output": "எனக்கு நெஞ்சு வலி இல்லை ஆனால் கடுமையான காய்ச்சல் மற்றும் இருமல் உள்ளது.",
        "clinical_terms": ["நெஞ்சு வலி", "காய்ச்சல்", "இருமல்"],
        "medications": [],
        "numeric_values": [],
        "negation_markers": ["இல்லை"],
        "expected_concepts": ["SYM_CHEST_PAIN", "SYM_FEVER", "SYM_COUGH"],
        "audio_base64": generate_synthetic_audio_wav(duration_s=3.2, add_noise=False),
    },
    {
        "id": "TA_NOISY_DIABETES",
        "language": "ta",
        "speech_condition": "noisy",
        "ground_truth": "சர்க்கரை நோய் உள்ளது ஆனால் பிபி பிரச்சினை இல்லை.",
        "simulated_asr_output": "சர்க்கரை நோய் உள்ளது ஆனால் பிபி பிரச்சினை இல்லை.",
        "clinical_terms": ["சர்க்கரை நோய்", "பிபி"],
        "medications": [],
        "numeric_values": [],
        "negation_markers": ["இல்லை"],
        "expected_concepts": ["COND_DIABETES", "COND_HYPERTENSION"],
        "audio_base64": generate_synthetic_audio_wav(duration_s=3.0, add_noise=True, snr_db=11.0),
    },
    {
        "id": "GU_CLEAN_FEVER",
        "language": "gu",
        "speech_condition": "clean",
        "ground_truth": "મને છાતીમાં દુખાવો નથી પણ ખૂબ તાવ અને ખાંસી છે.",
        "simulated_asr_output": "મને છાતીમાં દુખાવો નથી પણ ખૂબ તાવ અને ખાંસી છે.",
        "clinical_terms": ["છાતીમાં દુખાવો", "તાવ", "ખાંસી"],
        "medications": [],
        "numeric_values": [],
        "negation_markers": ["નથી"],
        "expected_concepts": ["SYM_CHEST_PAIN", "SYM_FEVER", "SYM_COUGH"],
        "audio_base64": generate_synthetic_audio_wav(duration_s=2.9, add_noise=False),
    },
    {
        "id": "GU_NOISY_HEADACHE",
        "language": "gu",
        "speech_condition": "noisy",
        "ground_truth": "બીપી ની તકલીફ નથી પણ માથું ખૂબ દુખે છે.",
        "simulated_asr_output": "બીપી ની તકલીફ નથી પણ માથું ખૂબ દુખે છે.",
        "clinical_terms": ["બીપી", "માથું"],
        "medications": [],
        "numeric_values": [],
        "negation_markers": ["નથી"],
        "expected_concepts": ["COND_HYPERTENSION", "SYM_HEADACHE"],
        "audio_base64": generate_synthetic_audio_wav(duration_s=2.7, add_noise=True, snr_db=10.0),
    },
]
