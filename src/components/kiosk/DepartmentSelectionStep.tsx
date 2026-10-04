import React, { useState } from 'react';
import { useTranslation } from '../../i18n/LanguageContext';
import {
  Stethoscope,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Volume2,
  VolumeX,
  Building2,
  Flower2,
  HeartPulse,
  Flame,
  Scale,
  Apple,
} from 'lucide-react';

export interface DepartmentSelectionStepProps {
  initialDepartment?: 'Allopathic' | 'Ayurveda (AYUSH)' | null;
  selectedDepartment?: 'Allopathic' | 'Ayurveda (AYUSH)' | null;
  onSelectDepartment: (dept: 'Allopathic' | 'Ayurveda (AYUSH)') => void;
  onBack?: () => void;
}

export const DepartmentSelectionStep: React.FC<DepartmentSelectionStepProps> = ({
  initialDepartment,
  selectedDepartment,
  onSelectDepartment,
  onBack,
}) => {
  const { language } = useTranslation();
  const isHindi = language === 'hi';

  const [selected, setSelected] = useState<'Allopathic' | 'Ayurveda (AYUSH)' | null>(
    selectedDepartment || initialDepartment || null
  );
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  const handleAudioGuide = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || !window.speechSynthesis) {
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    const text = isHindi
      ? 'कृपया अपने परामर्श के लिए विभाग का चयन करें: एलोपैथिक आधुनिक चिकित्सा या आयुष आयुर्वेद परामर्श।'
      : 'Please select your consultation department: General Allopathic Medicine or Ayurveda AYUSH OPD following AIIA clinical guidelines with Dashavidha Pariksha.';

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.lang = isHindi ? 'hi-IN' : 'en-IN';

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const handleConfirm = () => {
    if (selected) {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      onSelectDepartment(selected);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-slate-900/90 border-2 border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-md">
      {/* Header & Accessibility Audio Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-teal-500/10 border border-teal-400/30 text-teal-300 text-xs font-bold uppercase tracking-wider mb-2">
            <Building2 className="w-3.5 h-3.5" />
            {isHindi ? 'चरण 3 • विशेषज्ञता चयन' : 'Step 3 of 6 • Department Selection'}
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            {isHindi ? 'परामर्श विभाग का चयन करें' : 'Select Consultation Department'}
          </h1>
          <p className="text-slate-400 text-sm sm:text-base mt-1">
            {isHindi
              ? 'क्लिनिकल इतिहास और प्रश्नों को अनुकूलित करने के लिए OPD स्ट्रीम चुनें'
              : 'Choose the OPD stream to customize your pre-consultation clinical history'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleAudioGuide}
          className={`flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold transition-all border shrink-0 ${
            isSpeaking
              ? 'bg-amber-500/20 text-amber-300 border-amber-400/50 shadow-lg shadow-amber-500/10 animate-pulse'
              : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700/80 hover:text-white'
          }`}
          aria-label={isHindi ? 'निर्देश बोलकर सुनें' : 'Listen to instructions'}
        >
          {isSpeaking ? <VolumeX className="w-4 h-4 text-amber-400" /> : <Volume2 className="w-4 h-4 text-teal-400" />}
          <span>{isSpeaking ? (isHindi ? 'आवाज रोकें' : 'Stop Audio') : (isHindi ? 'ऑडियो गाइड' : 'Audio Guide')}</span>
        </button>
      </div>

      {/* Two Parallel Department Choices */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-8">
        {/* Allopathic Option Card */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setSelected('Allopathic')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setSelected('Allopathic');
            }
          }}
          className={`group relative flex flex-col justify-between p-6 sm:p-8 rounded-3xl border-3 transition-all cursor-pointer text-left focus:outline-none focus:ring-4 focus:ring-teal-500/40 ${
            selected === 'Allopathic'
              ? 'bg-gradient-to-b from-teal-950/70 to-slate-900 border-teal-400 shadow-2xl shadow-teal-500/20 ring-2 ring-teal-400/50'
              : 'bg-slate-800/50 border-slate-700/80 hover:bg-slate-800 hover:border-slate-600'
          }`}
        >
          <div>
            <div className="flex items-start justify-between gap-4 mb-5">
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${
                  selected === 'Allopathic'
                    ? 'bg-teal-500/30 text-teal-300 border-2 border-teal-400 shadow-lg shadow-teal-500/20'
                    : 'bg-slate-700/60 text-slate-300 group-hover:text-teal-400'
                }`}
              >
                <Stethoscope className="w-8 h-8" />
              </div>
              <div
                className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${
                  selected === 'Allopathic'
                    ? 'border-teal-400 bg-teal-400 text-slate-950 shadow-md'
                    : 'border-slate-600 bg-transparent'
                }`}
              >
                {selected === 'Allopathic' && <CheckCircle2 className="w-5 h-5" />}
              </div>
            </div>

            <div className="inline-block px-3 py-1 rounded-md bg-teal-500/15 border border-teal-400/30 text-teal-300 text-xs font-bold uppercase tracking-wider mb-2">
              {isHindi ? 'आधुनिक चिकित्सा • सामान्य OPD' : 'General OPD • Modern Medicine'}
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-2">
              {isHindi ? 'एलोपैथिक चिकित्सा' : 'Allopathic Medicine'}
            </h2>

            <p className="text-slate-300 text-sm leading-relaxed mb-5">
              {isHindi
                ? 'मानक आधुनिक परामर्श: मुख्य शिकायत, SOCRATES दर्द मैपिंग, लक्षणों का क्रम और दवाएं।'
                : 'Standard modern outpatient intake: chief complaint, SOCRATES pain mapping, acute symptom chronologies, review of systems, and medications.'}
            </p>

            <div className="space-y-2 pt-4 border-t border-slate-700/60">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <HeartPulse className="w-4 h-4 text-teal-400 shrink-0" />
                <span>SOCRATES Pain & Acute Symptom Mapping</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                <span>Past Medical Conditions & Surgeries</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                <span>Prescription Drugs & Known Allergies</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSelected('Allopathic');
            }}
            className={`w-full mt-6 py-3.5 px-4 rounded-2xl font-bold text-sm sm:text-base transition-all flex items-center justify-center gap-2 ${
              selected === 'Allopathic'
                ? 'bg-teal-500 text-slate-950 shadow-lg shadow-teal-500/30'
                : 'bg-slate-700/60 text-slate-200 group-hover:bg-slate-700 group-hover:text-white'
            }`}
          >
            <span>{selected === 'Allopathic' ? (isHindi ? 'चयनित' : 'Selected') : (isHindi ? 'एलोपैथी चुनें' : 'Select Allopathic OPD')}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Ayurveda (AYUSH) Option Card */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setSelected('Ayurveda (AYUSH)')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setSelected('Ayurveda (AYUSH)');
            }
          }}
          className={`group relative flex flex-col justify-between p-6 sm:p-8 rounded-3xl border-3 transition-all cursor-pointer text-left focus:outline-none focus:ring-4 focus:ring-emerald-500/40 ${
            selected === 'Ayurveda (AYUSH)'
              ? 'bg-gradient-to-b from-emerald-950/70 to-slate-900 border-emerald-400 shadow-2xl shadow-emerald-500/20 ring-2 ring-emerald-400/50'
              : 'bg-slate-800/50 border-slate-700/80 hover:bg-slate-800 hover:border-slate-600'
          }`}
        >
          <div>
            <div className="flex items-start justify-between gap-4 mb-5">
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${
                  selected === 'Ayurveda (AYUSH)'
                    ? 'bg-emerald-500/30 text-emerald-300 border-2 border-emerald-400 shadow-lg shadow-emerald-500/20'
                    : 'bg-slate-700/60 text-slate-300 group-hover:text-emerald-400'
                }`}
              >
                <Flower2 className="w-8 h-8" />
              </div>
              <div
                className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${
                  selected === 'Ayurveda (AYUSH)'
                    ? 'border-emerald-400 bg-emerald-400 text-slate-950 shadow-md'
                    : 'border-slate-600 bg-transparent'
                }`}
              >
                {selected === 'Ayurveda (AYUSH)' && <CheckCircle2 className="w-5 h-5" />}
              </div>
            </div>

            <div className="inline-block px-3 py-1 rounded-md bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs font-bold uppercase tracking-wider mb-2">
              {isHindi ? 'आयुष मंत्रालय • AIIA प्रोटोकॉल' : 'Ministry of AYUSH • AIIA Protocol'}
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-2">
              {isHindi ? 'आयुर्वेद (AYUSH)' : 'Ayurveda (AYUSH)'}
            </h2>

            <p className="text-slate-300 text-sm leading-relaxed mb-5">
              {isHindi
                ? 'सम्पूर्ण आयुर्वेदिक इतिहास: दशविध परीक्षा, प्रकृति एवं विकृति संतुलन, अग्नि, आहार-विहार और निदान-संप्राप्ति।'
                : 'Comprehensive Ayurvedic intake: Dashavidha Pariksha (10-fold examination), Prakriti & Vikriti constitution, Agni (digestive fire), Ahara-Vihara, and Nidana/Samprapti.'}
            </p>

            <div className="space-y-2 pt-4 border-t border-slate-700/60">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <Flame className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Dashavidha Pariksha (10-Fold Clinical Assessment)</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <Scale className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Prakriti (Constitution) & Vikriti (Current Imbalance)</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <Apple className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Ahara-Vihara (Diet & Lifestyle) + Agni & Kostha</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSelected('Ayurveda (AYUSH)');
            }}
            className={`w-full mt-6 py-3.5 px-4 rounded-2xl font-bold text-sm sm:text-base transition-all flex items-center justify-center gap-2 ${
              selected === 'Ayurveda (AYUSH)'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30'
                : 'bg-slate-700/60 text-slate-200 group-hover:bg-slate-700 group-hover:text-white'
            }`}
          >
            <span>{selected === 'Ayurveda (AYUSH)' ? (isHindi ? 'चयनित' : 'Selected') : (isHindi ? 'आयुर्वेद चुनें' : 'Select Ayurveda OPD')}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-4 pt-6 border-t border-slate-800">
        <button
          type="button"
          onClick={() => onBack?.()}
          className="flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 hover:text-white transition-all border border-slate-700"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>{isHindi ? 'सहमति पर वापस जाएं' : 'Back to Consent'}</span>
        </button>

        <button
          type="button"
          disabled={!selected}
          onClick={handleConfirm}
          className={`flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-black text-base sm:text-lg transition-all shadow-xl ${
            selected
              ? selected === 'Ayurveda (AYUSH)'
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/25 cursor-pointer transform hover:-translate-y-0.5'
                : 'bg-teal-500 hover:bg-teal-400 text-slate-950 shadow-teal-500/25 cursor-pointer transform hover:-translate-y-0.5'
              : 'bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed'
          }`}
        >
          <span>
            {selected
              ? isHindi
                ? `${selected === 'Ayurveda (AYUSH)' ? 'आयुर्वेद' : 'एलोपैथी'} परामर्श जारी रखें`
                : `Proceed to ${selected} Intake`
              : isHindi
              ? 'आगे बढ़ने के लिए विभाग चुनें'
              : 'Choose a Department to Continue'}
          </span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
