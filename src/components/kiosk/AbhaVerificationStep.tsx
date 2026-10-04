import React, { useState } from 'react';
import {
  CreditCard,
  QrCode,
  CheckCircle2,
  Loader2,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  UserCheck,
  User,
} from 'lucide-react';

/**
 * SIMULATED / DEMO IDENTITY STEP:
 * In a certified ABDM (Ayushman Bharat Digital Mission) production deployment,
 * this component connects to the ABDM Gateway / Health Information Provider (HIP)
 * APIs (Milestone M1 / M2) to initiate Aadhaar OTP, Mobile OTP, or Face/Biometric
 * authentication and fetch the patient's verified tokenized profile.
 *
 * For this SIH 26047 build and evaluation environment, ABHA verification and ABDM
 * connectivity are SIMULATED. Any valid or demo ABHA ID/number is accepted with
 * an asynchronous simulated verification latency.
 */

export interface VerifiedAbhaProfile {
  abhaId: string;
  fullName: string;
  gender: string;
  age: number;
  mobile: string;
  state: string;
  verifiedAt: string;
}

interface AbhaVerificationStepProps {
  onVerified: (profile: VerifiedAbhaProfile) => void;
  initialProfile?: VerifiedAbhaProfile | null;
}

export const AbhaVerificationStep: React.FC<AbhaVerificationStepProps> = ({
  onVerified,
  initialProfile,
}) => {
  const [abhaInput, setAbhaInput] = useState<string>(
    initialProfile?.abhaId || '91-8765-4321-0987'
  );
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verifiedProfile, setVerifiedProfile] = useState<VerifiedAbhaProfile | null>(
    initialProfile || null
  );
  const [error, setError] = useState<string | null>(null);

  // Quick preset demo identities for rapid demonstration in hackathons
  const demoProfiles = [
    { label: 'Synthetic Demo Patient 1', id: '91-2345-6789-0123', name: 'SYNTHETIC DEMO PATIENT', age: 48, gender: 'Male' },
    { label: 'Synthetic Demo Patient 2', id: 'synthetic.demo@abdm', name: 'SYNTHETIC DEMO PATIENT (F)', age: 38, gender: 'Female' },
  ];

  const handleVerify = (customId?: string) => {
    const idToVerify = (customId || abhaInput).trim();
    if (!idToVerify) {
      setError('Please enter your 14-digit ABHA Number or ABHA Address.');
      return;
    }

    setError(null);
    setIsVerifying(true);

    // Simulate ABDM Gateway network latency (1.0s)
    setTimeout(() => {
      setIsVerifying(false);

      // Match demo identity or generate fallback for custom inputs
      const matched = demoProfiles.find((p) => p.id.toLowerCase() === idToVerify.toLowerCase());
      const profile: VerifiedAbhaProfile = {
        abhaId: idToVerify,
        fullName: matched ? matched.name : 'SYNTHETIC DEMO PATIENT',
        gender: matched ? matched.gender : 'Male',
        age: matched ? matched.age : 48,
        mobile: '+91 00000 00000 (DEMO)',
        state: 'New Delhi, DL',
        verifiedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setVerifiedProfile(profile);
    }, 1000);
  };

  const handleConfirmAndProceed = () => {
    if (verifiedProfile) {
      onVerified(verifiedProfile);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center">
      {/* Step Icon Badge */}
      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-teal-500/20 border-2 border-teal-400/40 flex items-center justify-center text-teal-300 mb-5 shadow-xl">
        <CreditCard className="w-10 h-10 sm:w-12 sm:h-12" />
      </div>

      <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-teal-500/10 border border-teal-400/30 text-teal-300 text-xs sm:text-sm font-bold uppercase tracking-wider mb-3">
        <Sparkles className="w-4 h-4" />
        Step 1 • Ayushman Bharat Digital Mission (ABDM)
      </div>

      <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white mb-2 text-center">
        ABHA Identity Verification
      </h1>

      <p className="text-sm sm:text-base text-slate-300 max-w-lg mb-6 text-center leading-relaxed">
        Enter your 14-digit ABHA ID or ABHA Address to securely link your consultation history.
      </p>

      {/* Simulated Verification Notice */}
      <div className="w-full mb-6 p-3.5 rounded-2xl bg-slate-900/90 border border-teal-500/30 text-xs text-slate-300 flex items-center gap-3">
        <span className="px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 font-bold uppercase text-[10px] tracking-wide shrink-0 border border-teal-400/30">
          Simulated ABDM
        </span>
        <span className="text-slate-400 leading-normal">
          Demo sandbox environment for SIH 26047. Real ABDM M1/M2 gateway connectivity is simulated for kiosk walkthrough.
        </span>
      </div>

      {/* Verification Card & Input */}
      {!verifiedProfile ? (
        <div className="w-full bg-slate-900/90 border-2 border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-sm flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label htmlFor="kiosk-abha-input" className="text-sm font-bold text-slate-200">
              ABHA Number or Health ID
            </label>
            <div className="relative">
              <input
                id="kiosk-abha-input"
                type="text"
                value={abhaInput}
                onChange={(e) => {
                  setAbhaInput(e.target.value);
                  setError(null);
                }}
                placeholder="e.g. 91-8765-4321-0987 or user@abdm"
                disabled={isVerifying}
                className="w-full h-16 px-5 rounded-2xl bg-slate-950 border-2 border-slate-700 focus:border-teal-400 text-white font-mono text-lg sm:text-xl placeholder:text-slate-600 focus:outline-none transition-all shadow-inner"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                <QrCode className="w-7 h-7" />
              </div>
            </div>
            {error && <p className="text-xs text-red-400 font-semibold mt-1">{error}</p>}
          </div>

          {/* Quick Demo Pre-fill Chips */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-slate-400">Quick Demo ABHA Profiles:</span>
            <div className="flex flex-wrap gap-2">
              {demoProfiles.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setAbhaInput(p.id);
                    handleVerify(p.id);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <User className="w-3.5 h-3.5 text-teal-400" />
                  <span>{p.label} ({p.name})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Action Trigger */}
          <button
            id="kiosk-verify-abha-btn"
            type="button"
            onClick={() => handleVerify()}
            disabled={isVerifying}
            className="w-full h-16 rounded-2xl bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-400 hover:to-blue-500 text-slate-950 font-black text-lg transition-all cursor-pointer flex items-center justify-center gap-3 shadow-xl active:scale-98 disabled:opacity-50"
          >
            {isVerifying ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>Verifying ABHA via ABDM Sandbox...</span>
              </>
            ) : (
              <>
                <span>Verify & Pull Profile</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      ) : (
        /* Verified Profile Display Card */
        <div className="w-full bg-slate-900/90 border-2 border-emerald-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-sm flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                <UserCheck className="w-7 h-7" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  ABDM Verified Identity
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-white">{verifiedProfile.fullName}</h3>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Verified</span>
            </span>
          </div>

          {/* Demographic Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-left">
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
              <span className="text-[11px] font-bold text-slate-500 uppercase">ABHA ID</span>
              <p className="font-mono text-sm text-teal-300 font-bold truncate mt-0.5">{verifiedProfile.abhaId}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Age / Gender</span>
              <p className="text-sm text-white font-bold mt-0.5">
                {verifiedProfile.age} Yrs • {verifiedProfile.gender}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 col-span-2 sm:col-span-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Region</span>
              <p className="text-sm text-white font-bold mt-0.5 truncate">{verifiedProfile.state}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setVerifiedProfile(null);
                setAbhaInput('');
              }}
              className="sm:w-1/3 h-14 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm border border-slate-700 transition-all cursor-pointer"
            >
              Change ID
            </button>
            <button
              id="kiosk-proceed-consent-btn"
              type="button"
              onClick={handleConfirmAndProceed}
              className="sm:flex-1 h-14 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-300 hover:to-teal-400 text-slate-950 font-black text-lg transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xl active:scale-98"
            >
              <span>Confirm & Proceed to Consent</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
