import React, { useState, useEffect } from 'react';
import { EmergencyTriageAlert } from '../../types';
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  PhoneCall,
  Volume2,
  VolumeX,
  ShieldAlert,
  ArrowRight,
  Clock,
  HeartPulse,
} from 'lucide-react';
import { publishEmergencyAlert, playEmergencyAlertChime } from '../../utils/emergencyTriageDetector';

export interface EmergencyInterruptOverlayProps {
  alert: EmergencyTriageAlert;
  isHindi?: boolean;
  onStaffOverride: () => void;
}

export const EmergencyInterruptOverlay: React.FC<EmergencyInterruptOverlayProps> = ({
  alert,
  isHindi = false,
  onStaffOverride,
}) => {
  const [isSpeakingReassurance, setIsSpeakingReassurance] = useState<boolean>(false);
  const [repagedCount, setRepagedCount] = useState<number>(0);
  const [showOverrideConfirm, setShowOverrideConfirm] = useState<boolean>(false);
  const [overrideStaffCode, setOverrideStaffCode] = useState<string>('');
  const [overrideError, setOverrideError] = useState<string | null>(null);

  // Play audible emergency chime on initial mount
  useEffect(() => {
    playEmergencyAlertChime();
    speakReassurance();

    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const speakReassurance = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || !window.speechSynthesis) {
      return;
    }

    window.speechSynthesis.cancel();
    const reassuranceText = isHindi
      ? `आपातकालीन मेडिकल ट्रायज अलर्ट सक्रिय किया गया है। अस्पताल के आपातकालीन कर्मचारियों को आपके कियोस्क पर सूचित कर दिया गया है। कृपया शांतिपूर्वक यहीं बैठे रहें। चिकित्सा सहायता आ रही है।`
      : `Emergency medical triage alert activated. Hospital emergency staff have been notified to your terminal. Please remain seated calmly. Medical assistance is on the way.`;

    const utterance = new SpeechSynthesisUtterance(reassuranceText);
    utterance.rate = 0.9;
    utterance.lang = isHindi ? 'hi-IN' : 'en-IN';
    utterance.onstart = () => setIsSpeakingReassurance(true);
    utterance.onend = () => setIsSpeakingReassurance(false);
    utterance.onerror = () => setIsSpeakingReassurance(false);

    window.speechSynthesis.speak(utterance);
  };

  const handleRepageStaff = async () => {
    setRepagedCount((prev) => prev + 1);
    playEmergencyAlertChime();
    // Re-publish updated alert
    await publishEmergencyAlert({
      ...alert,
      triggerInputText: `${alert.triggerInputText} [Patient re-paged at ${new Date().toLocaleTimeString()}]`,
    });
  };

  const handleConfirmOverride = () => {
    // Clinician override verification
    if (!overrideStaffCode.trim()) {
      setOverrideError('Enter Staff Nurse/Doctor ID or PIN to resume');
      return;
    }
    // Any 3+ character staff PIN or code
    onStaffOverride();
  };

  return (
    <div
      id="kiosk-emergency-interrupt-screen"
      role="alertdialog"
      aria-live="assertive"
      className="fixed inset-0 z-50 bg-red-950/95 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-8 overflow-y-auto"
    >
      <div className="w-full max-w-3xl bg-slate-950 border-4 border-red-500 rounded-3xl p-6 sm:p-8 shadow-[0_0_80px_rgba(239,68,68,0.5)] flex flex-col gap-6 text-white relative animate-in fade-in zoom-in-95 duration-200">
        
        {/* Pulsing Alert Banner Header */}
        <div className="w-full bg-gradient-to-r from-red-600 via-red-500 to-rose-600 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-xl">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="p-3 bg-white text-red-600 rounded-2xl shadow-md animate-bounce">
              <AlertTriangle className="w-8 h-8 sm:w-10 sm:h-10" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-black/40 text-yellow-300 font-mono font-black text-xs uppercase tracking-wider">
                  STAT RED ALERT • PRIORITY 1
                </span>
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-yellow-400"></span>
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5">
                {isHindi
                  ? 'आपातकालीन क्लिनिकल ट्रायज अलर्ट'
                  : 'EMERGENCY CLINICAL TRIAGE ACTIVATED'}
              </h1>
            </div>
          </div>

          <div className="text-right hidden sm:block">
            <span className="text-xs font-mono text-red-100 block">Kiosk Location</span>
            <span className="text-sm font-black text-white">{alert.kioskStationId}</span>
          </div>
        </div>

        {/* Primary Reassurance Notice to Patient */}
        <div className="p-5 sm:p-6 rounded-2xl bg-red-900/30 border-2 border-red-500/50 flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <HeartPulse className="w-7 h-7 text-red-400 shrink-0 mt-0.5 animate-pulse" />
            <div>
              <h2 className="text-lg sm:text-xl font-black text-red-100">
                {isHindi
                  ? 'कृपया शांतिपूर्वक बैठे रहें। मेडिकल स्टाफ को सूचित कर दिया गया है।'
                  : 'Please remain seated calmly. Hospital medical staff have been alerted.'}
              </h2>
              <p className="text-sm sm:text-base text-red-200 mt-1 leading-relaxed">
                {isHindi
                  ? 'हमारे क्लिनिकल इनटेक ने ऐसे आपातकालीन लक्षणों का पता लगाया है जिनके लिए तत्काल चिकित्सा मूल्यांकन आवश्यक है। आपातकालीन नर्सिंग स्टाफ एवं डॉक्टर को तुरंत सूचित किया गया है और वे सीधे आपके कियोस्क पर आ रहे हैं।'
                  : 'Our live clinical intake detected emergency symptoms requiring immediate medical evaluation. An emergency triage nurse and attending physician have been paged in the hospital Triage Queue and are coming directly to your station.'}
              </p>
            </div>
          </div>

          {/* Voice Reassurance Speaker Button */}
          <div className="flex items-center justify-between pt-2 border-t border-red-500/30 mt-1">
            <span className="text-xs text-red-300 font-semibold">
              Voice Audio Guidance Active
            </span>
            <button
              id="kiosk-emergency-reassurance-audio-btn"
              type="button"
              onClick={speakReassurance}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer transition-all shadow"
            >
              {isSpeakingReassurance ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              <span>{isSpeakingReassurance ? 'Stop Audio' : 'Listen to Audio Reassurance'}</span>
            </button>
          </div>
        </div>

        {/* Clinical Emergency Details Card */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-3 text-xs sm:text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
            <span className="text-slate-400 font-bold uppercase tracking-wider text-[11px]">
              Detected Emergency Pattern:
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-red-500/20 border border-red-500 text-red-300 font-bold text-xs">
              {alert.emergencyCategory}
            </span>
          </div>

          <div className="text-white text-sm sm:text-base font-bold">
            {alert.detectedPattern}
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs">
            <span className="text-slate-500 font-mono block mb-1">
              Trigger Description (Detected Live During Input):
            </span>
            <span className="text-yellow-200 font-semibold italic">"{alert.triggerInputText}"</span>
          </div>

          <div className="space-y-1.5 pt-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Immediate Clinical Directives Prepared for Triage Team:
            </span>
            {alert.actionDirectives.map((action, i) => (
              <div key={i} className="flex items-center gap-2 text-slate-200 text-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <span>{action}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Station Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          {/* Re-Page Staff Button */}
          <button
            id="kiosk-repage-staff-btn"
            type="button"
            onClick={handleRepageStaff}
            className="w-full sm:flex-1 h-14 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-black text-base flex items-center justify-center gap-2 shadow-xl hover:scale-102 transition-all cursor-pointer"
          >
            <BellRing className="w-5 h-5 animate-pulse" />
            <span>
              {repagedCount > 0 ? `Alert Sent (${repagedCount + 1}x) • Page Again` : 'Page Medical Staff Again'}
            </span>
          </button>

          {/* Clinician Override / Staff Attended Button */}
          <button
            id="kiosk-staff-override-toggle-btn"
            type="button"
            onClick={() => setShowOverrideConfirm(!showOverrideConfirm)}
            className="w-full sm:w-auto h-14 px-5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs sm:text-sm border border-slate-700 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <ShieldAlert className="w-4 h-4 text-slate-400" />
            <span>Staff Attended / Override</span>
          </button>
        </div>

        {/* Staff De-escalation Password / PIN Drawer */}
        {showOverrideConfirm && (
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-700 flex flex-col gap-3 text-xs animate-in fade-in duration-150">
            <span className="font-bold text-slate-300">
              Medical Staff Verification (Nurse / Clinician Override):
            </span>
            <p className="text-slate-400 text-[11px]">
              If the patient has been safely assessed or this was an accidental test entry, enter your staff initials or ID to resume the regular interview flow.
            </p>
            <div className="flex items-center gap-2">
              <input
                id="kiosk-staff-pin-input"
                type="text"
                value={overrideStaffCode}
                onChange={(e) => {
                  setOverrideStaffCode(e.target.value);
                  setOverrideError(null);
                }}
                placeholder="Enter Staff ID or PIN (e.g., RN-402, MD-01, 1234)..."
                className="flex-1 h-11 px-3 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-teal-400"
              />
              <button
                id="kiosk-confirm-staff-override-btn"
                type="button"
                onClick={handleConfirmOverride}
                className="h-11 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs cursor-pointer shadow"
              >
                Resume Interview
              </button>
            </div>
            {overrideError && (
              <span className="text-red-400 font-bold text-[11px]">{overrideError}</span>
            )}
          </div>
        )}

        {/* Terminal Info Footer */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono border-t border-slate-900 pt-3">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" />
            <span>Triggered at {new Date(alert.timestamp).toLocaleTimeString()}</span>
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <PhoneCall className="w-3.5 h-3.5 text-teal-400" />
            <span>Casualty Intercom: Ext 2200</span>
          </div>
        </div>

      </div>
    </div>
  );
};
