import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n/LanguageContext';
import {
  CreditCard,
  ShieldCheck,
  Stethoscope,
  UploadCloud,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Volume2,
  VolumeX,
  Globe,
  AlertTriangle,
  X,
  HeartPulse,
  Sparkles,
  Building2,
  Radio,
  FileCode,
  Send,
  Loader2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Lock,
} from 'lucide-react';
import { AbhaVerificationStep, VerifiedAbhaProfile } from './AbhaVerificationStep';
import { ConsentStep, ConsentPreferences } from './ConsentStep';
import { DepartmentSelectionStep } from './DepartmentSelectionStep';
import { InterviewEngine } from './InterviewEngine';
import { DocumentUploadStep } from './DocumentUploadStep';
import { PatientInfo, SOAPNote, StructuredPatientIntake, UploadedDocumentRecord } from '../../types';
import {
  generatePhysicianReadyIntakeSummary,
  PhysicianReadySummaryResult,
} from '../../utils/intakeSummaryGenerator';
import {
  exportToFHIRBundle,
  pushFHIRBundleToABDM,
  FHIRBundle,
  ABDMPushReceipt,
} from '../../utils/fhirConverter';

export type KioskStep = 'abha' | 'consent' | 'department' | 'interview' | 'documents' | 'summary';

interface StepConfig {
  id: KioskStep;
  stepNumber: number;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STEPS: StepConfig[] = [
  {
    id: 'abha',
    stepNumber: 1,
    title: 'ABHA Identity Verification',
    subtitle: 'Enter your 14-digit ABHA ID or scan your Ayushman Bharat QR card',
    icon: CreditCard,
  },
  {
    id: 'consent',
    stepNumber: 2,
    title: 'Patient Informed Consent',
    subtitle: 'Review and approve digital health record processing for this consultation',
    icon: ShieldCheck,
  },
  {
    id: 'department',
    stepNumber: 3,
    title: 'Department & Clinical Mode',
    subtitle: 'Select consultation type: Modern Allopathic OPD or AIIA Ayurveda (AYUSH) OPD',
    icon: Building2,
  },
  {
    id: 'interview',
    stepNumber: 4,
    title: 'Adaptive Clinical Interview',
    subtitle: 'Interactive voice and touch-driven pre-consultation history collection',
    icon: Stethoscope,
  },
  {
    id: 'documents',
    stepNumber: 5,
    title: 'Document & Prescription Upload',
    subtitle: 'Scan previous physical prescriptions, lab tests, or discharge summaries',
    icon: UploadCloud,
  },
  {
    id: 'summary',
    stepNumber: 6,
    title: 'Intake Complete & Handoff',
    subtitle: 'Your intake briefing has been compiled and routed to the doctor',
    icon: CheckCircle2,
  },
];

export interface KioskHandoffData {
  patientInfo: PatientInfo;
  soapNote: SOAPNote;
  formattedStandardHistoryText?: string;
  abdmReceipt: ABDMPushReceipt;
  fhirBundle: FHIRBundle;
}

export interface KioskShellProps {
  onExit: () => void;
  onSwitchToWorkstation?: () => void;
  onOpenTriageQueue?: () => void;
  onCompleteIntakeHandoff?: (data: KioskHandoffData) => void;
}

export const KioskShell: React.FC<KioskShellProps> = ({
  onExit,
  onSwitchToWorkstation,
  onOpenTriageQueue,
  onCompleteIntakeHandoff,
}) => {
  const { language, setLanguage } = useTranslation();
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('step') === 'consent') return 1;
    return 0;
  });
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);
  const [inactivitySeconds, setInactivitySeconds] = useState<number>(120);

  // Kiosk Session State (strictly ephemeral - cleared on reset or submission)
  const [verifiedProfile, setVerifiedProfile] = useState<VerifiedAbhaProfile | null>(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('step') === 'consent') {
      return {
        abhaId: '91-2345-6789-0123',
        fullName: 'SYNTHETIC DEMO PATIENT',
        gender: 'Male',
        age: 48,
        mobile: '+91 00000 00000 (DEMO)',
        state: 'New Delhi, DL',
        verifiedAt: '10:30 AM',
      };
    }
    return null;
  });
  const [consent, setConsent] = useState<ConsentPreferences | null>(null);
  const [clinicalDepartment, setClinicalDepartment] = useState<'Allopathic' | 'Ayurveda (AYUSH)'>('Allopathic');
  const [structuredIntake, setStructuredIntake] = useState<StructuredPatientIntake | null>(null);
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocumentRecord[]>([]);

  // Automatic ABDM Push & Physician-Ready Summary State
  const [physicianSummary, setPhysicianSummary] = useState<PhysicianReadySummaryResult | null>(null);
  const [cachedFhirBundle, setCachedFhirBundle] = useState<FHIRBundle | null>(null);
  const [isPushingABDM, setIsPushingABDM] = useState<boolean>(false);
  const [abdmPushReceipt, setAbdmPushReceipt] = useState<ABDMPushReceipt | null>(null);
  const [showStructuredSections, setShowStructuredSections] = useState<boolean>(false);

  const currentStep = STEPS[currentStepIndex];

  // Inactivity countdown simulation for patient privacy
  useEffect(() => {
    const timer = setInterval(() => {
      setInactivitySeconds((prev) => {
        if (prev <= 1) {
          // Reset to start on timeout to protect patient privacy
          handleReset();
          return 120;
        }
        return prev - 1;
      });
    }, 1000);

    const resetTimer = () => setInactivitySeconds(120);
    window.addEventListener('touchstart', resetTimer);
    window.addEventListener('mousedown', resetTimer);
    window.addEventListener('keydown', resetTimer);

    return () => {
      clearInterval(timer);
      window.removeEventListener('touchstart', resetTimer);
      window.removeEventListener('mousedown', resetTimer);
      window.removeEventListener('keydown', resetTimer);
    };
  }, []);

  // Automatic Physician Summary Generation and ABDM Push upon entering summary step
  useEffect(() => {
    if (currentStep.id === 'summary') {
      const summaryResult = generatePhysicianReadyIntakeSummary(
        structuredIntake,
        verifiedProfile,
        clinicalDepartment,
        uploadedDocs
      );
      setPhysicianSummary(summaryResult);

      const bundle = exportToFHIRBundle(summaryResult.patientInfo, summaryResult.soapNote, {
        abhaId: verifiedProfile?.abhaId,
        department: clinicalDepartment,
        uploadedDocs,
        canonicalFacts: summaryResult.clinicalFacts,
      });
      setCachedFhirBundle(bundle);

      // Automatic push immediately on kiosk-flow completion ONLY IF consent granted
      if (consent?.hospitalSharing) {
        setIsPushingABDM(true);
        pushFHIRBundleToABDM({
          fhirBundle: bundle,
          patientInfo: summaryResult.patientInfo,
          abhaId: verifiedProfile?.abhaId,
          department: clinicalDepartment,
          kioskStationId: 'KIOSK-TER-01',
          structuredSummary: summaryResult,
        })
          .then((receipt) => {
            setAbdmPushReceipt(receipt);
          })
          .catch((err) => {
            console.error('Kiosk auto ABDM push error:', err);
          })
          .finally(() => {
            setIsPushingABDM(false);
          });
      } else {
        console.info('Kiosk auto ABDM push suppressed: hospitalSharing consent not granted by patient.');
      }
    }
  }, [currentStep.id, structuredIntake, verifiedProfile, clinicalDepartment, uploadedDocs, consent]);

  const handleNext = () => {
    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  /**
   * Clears all kiosk session data immediately.
   * Public terminal hygiene: Never persists patient information to localStorage or disk.
   */
  const handleReset = () => {
    setVerifiedProfile(null);
    setConsent(null);
    setClinicalDepartment('Allopathic');
    setStructuredIntake(null);
    setUploadedDocs([]);
    setPhysicianSummary(null);
    setCachedFhirBundle(null);
    setAbdmPushReceipt(null);
    setShowStructuredSections(false);
    setCurrentStepIndex(0);
    setInactivitySeconds(120);

    try {
      sessionStorage.clear();
      localStorage.removeItem('medikiosk_active_session');
      localStorage.removeItem('medikiosk_temp_intake');
    } catch {
      // ignore
    }
  };

  /**
   * Submits pre-consultation briefing to the clinician workstation and clears kiosk terminal memory immediately.
   */
  const handleHandoffToDoctorWorkstation = () => {
    const summary =
      physicianSummary ||
      generatePhysicianReadyIntakeSummary(
        structuredIntake,
        verifiedProfile,
        clinicalDepartment,
        uploadedDocs
      );

    const bundle =
      cachedFhirBundle ||
      exportToFHIRBundle(summary.patientInfo, summary.soapNote, {
        abhaId: verifiedProfile?.abhaId,
        department: clinicalDepartment,
        uploadedDocs,
        canonicalFacts: summary.clinicalFacts,
      });

    const receipt: ABDMPushReceipt = consent?.hospitalSharing
      ? (abdmPushReceipt || {
          success: true,
          transactionId: `ABDM-MOCK-TX-${Date.now()}-AUTO`,
          status: 'ACCEPTED_BY_HIS',
          mockGateway: 'National Health Stack / ABDM Health Information Exchange (Mock Gateway)',
          disclaimer:
            'Simulated ABDM/HIS gateway for Smart India Hackathon 26047 testing. No live NHA ABDM production credentials claimed.',
          timestamp: new Date().toISOString(),
          bundleId: bundle.id,
          resourceCounts: {
            Patient: 1,
            Encounter: 1,
            Composition: 1,
            Condition: summary.soapNote.billing_suggestions?.icd_10_codes?.length || 2,
            MedicationRequest: summary.soapNote.plan?.prescriptions?.length || 0,
            Observation: uploadedDocs.reduce(
              (acc, d) => acc + (d.extractedData?.investigations?.length || 0),
              0
            ),
          },
        })
      : {
          success: false,
          transactionId: 'LOCAL-ONLY-NO-CONSENT',
          status: 'BLOCKED_BY_PATIENT_CONSENT',
          mockGateway: 'Local Clinical Storage (External ABDM Sync Suppressed)',
          disclaimer:
            'Patient withheld hospitalSharing consent. Digital health record kept sovereign and on-device only.',
          timestamp: new Date().toISOString(),
          bundleId: bundle.id,
          resourceCounts: {},
        };

    if (onCompleteIntakeHandoff) {
      onCompleteIntakeHandoff({
        patientInfo: summary.patientInfo,
        soapNote: summary.soapNote,
        formattedStandardHistoryText: summary.formattedStandardHistoryText,
        abdmReceipt: receipt,
        fhirBundle: bundle,
      });
    }

    // Immediately clear all kiosk session data to guarantee public terminal privacy
    handleReset();

    if (onSwitchToWorkstation) {
      onSwitchToWorkstation();
    }
  };


  const StepIcon = currentStep.icon;

  return (
    <div
      id="kiosk-terminal-root"
      className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col justify-between select-none overflow-y-auto font-sans"
    >
      {/* KIOSK HEADER: Institutional Branding, Language, & Kiosk Step Progress */}
      <header className="bg-slate-900/95 border-b border-slate-800 px-4 sm:px-8 py-4 shrink-0 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          {/* Brand Identity */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-400">
              <HeartPulse className="w-7 h-7 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl sm:text-2xl font-black tracking-tight text-white">MediKiosk</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 uppercase tracking-wide">
                  SIH 26047
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                All India Institute of Ayurveda & Ministry of AYUSH • OPD Intake
              </p>
            </div>
          </div>

          {/* Prominent Language Selector & Voice Guidance */}
          <div className="flex items-center gap-3">
            {/* Audio Guidance Toggle */}
            <button
              id="kiosk-audio-toggle"
              onClick={() => setAudioEnabled((prev) => !prev)}
              aria-label="Toggle Voice Guidance"
              className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-center ${
                audioEnabled
                  ? 'bg-teal-500/20 border-teal-400/50 text-teal-300 hover:bg-teal-500/30'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
              }`}
              title={audioEnabled ? 'Voice Guidance Active' : 'Voice Guidance Muted'}
            >
              {audioEnabled ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
            </button>

            {/* Language Selector Buttons */}
            <div className="flex items-center p-1 bg-slate-800 rounded-2xl border border-slate-700">
              <button
                id="kiosk-lang-en"
                onClick={() => setLanguage('en')}
                className={`px-4 py-2.5 rounded-xl font-bold text-sm sm:text-base transition-all cursor-pointer flex items-center gap-2 ${
                  language === 'en'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                }`}
              >
                <Globe className="w-4 h-4" />
                <span>English</span>
              </button>
              <button
                id="kiosk-lang-hi"
                onClick={() => setLanguage('hi')}
                className={`px-4 py-2.5 rounded-xl font-bold text-sm sm:text-base transition-all cursor-pointer flex items-center gap-2 ${
                  language === 'hi'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                }`}
              >
                <Globe className="w-4 h-4" />
                <span>हिन्दी</span>
              </button>
            </div>

            {/* Staff Triage Queue Shortcut */}
            {onOpenTriageQueue && (
              <button
                id="kiosk-header-triage-btn"
                onClick={onOpenTriageQueue}
                className="px-3.5 py-2.5 rounded-2xl bg-red-950/60 hover:bg-red-900/80 border border-red-700/60 text-red-300 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                title="Open Hospital Staff Triage Queue"
              >
                <Radio className="w-3.5 h-3.5 text-red-400 animate-pulse" />
                <span className="hidden sm:inline">Triage Queue</span>
              </button>
            )}

            {/* Exit to Clinician Mode Button */}
            <button
              id="kiosk-exit-btn"
              onClick={() => setShowExitConfirm(true)}
              className="px-3.5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
              title="Staff Exit"
            >
              Exit Kiosk
            </button>
          </div>
        </div>

        {/* STEP PROGRESS BAR: Large Icon-Driven Navigation */}
        <div className="max-w-6xl mx-auto mt-5 pt-4 border-t border-slate-800/80">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
            {STEPS.map((step, idx) => {
              const Icon = step.icon;
              const isActive = idx === currentStepIndex;
              const isPast = idx < currentStepIndex;

              return (
                <button
                  key={step.id}
                  id={`kiosk-step-${step.id}`}
                  onClick={() => setCurrentStepIndex(idx)}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-2 p-2 sm:p-2.5 rounded-2xl border transition-all cursor-pointer text-center sm:text-left ${
                    isActive
                      ? 'bg-teal-500/20 border-teal-400 text-teal-300 shadow-lg shadow-teal-950/40 ring-2 ring-teal-400/30'
                      : isPast
                      ? 'bg-slate-900/90 border-emerald-500/40 text-emerald-400 hover:bg-slate-800'
                      : 'bg-slate-900/40 border-slate-800 text-slate-500 hover:text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div
                    className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs sm:text-sm ${
                      isActive
                        ? 'bg-teal-400 text-slate-950'
                        : isPast
                        ? 'bg-emerald-500/30 text-emerald-300'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isPast ? <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" /> : <Icon className="w-4 h-4 sm:w-5 sm:h-5" />}
                  </div>
                  <div className="hidden lg:block overflow-hidden">
                    <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                      Step {step.stepNumber}
                    </div>
                    <div className="text-xs font-extrabold truncate">{step.title}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* KIOSK MAIN STAGE */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-8 py-8 flex flex-col justify-center items-center">
        {currentStep.id === 'abha' ? (
          <AbhaVerificationStep
            initialProfile={verifiedProfile}
            onVerified={(profile) => {
              setVerifiedProfile(profile);
              handleNext();
            }}
          />
        ) : currentStep.id === 'consent' ? (
          <ConsentStep
            initialConsent={consent || undefined}
            onConsentGiven={(prefs) => {
              setConsent(prefs);
              handleNext();
            }}
            onBack={handleBack}
          />
        ) : currentStep.id === 'department' ? (
          <DepartmentSelectionStep
            selectedDepartment={clinicalDepartment}
            onSelectDepartment={(dept) => {
              setClinicalDepartment(dept);
              handleNext();
            }}
            onBack={handleBack}
          />
        ) : currentStep.id === 'interview' ? (
          <InterviewEngine
            patientDemographics={{
              fullName: verifiedProfile?.fullName || 'Patient',
              age: verifiedProfile?.age || 'Not documented',
              gender: verifiedProfile?.gender || 'Not documented',
              abhaId: verifiedProfile?.abhaId || 'Not documented',
            }}
            clinicalDepartment={clinicalDepartment}
            initialIntake={structuredIntake}
            onComplete={(intake) => {
              setStructuredIntake(intake);
              handleNext();
            }}
            onBackToConsent={handleBack}
          />
        ) : currentStep.id === 'documents' ? (
          <DocumentUploadStep
            documents={uploadedDocs}
            onUpdateDocuments={(docs) => {
              setUploadedDocs(docs);
              if (structuredIntake) {
                setStructuredIntake({
                  ...structuredIntake,
                  uploadedDocuments: docs,
                });
              }
            }}
            onNext={handleNext}
            onBack={handleBack}
            patientContext={{
              name: verifiedProfile?.fullName || 'Patient',
              age: verifiedProfile?.age || 'Not documented',
              gender: verifiedProfile?.gender || 'Not documented',
            }}
          />
        ) : (
          /* Step 6: Intake Complete & Handoff Summary */
          <div className="w-full max-w-4xl bg-slate-900/90 border-2 border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md flex flex-col items-center">
            {/* Step Icon Badge */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-teal-600/20 border-2 border-emerald-400/30 flex items-center justify-center text-emerald-400 mb-4 shadow-xl">
              <CheckCircle2 className="w-9 h-9 sm:w-11 sm:h-11" />
            </div>

            {/* Step Tag */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/30 text-emerald-300 text-xs font-bold uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              Intake Completed • Physician-Ready Briefing Compiled
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-2 text-center">
              Pre-Consultation Briefing Compiled
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 max-w-xl mb-5 leading-relaxed text-center">
              Structured clinical history, SOCRATES symptom mapping, and {uploadedDocs.length} uploaded document(s) have been compiled in standard format and transmitted to the Hospital Information System.
            </p>

            {/* AUTOMATED ABDM / HIS GATEWAY PUSH RECEIPT CARD */}
            <div className="w-full bg-slate-950/80 border border-teal-500/40 rounded-2xl p-4 mb-6 shadow-inner text-left">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-400 shrink-0">
                    <FileCode className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-xs sm:text-sm font-bold text-white">
                        ABDM / HIS Automated Push Status:
                      </strong>
                      {isPushingABDM ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-300 bg-teal-950/80 px-2 py-0.5 rounded-full border border-teal-700">
                          <Loader2 className="w-3 h-3 animate-spin" /> Pushing...
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-700">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Accepted by HIS Gateway
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Mock ABDM / Health Information Exchange Gateway • Queue Room 4
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Transaction ID</span>
                  <span className="text-xs font-mono font-bold text-teal-300">
                    {abdmPushReceipt?.transactionId || `ABDM-MOCK-TX-${Date.now()}`}
                  </span>
                </div>
              </div>

              {/* Resource Count Chips */}
              <div className="pt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-slate-400 font-medium">Transmitted FHIR R4:</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-teal-300 text-[11px] font-mono">
                    Patient (ABHA)
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-teal-300 text-[11px] font-mono">
                    Encounter
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-teal-300 text-[11px] font-mono">
                    Condition (ICD-10)
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-teal-300 text-[11px] font-mono">
                    Composition
                  </span>
                  {uploadedDocs.length > 0 && (
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-teal-300 text-[11px] font-mono">
                      Observations ({uploadedDocs.reduce((acc, d) => acc + (d.extractedData?.investigations?.length || 0), 0)})
                    </span>
                  )}
                </div>

                <span className="text-[10px] text-slate-400 italic">
                  Simulated sandbox endpoint (SIH 26047)
                </span>
              </div>
            </div>

            {/* STRUCTURED PHYSICIAN-READY SUMMARY CARD (Standard Format) */}
            <div className="w-full bg-slate-800/70 border border-slate-700 rounded-2xl p-4 sm:p-5 text-left mb-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-700">
                <div className="flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-teal-400" />
                  <h3 className="text-sm font-bold text-white">
                    Structured Clinical Summary (Standard Physician Format)
                  </h3>
                </div>
                <button
                  onClick={() => setShowStructuredSections((prev) => !prev)}
                  className="text-xs text-teal-400 hover:text-teal-300 flex items-center gap-1 font-bold cursor-pointer"
                >
                  <span>{showStructuredSections ? 'Hide Full Breakdown' : 'Expand Full Breakdown'}</span>
                  {showStructuredSections ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* High-Level Overview Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Patient:</span>
                  <strong className="text-white font-bold">{verifiedProfile?.fullName || 'Patient'}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">ABHA ID:</span>
                  <span className="text-teal-300 font-mono font-bold">{verifiedProfile?.abhaId || 'Not documented'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Clinical Mode:</span>
                  <span className="text-amber-300 font-bold">{clinicalDepartment}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Documents Scanned:</span>
                  <span className="text-emerald-300 font-bold">{uploadedDocs.length} record(s)</span>
                </div>
              </div>

              {/* Standard Format 8-Part Sequence Breakdown */}
              {showStructuredSections ? (
                <div className="space-y-3 pt-3 border-t border-slate-700/80 text-xs">
                  {/* 1. Chief Complaint */}
                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-700">
                    <span className="font-bold text-teal-300 block mb-1">1. Chief Complaint:</span>
                    <p className="text-slate-200">
                      {physicianSummary?.sections.chiefComplaint || structuredIntake?.chiefComplaint || 'Epigastric and retrosternal burning discomfort'}
                    </p>
                  </div>

                  {/* 2. HPI */}
                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-700">
                    <span className="font-bold text-teal-300 block mb-1">2. History of Present Illness (HPI):</span>
                    <p className="text-slate-200 whitespace-pre-line font-mono text-[11px]">
                      {physicianSummary?.sections.hpi}
                    </p>
                  </div>

                  {/* 3. Past Medical & Surgical */}
                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-700">
                    <span className="font-bold text-teal-300 block mb-1">3. Past Medical & Surgical History:</span>
                    <p className="text-slate-200 whitespace-pre-line font-mono text-[11px]">
                      {physicianSummary?.sections.pastMedicalSurgical}
                    </p>
                  </div>

                  {/* 4. Drug & Allergy */}
                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-700">
                    <span className="font-bold text-teal-300 block mb-1">4. Drug & Allergy History:</span>
                    <p className="text-slate-200 whitespace-pre-line font-mono text-[11px]">
                      {physicianSummary?.sections.drugAndAllergy}
                    </p>
                  </div>

                  {/* 5. Family History */}
                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-700">
                    <span className="font-bold text-teal-300 block mb-1">5. Family History:</span>
                    <p className="text-slate-200 whitespace-pre-line font-mono text-[11px]">
                      {physicianSummary?.sections.familyHistory}
                    </p>
                  </div>

                  {/* 6. Personal History */}
                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-700">
                    <span className="font-bold text-teal-300 block mb-1">6. Personal History (Lifestyle / Ahara-Vihara):</span>
                    <p className="text-slate-200 whitespace-pre-line font-mono text-[11px]">
                      {physicianSummary?.sections.personalHistory}
                    </p>
                  </div>

                  {/* 7. Review of Systems */}
                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-700">
                    <span className="font-bold text-teal-300 block mb-1">7. Review of Systems (ROS):</span>
                    <p className="text-slate-200 whitespace-pre-line font-mono text-[11px]">
                      {physicianSummary?.sections.reviewOfSystems}
                    </p>
                  </div>

                  {/* 8. Prior Investigations */}
                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-700">
                    <span className="font-bold text-teal-300 block mb-1">8. Prior Investigations Summary:</span>
                    <p className="text-slate-200 whitespace-pre-line font-mono text-[11px]">
                      {physicianSummary?.sections.priorInvestigationsSummary}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-700 text-xs text-slate-300 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">Chief Complaint:</span>
                    <span className="text-teal-300 truncate max-w-xs sm:max-w-md">
                      {physicianSummary?.sections.chiefComplaint || 'Epigastric burning discomfort & acid reflux'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">Standard Order Compiled:</span>
                    <span className="text-slate-400">
                      Chief Complaint → HPI → Past Medical/Surgical → Drug/Allergy → Family → Personal → ROS → Investigations
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* TERMINAL PRIVACY & SECURITY NOTICE */}
            <div className="w-full bg-slate-950/70 border border-slate-800 rounded-xl p-3 mb-6 flex items-center gap-2.5 text-xs text-slate-400">
              <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong className="text-white">Public Terminal Security:</strong> Kiosk session memory is completely wiped immediately upon finishing or opening the workstation to prevent any retention of patient records on this shared device.
              </span>
            </div>

            {/* ACTION BUTTONS */}
            <div className="w-full max-w-lg flex flex-col sm:flex-row gap-3">
              <button
                id="kiosk-finish-btn"
                onClick={handleHandoffToDoctorWorkstation}
                className="flex-1 h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm sm:text-base transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xl active:scale-95"
              >
                <RotateCcw className="w-5 h-5" />
                <span>Finish & Clear Terminal</span>
              </button>

              <button
                id="kiosk-workstation-handoff-btn"
                onClick={handleHandoffToDoctorWorkstation}
                className="flex-1 h-14 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm sm:text-base transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xl active:scale-95"
              >
                <span>Doctor Workstation</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* KIOSK FOOTER: Privacy Inactivity Reset & Emergency Help */}
      <footer className="bg-slate-900/90 border-t border-slate-800 px-4 sm:px-8 py-3 shrink-0">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-slate-400 flex-wrap gap-2">
          {/* Inactivity Privacy Watchdog */}
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Public terminal active</span>
            <span className="text-slate-600">•</span>
            <span>Privacy reset in <strong className="text-teal-300">{inactivitySeconds}s</strong></span>
            <button
              onClick={() => setInactivitySeconds(120)}
              className="text-teal-400 underline hover:text-teal-300 ml-1 cursor-pointer"
            >
              Extend
            </button>
          </div>

          {/* Quick Reset & Staff Help */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleReset}
              className="hover:text-white transition-colors cursor-pointer flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Screen</span>
            </button>
            <span className="text-slate-600">•</span>
            <span className="text-slate-500">Need help? Ask hospital kiosk attendant</span>
          </div>
        </div>
      </footer>

      {/* Exit Confirmation Modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Exit Public Kiosk Terminal?</h3>
            <p className="text-slate-300 text-sm mb-6">
              This will close the self-service kiosk and return to the clinician workstation or landing page.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm transition-colors cursor-pointer"
              >
                Stay on Kiosk
              </button>
              <button
                onClick={() => {
                  setShowExitConfirm(false);
                  onExit();
                }}
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition-colors cursor-pointer"
              >
                Confirm Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
