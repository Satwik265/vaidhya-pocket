import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'motion/react';
import { Header } from './components/Header';
import { LandingPage } from './components/LandingPage';
import { PatientForm } from './components/PatientForm';
import { TranscriptInput } from './components/TranscriptInput';
import { SOAPNoteView } from './components/SOAPNoteView';
import { SafetyAlertsPanel } from './components/SafetyAlertsPanel';
import { BillingCodingPanel } from './components/BillingCodingPanel';
import { PrintPrescriptionModal } from './components/PrintPrescriptionModal';
import { EncounterHistoryModal } from './components/EncounterHistoryModal';
import { ClinicAnalyticsModal } from './components/ClinicAnalyticsModal';
import { SAMPLE_SCENARIOS } from './data/sampleScenarios';
import { PatientInfo, SOAPNote, EncounterRecord } from './types';
import { Sparkles, AlertCircle, FileText, CheckCircle2, RotateCcw, HeartPulse, Stethoscope, FileCode } from 'lucide-react';

import { checkDrugInteractions } from './utils/drugInteractionChecker';
import { generateOfflineSOAPNote } from './utils/offlineLocalEngine';
import { FHIRExportModal } from './components/soap-note';
import { KioskShell, KioskHandoffData } from './components/kiosk';
import { TriageQueue } from './components/triage';
import { ABDMPushReceipt } from './utils/fhirConverter';
import { Radio } from 'lucide-react';

const STORAGE_KEY = 'medscribe_lite_encounters_v1';

export default function App() {
  // Navigation view state: 'landing' | 'workstation' | 'kiosk' | 'triage'
  const [currentView, setCurrentView] = useState<'landing' | 'workstation' | 'kiosk' | 'triage'>(() => {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    if (hash === '#triage' || search.includes('view=triage')) return 'triage';
    if (hash === '#kiosk' || search.includes('view=kiosk')) return 'kiosk';
    if (hash === '#workstation' || search.includes('view=workstation')) return 'workstation';
    return 'landing';
  });

  // Active Emergency Triage Alert Counter
  const [activeTriageCount, setActiveTriageCount] = useState<number>(0);

  // Default patient info
  const defaultPatientInfo: PatientInfo = {
    name: 'SYNTHETIC DEMO PATIENT',
    age: 48,
    sex: 'Male',
    medicalHistory: 'Hypertension under evaluation. Prior episode of malaria 2 years ago.',
    currentMedications: 'Paracetamol 500mg PRN',
    knownAllergies: 'None documented / Not elicited',
    encounterType: 'Acute Unscheduled Visit',
    clinicLocation: 'Sub-District Health Center',
  };

  // Offline local model mode state
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(() => {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    return search.includes('demo=') || search.includes('offline=true');
  });

  // Kiosk Handoff Data for Physician Confirmation Screen
  const [kioskHandoffData, setKioskHandoffData] = useState<KioskHandoffData | null>(null);

  const [patientInfo, setPatientInfo] = useState<PatientInfo>(defaultPatientInfo);
  const [transcript, setTranscript] = useState<string>(SAMPLE_SCENARIOS[0].transcript);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(SAMPLE_SCENARIOS[0].id);

  const [soapNote, setSoapNote] = useState<SOAPNote | null>(() => {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    if (search.includes('demo=')) {
      return generateOfflineSOAPNote(defaultPatientInfo, SAMPLE_SCENARIOS[0].transcript);
    }
    return null;
  });
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [approvalState, setApprovalState] = useState<'AI_DRAFT' | 'REVIEWING' | 'APPROVED'>(() => {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    if (search.includes('demo=approved') || search.includes('demo=fhir')) return 'APPROVED';
    return 'AI_DRAFT';
  });

  // Modals state
  const [activeModal, setActiveModal] = useState<'history' | 'analytics' | 'print' | 'fhir' | null>(() => {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    if (search.includes('demo=fhir')) return 'fhir';
    return null;
  });

  // Saved encounters history in localStorage
  const [encounters, setEncounters] = useState<EncounterRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Save encounters array to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(encounters));
    } catch (e) {
      console.error('Failed to save encounters to localStorage:', e);
    }
  }, [encounters]);

  // Listen for route hash or query parameters (e.g. #triage, #kiosk)
  useEffect(() => {
    const handleHashChange = () => {
      const search = window.location.search;
      const params = new URLSearchParams(search);
      if (window.location.hash === '#triage' || search.includes('view=triage')) {
        setCurrentView('triage');
      } else if (window.location.hash === '#kiosk' || search.includes('view=kiosk')) {
        setCurrentView('kiosk');
      } else if (window.location.hash === '#workstation' || search.includes('view=workstation')) {
        setCurrentView('workstation');
      }

      if (params.get('demo') === 'generated') {
        const note = generateOfflineSOAPNote(defaultPatientInfo, SAMPLE_SCENARIOS[0].transcript);
        setSoapNote(note);
        setIsOfflineMode(true);
      } else if (params.get('demo') === 'approved') {
        const note = generateOfflineSOAPNote(defaultPatientInfo, SAMPLE_SCENARIOS[0].transcript);
        setSoapNote(note);
        setIsOfflineMode(true);
        setApprovalState('APPROVED');
      } else if (params.get('demo') === 'fhir') {
        const note = generateOfflineSOAPNote(defaultPatientInfo, SAMPLE_SCENARIOS[0].transcript);
        setSoapNote(note);
        setIsOfflineMode(true);
        setApprovalState('APPROVED');
        setActiveModal('fhir');
      }
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Monitor active emergency triage alerts count for badges
  useEffect(() => {
    const checkActiveTriage = () => {
      try {
        const raw = localStorage.getItem('medscribe_triage_alerts_v1');
        if (raw) {
          const alerts = JSON.parse(raw);
          const active = alerts.filter((a: any) => a.status === 'active' || a.status === 'staff_en_route').length;
          setActiveTriageCount(active);
        } else {
          setActiveTriageCount(0);
        }
      } catch {
        // ignore
      }
    };
    checkActiveTriage();
    const interval = setInterval(checkActiveTriage, 2500);
    window.addEventListener('storage', checkActiveTriage);
    window.addEventListener('triage-alert-updated', checkActiveTriage);
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', checkActiveTriage);
      window.removeEventListener('triage-alert-updated', checkActiveTriage);
    };
  }, []);

  // Load a sample scenario
  const handleSelectScenario = (scenarioId: string) => {
    const scenario = SAMPLE_SCENARIOS.find((s) => s.id === scenarioId);
    if (!scenario) return;

    setSelectedScenarioId(scenario.id);
    setPatientInfo(scenario.patientInfo);
    setTranscript(scenario.transcript);
    setErrorMessage(null);
  };

  // Reset Form
  const handleResetForm = () => {
    setPatientInfo({
      name: '',
      age: '',
      sex: 'Male',
      medicalHistory: '',
      currentMedications: '',
      knownAllergies: 'None documented / Not elicited',
      encounterType: 'Primary Care Consultation',
      clinicLocation: 'Primary Care Clinic',
    });
    setTranscript('');
    setSelectedScenarioId('');
    setSoapNote(null);
    setErrorMessage(null);
    setKioskHandoffData(null);
  };

  // Generate SOAP note with the on-device engine (no cloud path)
  const handleGenerateSOAP = async (audioData?: { base64: string; mimeType: string }) => {
    setIsGenerating(true);
    setErrorMessage(null);

    // If Offline Mode is active, bypass backend network call completely
    if (isOfflineMode) {
      setTimeout(() => {
        const offlineNote = generateOfflineSOAPNote(patientInfo, transcript);
        setSoapNote(offlineNote);
        setIsGenerating(false);
        const soapElem = document.getElementById('soap-result-anchor');
        if (soapElem) {
          soapElem.scrollIntoView({ behavior: 'smooth' });
        }
      }, 400);
      return;
    }

    // Sovereign mode: the SOAP draft is always produced on-device. No cloud generation route exists.
    try {
      const localNote = generateOfflineSOAPNote(patientInfo, transcript);
      setSoapNote(localNote);
      setTimeout(() => {
        const soapElem = document.getElementById('soap-result-anchor');
        if (soapElem) {
          soapElem.scrollIntoView({ behavior: 'smooth' });
        }
      }, 150);
    } catch (err: any) {
      console.error('On-device SOAP generation failed:', err);
      setErrorMessage('On-device SOAP generation failed. Please review the transcript and retry.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Save current encounter to localStorage history
  const handleSaveEncounter = () => {
    if (!soapNote) return;

    const newRecord: EncounterRecord = {
      id: `enc-${Date.now()}`,
      timestamp: new Date().toISOString(),
      patientInfo,
      transcript,
      soapNote,
      status: 'finalized',
    };

    setEncounters((prev) => [newRecord, ...prev]);
    alert('Encounter saved successfully to clinic local records!');
  };

  // Load an existing encounter from history
  const handleLoadEncounterFromHistory = (record: EncounterRecord) => {
    setPatientInfo(record.patientInfo);
    setTranscript(record.transcript);
    setSoapNote(record.soapNote);
    setActiveModal(null);
  };

  // Delete an encounter from history
  const handleDeleteEncounter = (id: string) => {
    setEncounters((prev) => prev.filter((e) => e.id !== id));
  };

  // Clear all encounters
  const handleClearAllEncounters = () => {
    if (confirm('Are you sure you want to clear all saved encounter records?')) {
      setEncounters([]);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  if (currentView === 'landing') {
    return (
      <div className="relative">
        <LandingPage onLaunchWorkstation={() => setCurrentView('workstation')} />
        {/* Floating Quick Action Buttons */}
        <div className="fixed bottom-5 right-5 z-50 flex flex-col sm:flex-row items-end sm:items-center gap-2.5">
          <button
            id="launch-triage-from-landing"
            onClick={() => setCurrentView('triage')}
            className={`flex items-center gap-2 px-5 py-3.5 rounded-full font-black shadow-2xl border-2 transition-all text-xs sm:text-sm cursor-pointer ${
              activeTriageCount > 0
                ? 'bg-red-600 text-white border-red-400 animate-pulse'
                : 'bg-slate-900 text-red-300 border-red-700/80 hover:bg-slate-800'
            }`}
          >
            <Radio className="w-4 h-4 text-red-400" />
            <span>Staff Triage Queue</span>
            {activeTriageCount > 0 && (
              <span className="bg-white text-red-600 px-1.5 py-0.2 rounded-full font-black text-xs">
                {activeTriageCount}
              </span>
            )}
          </button>

          <button
            id="launch-kiosk-from-landing"
            onClick={() => setCurrentView('kiosk')}
            className="flex items-center gap-2.5 px-6 py-3.5 rounded-full bg-teal-500 hover:bg-teal-400 text-slate-950 font-black shadow-2xl border-2 border-teal-300 hover:scale-105 transition-all text-sm cursor-pointer"
          >
            <span className="w-3 h-3 rounded-full bg-emerald-950 animate-ping" />
            <span>Launch MediKiosk (Public Terminal)</span>
          </button>
        </div>
      </div>
    );
  }

  if (currentView === 'kiosk') {
    return (
      <KioskShell
        onExit={() => setCurrentView('landing')}
        onSwitchToWorkstation={() => setCurrentView('workstation')}
        onOpenTriageQueue={() => setCurrentView('triage')}
        onCompleteIntakeHandoff={(handoff) => {
          setPatientInfo(handoff.patientInfo);
          setSoapNote(handoff.soapNote);
          if (handoff.formattedStandardHistoryText) {
            setTranscript(handoff.formattedStandardHistoryText);
          }
          setKioskHandoffData(handoff);
          setCurrentView('workstation');
        }}
      />
    );
  }

  if (currentView === 'triage') {
    return (
      <TriageQueue
        onNavigateToWorkstation={() => setCurrentView('workstation')}
        onNavigateToKiosk={() => setCurrentView('kiosk')}
        onSelectPatientForConsultation={(alert) => {
          setPatientInfo({
            ...defaultPatientInfo,
            name: alert.patientName,
            age: alert.age,
            sex: alert.gender as any,
            medicalHistory: `Emergency Triage Alert at ${alert.kioskStationId}: ${alert.detectedPattern}`,
            encounterType: 'Acute Emergency Triage Handoff',
          });
          setTranscript(`Patient: ${alert.patientName} (${alert.age}y, ${alert.gender}).
ABHA ID: ${alert.abhaId || 'Not documented'}.
Location: ${alert.kioskStationId}.
Emergency Category: ${alert.emergencyCategory}.
Detected Pattern: ${alert.detectedPattern}.
Patient's Exact Complaint: "${alert.triggerInputText}".
Action Directives: ${alert.actionDirectives.join('; ')}.`);
          setCurrentView('workstation');
        }}
      />
    );
  }

  return (
    <div id="app-root" className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Banner for Kiosk Terminal Switcher */}
      <div className="bg-gradient-to-r from-teal-900/90 via-slate-900 to-blue-900/90 text-white px-4 sm:px-8 py-2 text-xs sm:text-sm flex flex-wrap items-center justify-between gap-2 border-b border-teal-700/50">
        <div className="flex items-center gap-2">
          <span className="bg-teal-400 text-slate-950 text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-black uppercase tracking-wide">
            SIH 26047
          </span>
          <span className="font-semibold text-teal-100">Patient Self-Service MediKiosk & Staff Triage Active</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            id="switch-to-triage-from-workstation"
            onClick={() => setCurrentView('triage')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
              activeTriageCount > 0
                ? 'bg-red-600 hover:bg-red-500 text-white border-red-400 animate-pulse'
                : 'bg-red-950/70 hover:bg-red-900 border-red-700 text-red-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-red-400" />
            <span>Staff Triage Queue</span>
            {activeTriageCount > 0 && (
              <span className="bg-white text-red-700 px-1.5 py-0.2 rounded-full font-black text-[10px]">
                {activeTriageCount}
              </span>
            )}
          </button>

          <button
            id="switch-to-kiosk-from-workstation"
            onClick={() => setCurrentView('kiosk')}
            className="bg-teal-400 hover:bg-teal-300 text-slate-950 font-bold px-3 py-1 rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1.5"
          >
            <span>Open Kiosk Terminal</span>
            <span>→</span>
          </button>
        </div>
      </div>

      {/* Top Navigation Bar */}
      <Header
        onOpenHistory={() => setActiveModal('history')}
        onOpenAnalytics={() => setActiveModal('analytics')}
        onSelectSampleScenario={() => {
          // Cycle or open first scenario
          handleSelectScenario(SAMPLE_SCENARIOS[0].id);
        }}
        onNavigateToLanding={() => setCurrentView('landing')}
        onNavigateToTriage={() => setCurrentView('triage')}
        activeTriageAlertsCount={activeTriageCount}
        totalEncountersCount={encounters.length}
        safetyAlertsCount={soapNote?.safety_alerts?.length || 0}
        isOfflineMode={isOfflineMode}
        onToggleOfflineMode={() => setIsOfflineMode((prev) => !prev)}
      />

      {/* Main Workspace Body */}
      <main id="main-content" className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Banner / Low Resource Primary Care Intro */}
        <div id="intro-banner" className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"></span>
              <h2 className="font-bold text-base text-slate-800 tracking-tight">Clinical Documentation & Safety Engine</h2>
            </div>
            <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
              Transform consultation transcripts into verified SOAP notes, ICD-10/CPT coding, and safety alerts. Built for low-resource primary care clinics.
            </p>
          </div>

          <div className="flex items-center space-x-2 text-xs text-blue-700 bg-blue-50 px-3 py-2 rounded-xl border border-blue-100 font-semibold">
            <HeartPulse className="w-4 h-4 text-blue-600 shrink-0" />
            <span>100% Fact Extraction Guardrails</span>
          </div>
        </div>

        {/* Error Alert Message */}
        {errorMessage && (
          <div id="error-banner" className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-2xl text-xs flex items-center justify-between shadow-xs">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <span className="font-medium">{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-700 hover:text-red-900 font-bold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Top Grid: Patient Information Form */}
        <PatientForm
          patientInfo={patientInfo}
          onChange={setPatientInfo}
          onReset={handleResetForm}
        />

        {/* Transcript Input Workspace */}
        <TranscriptInput
          transcript={transcript}
          onChangeTranscript={setTranscript}
          onSelectScenario={handleSelectScenario}
          onGenerateSOAP={handleGenerateSOAP}
          isGenerating={isGenerating}
          selectedScenarioId={selectedScenarioId}
          isOfflineMode={isOfflineMode}
        />

        {/* Anchor point for smooth auto-scroll */}
        <div id="soap-result-anchor"></div>

        {/* SOAP Note Output & Safety Panels */}
        {soapNote || isGenerating ? (
          <div className="space-y-6 pt-2">
            {/* Physician Confirmation Screen (reusing standard SOAP presentation for incoming kiosk patient) */}
            {kioskHandoffData && soapNote && (
              <div
                id="physician-confirmation-screen"
                className="bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-950 border-2 border-teal-500/50 rounded-2xl p-5 text-white shadow-xl space-y-4"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-indigo-800/80">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-300">
                      <Stethoscope className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                          Physician Confirmation Screen
                        </h2>
                        <span className="bg-teal-400 text-slate-950 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
                          Patient In Consultation Room
                        </span>
                      </div>
                      <p className="text-xs text-indigo-200 font-medium">
                        Standard 8-part sequence pre-intake briefing automatically compiled & pushed to ABDM/HIS gateway
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-stretch sm:self-auto">
                    <button
                      id="view-fhir-bundle-btn"
                      onClick={() => setActiveModal('fhir')}
                      className="flex-1 sm:flex-none px-3 py-1.5 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 border border-teal-400/40 text-teal-200 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <FileCode className="w-3.5 h-3.5" />
                      <span>ABDM FHIR Bundle</span>
                    </button>
                    <button
                      id="accept-and-sign-note-btn"
                      onClick={() => {
                        handleSaveEncounter();
                        setKioskHandoffData(null);
                      }}
                      className="flex-1 sm:flex-none px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md active:scale-95"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Accept & Sign</span>
                    </button>
                  </div>
                </div>

                {/* Status Badges: Standard Sequence + Auto-Push Receipt + Zero Retention */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-indigo-900/60">
                    <span className="text-[10px] uppercase font-bold text-indigo-300 block">ABDM Push Gateway</span>
                    <span className="text-emerald-400 font-semibold flex items-center gap-1 mt-0.5 text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">TX: {kioskHandoffData.abdmReceipt.transactionId}</span>
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-indigo-900/60">
                    <span className="text-[10px] uppercase font-bold text-indigo-300 block">Standard Format</span>
                    <span className="text-slate-200 font-medium truncate block mt-0.5 text-[11px]">
                      Chief Complaint → HPI → Past Med → Allergies → ROS → Labs
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-indigo-900/60">
                    <span className="text-[10px] uppercase font-bold text-indigo-300 block">Kiosk Terminal Memory</span>
                    <span className="text-teal-300 font-medium flex items-center gap-1 mt-0.5 text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" /> Wiped immediately on submission
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Safety Alerts Panel */}
            {soapNote && (() => {
              const dbAlerts = checkDrugInteractions(
                soapNote.plan?.prescriptions || [],
                `${patientInfo.currentMedications || ''} ${soapNote.subjective?.current_medications?.join(' ') || ''}`,
                patientInfo.medicalHistory || '',
                `${patientInfo.knownAllergies || ''} ${soapNote.subjective?.allergies?.join(' ') || ''}`
              );

              const existingAlerts = soapNote.safety_alerts || [];
              const combinedAlerts = [...existingAlerts];
              dbAlerts.forEach((dbAlert) => {
                if (!combinedAlerts.some((a) => a.message === dbAlert.message)) {
                  combinedAlerts.push(dbAlert);
                }
              });

              return (
                <SafetyAlertsPanel
                  safetyAlerts={combinedAlerts}
                  meta={soapNote.meta || { uncertainty_flagged: false, time_saved_estimate_minutes: 12 }}
                />
              );
            })()}

            {/* SOAP Note View */}
            <SOAPNoteView
              soapNote={soapNote}
              isGenerating={isGenerating}
              isOfflineMode={isOfflineMode}
              approvalState={approvalState}
              onApprove={() => setApprovalState('APPROVED')}
              onUpdateSOAP={(updated) => {
                setSoapNote(updated);
                if (approvalState === 'APPROVED') {
                  setApprovalState('REVIEWING');
                }
              }}
              onOpenPrintPrescription={() => {
                if (approvalState !== 'APPROVED') {
                  alert('Physician Approval Required: Prescriptions can only be printed after physician review and approval.');
                  return;
                }
                setActiveModal('print');
              }}
              onOpenFHIR={() => {
                if (approvalState !== 'APPROVED') {
                  alert('Physician Approval Required: FHIR bundle export is restricted until clinical review is approved.');
                  return;
                }
                setActiveModal('fhir');
              }}
              onSaveEncounter={handleSaveEncounter}
            />

            {/* Billing & Coding Suggestions Panel */}
            {soapNote && (
              <BillingCodingPanel
                billingSuggestions={soapNote.billing_suggestions || { icd_10_codes: [], cpt_codes: [] }}
              />
            )}
          </div>
        ) : (
          <div id="empty-state-card" className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 text-sm">Clinical Safety Copilot Ready</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Enter or dictate a patient consultation transcript above, or click one of the pre-loaded clinical scenarios (e.g. Malaria, Diabetes, Pediatrics) to generate verified SOAP notes with automatic drug interaction and clinical safety guardrail auditing.
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer id="app-footer" className="border-t border-slate-200 bg-white py-4 mt-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© MedScribe Lite • Primary Care AI Clinical Assistant</p>
          <p className="text-[11px] text-slate-400 font-medium">On-device • Zero cloud calls • Bento Grid Edition</p>
        </div>
      </footer>

      {/* Modals with AnimatePresence exit animations */}
      <AnimatePresence>
        {activeModal === 'print' && soapNote && (
          <PrintPrescriptionModal
            key="print-modal"
            patientInfo={patientInfo}
            soapNote={soapNote}
            isApproved={approvalState === 'APPROVED'}
            onClose={() => setActiveModal(null)}
          />
        )}

        {activeModal === 'fhir' && soapNote && (
          <FHIRExportModal
            key="fhir-modal"
            patientInfo={patientInfo}
            soapNote={soapNote}
            isApproved={approvalState === 'APPROVED'}
            hasHospitalSharingConsent={Boolean((patientInfo as any).consent?.hospitalSharing ?? false)}
            onClose={() => setActiveModal(null)}
          />
        )}

        {activeModal === 'history' && (
          <EncounterHistoryModal
            key="history-modal"
            encounters={encounters}
            onLoadEncounter={handleLoadEncounterFromHistory}
            onDeleteEncounter={handleDeleteEncounter}
            onClearAll={handleClearAllEncounters}
            onClose={() => setActiveModal(null)}
          />
        )}

        {activeModal === 'analytics' && (
          <ClinicAnalyticsModal
            key="analytics-modal"
            encounters={encounters}
            onClose={() => setActiveModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
