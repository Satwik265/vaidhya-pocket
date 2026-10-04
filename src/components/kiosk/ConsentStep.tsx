import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n/LanguageContext';
import {
  ShieldCheck,
  Mic,
  FileText,
  Share2,
  Volume2,
  VolumeX,
  CheckSquare,
  Square,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Info,
} from 'lucide-react';

export interface ConsentPreferences {
  voiceCapture: boolean;
  documentUpload: boolean;
  hospitalSharing: boolean;
}

interface ConsentStepProps {
  initialConsent?: ConsentPreferences;
  onConsentGiven: (consent: ConsentPreferences) => void;
  onBack: () => void;
}

interface ConsentItem {
  id: keyof ConsentPreferences;
  title: string;
  explanation: string;
  spokenText: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredForFullExperience: boolean;
}

export const ConsentStep: React.FC<ConsentStepProps> = ({
  initialConsent = { voiceCapture: false, documentUpload: false, hospitalSharing: false },
  onConsentGiven,
  onBack,
}) => {
  const { language } = useTranslation();
  const [consent, setConsent] = useState<ConsentPreferences>(initialConsent);
  const [activeSpeakingId, setActiveSpeakingId] = useState<string | null>(null);

  // Stop speech when component unmounts
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const consentItems: ConsentItem[] = [
    {
      id: 'voiceCapture',
      title: language === 'hi' ? 'आवाज़ रिकॉर्डिंग एवं ट्रांसक्रिप्शन' : 'Voice Capture & Spoken Intake',
      explanation:
        language === 'hi'
          ? 'मेडिस्कियोस्क को आपकी आवाज़ रिकॉर्ड करने और आपकी चुनी हुई भाषा में लक्षणों को क्लिनिकल रिकॉर्ड में दर्ज करने की अनुमति दें।'
          : 'Allow MediKiosk to record and transcribe your voice to document your symptoms in your preferred language.',
      spokenText:
        language === 'hi'
          ? 'सहमति बिंदु एक: आवाज़ रिकॉर्डिंग। मेडिस्कियोस्क को आपकी आवाज़ में लक्षण दर्ज करने की अनुमति दें।'
          : 'Consent item one: Voice capture. Allow MediKiosk to record your voice and transcribe your symptoms into your clinical record in your preferred language.',
      icon: Mic,
      requiredForFullExperience: false,
    },
    {
      id: 'documentUpload',
      title: language === 'hi' ? 'पर्चे एवं मेडिकल दस्तावेज़ स्कैनिंग' : 'Document & Prescription Digitization',
      explanation:
        language === 'hi'
          ? 'कियोस्क कैमरे द्वारा पुरानी शारीरिक पर्चियों, लैब टेस्ट रिपोर्ट और डिस्चार्ज सारांश को स्कैन करने की अनुमति दें।'
          : 'Allow the kiosk camera to scan physical prescriptions, lab test reports, and hospital discharge summaries.',
      spokenText:
        language === 'hi'
          ? 'सहमति बिंदु दो: दस्तावेज़ स्कैनिंग। अपने पुराने पर्चे और लैब रिपोर्ट कैमरे से स्कैन करने की अनुमति दें।'
          : 'Consent item two: Document upload. Allow the kiosk camera to scan past physical prescriptions and laboratory test reports.',
      icon: FileText,
      requiredForFullExperience: false,
    },
    {
      id: 'hospitalSharing',
      title:
        language === 'hi'
          ? 'डॉक्टर एवं ABDM के साथ क्लिनिकल सारांश साझा करना'
          : 'Structured History Sharing with Hospital & ABDM',
      explanation:
        language === 'hi'
          ? 'मेडिस्कियोस्क को आपके परामर्श सारांश को संकलित करने और परामर्शदाता डॉक्टर के साथ ABDM मानकों के तहत सुरक्षित रूप से साझा करने की अनुमति दें।'
          : 'Allow MediKiosk to compile your structured intake summary and securely route it to your consulting OPD doctor via ABDM standards.',
      spokenText:
        language === 'hi'
          ? 'सहमति बिंदु तीन: अस्पताल एवं ABDM के साथ साझा करना। संरचित क्लिनिकल सारांश डॉक्टर के साथ सुरक्षित साझा करने की अनुमति दें।'
          : 'Consent item three: Hospital and ABDM sharing. Allow MediKiosk to compile your structured history and share it securely with your consulting OPD doctor.',
      icon: Share2,
      requiredForFullExperience: true,
    },
  ];

  const handleReadAloud = (itemId: string, textToSpeak: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || !window.speechSynthesis) {
      alert('Speech synthesis is not supported in this browser.');
      return;
    }

    if (activeSpeakingId === itemId) {
      // Toggle off if already speaking this item
      window.speechSynthesis.cancel();
      setActiveSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = 0.95; // comfortable cadence for public kiosk patients
    utterance.pitch = 1.0;
    utterance.lang = language === 'hi' ? 'hi-IN' : 'en-IN';

    utterance.onstart = () => {
      setActiveSpeakingId(itemId);
    };

    utterance.onend = () => {
      setActiveSpeakingId(null);
    };

    utterance.onerror = () => {
      setActiveSpeakingId(null);
    };

    window.speechSynthesis.speak(utterance);
  };

  const handleReadAllAloud = () => {
    const fullText = consentItems.map((item) => `${item.title}. ${item.explanation}`).join('. ');
    handleReadAloud('all', fullText);
  };

  const toggleConsent = (id: keyof ConsentPreferences) => {
    setConsent((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const selectAll = () => {
    setConsent({
      voiceCapture: true,
      documentUpload: true,
      hospitalSharing: true,
    });
  };

  const isAtLeastOneSelected = consent.voiceCapture || consent.documentUpload || consent.hospitalSharing;

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col items-center">
      {/* Step Icon Badge */}
      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-blue-500/20 border-2 border-blue-400/40 flex items-center justify-center text-blue-300 mb-5 shadow-xl">
        <ShieldCheck className="w-10 h-10 sm:w-12 sm:h-12" />
      </div>

      <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-500/10 border border-blue-400/30 text-blue-300 text-xs sm:text-sm font-bold uppercase tracking-wider mb-3">
        <Sparkles className="w-4 h-4" />
        Step 2 • DPDP Act 2023 & ABDM Consent
      </div>

      <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white mb-2 text-center">
        {language === 'hi' ? 'मरीज़ की सूचित सहमति (DPDP Act 2023)' : 'Patient Informed Consent'}
      </h1>

      <p className="text-sm sm:text-base text-slate-300 max-w-xl mb-6 text-center leading-relaxed">
        {language === 'hi'
          ? 'इस कियोस्क सत्र के लिए प्रत्येक अनुमति का व्यक्तिगत रूप से चयन करें। किसी भी बिंदु को सुनने के लिए स्पीकर आइकन दबाएं।'
          : 'Select each authorization individually for this kiosk session. Tap the audio speaker icon to listen to each item read aloud.'}
      </p>

      {/* Global Audio Read-Aloud & Fast Select Bar */}
      <div className="w-full mb-6 p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            id="kiosk-consent-read-all-btn"
            type="button"
            onClick={handleReadAllAloud}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 border ${
              activeSpeakingId === 'all'
                ? 'bg-amber-500/30 text-amber-300 border-amber-400 animate-pulse'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 hover:text-white'
            }`}
          >
            {activeSpeakingId === 'all' ? (
              <>
                <VolumeX className="w-4 h-4 text-amber-300" />
                <span>Stop Reading</span>
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4 text-teal-400" />
                <span>Read Entire Consent Aloud</span>
              </>
            )}
          </button>

          <span className="text-xs text-slate-400 hidden sm:inline">
            Assisted voice synthesis for accessible public kiosk usage
          </span>
        </div>

        <button
          type="button"
          onClick={selectAll}
          className="text-xs font-bold text-teal-400 hover:text-teal-300 underline cursor-pointer"
        >
          Select All Permissions
        </button>
      </div>

      {/* Granular Consent Checkboxes List */}
      <div className="w-full flex flex-col gap-4 mb-8">
        {consentItems.map((item) => {
          const Icon = item.icon;
          const isChecked = consent[item.id];
          const isSpeaking = activeSpeakingId === item.id;

          return (
            <div
              key={item.id}
              className={`w-full rounded-2xl border-2 transition-all p-4 sm:p-5 flex items-start gap-4 ${
                isChecked
                  ? 'bg-slate-900/95 border-teal-500/60 shadow-lg shadow-teal-950/30'
                  : 'bg-slate-900/50 border-slate-800 opacity-80'
              }`}
            >
              {/* Checkbox Tap Target */}
              <button
                id={`kiosk-consent-checkbox-${item.id}`}
                type="button"
                onClick={() => toggleConsent(item.id)}
                className="mt-1 cursor-pointer text-teal-400 hover:text-teal-300 transition-colors shrink-0"
                aria-label={`Toggle consent for ${item.title}`}
              >
                {isChecked ? (
                  <CheckSquare className="w-7 h-7 sm:w-8 sm:h-8 text-teal-400" />
                ) : (
                  <Square className="w-7 h-7 sm:w-8 sm:h-8 text-slate-600 hover:text-slate-400" />
                )}
              </button>

              {/* Information Content */}
              <div
                className="flex-1 cursor-pointer select-none"
                onClick={() => toggleConsent(item.id)}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-5 h-5 text-teal-400 shrink-0" />
                  <h3 className="text-base sm:text-lg font-bold text-white leading-tight">
                    {item.title}
                  </h3>
                  {item.requiredForFullExperience && (
                    <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30 ml-auto sm:ml-0">
                      Recommended
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {item.explanation}
                </p>
              </div>

              {/* Native Speech Synthesis "Read Aloud" Button */}
              <button
                id={`kiosk-consent-audio-${item.id}`}
                type="button"
                onClick={() => handleReadAloud(item.id, item.spokenText)}
                className={`p-3 rounded-2xl border transition-all cursor-pointer shrink-0 flex items-center justify-center ${
                  isSpeaking
                    ? 'bg-amber-500/30 border-amber-400 text-amber-300 ring-2 ring-amber-400/40 animate-pulse'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-white'
                }`}
                title={isSpeaking ? 'Stop reading this clause' : 'Read this clause aloud'}
                aria-label={`Read aloud: ${item.title}`}
              >
                {isSpeaking ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
              </button>
            </div>
          );
        })}
      </div>

      {/* DPDP Act Legal Notice Footnote */}
      <div className="w-full p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 mb-8 flex items-start gap-3 text-xs text-slate-400">
        <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-slate-300">
            Digital Personal Data Protection (DPDP) Act 2023 Compliance Notice:
          </span>{' '}
          Consent is purpose-specific, revocable at any time during the encounter, and strictly limited to this outpatient consultation session. No patient data is shared for commercial advertising.
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="w-full flex flex-col sm:flex-row gap-4 items-center">
        <button
          id="kiosk-consent-back-btn"
          type="button"
          onClick={onBack}
          className="w-full sm:w-1/3 h-16 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-base border-2 border-slate-700 transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to ABHA</span>
        </button>

        <button
          id="kiosk-consent-continue-btn"
          type="button"
          disabled={!isAtLeastOneSelected}
          onClick={() => onConsentGiven(consent)}
          className="w-full sm:flex-1 h-16 rounded-2xl bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-400 hover:to-blue-500 text-slate-950 font-black text-lg sm:text-xl transition-all cursor-pointer flex items-center justify-center gap-3 shadow-xl active:scale-98 disabled:opacity-40"
        >
          <span>Confirm Consent & Begin Interview</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
