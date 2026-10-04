import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { X, Copy, Download, Check, FileCode, ShieldCheck, Send, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { PatientInfo, SOAPNote } from '../../types';
import { exportToFHIRBundle, pushFHIRBundleToABDM, FHIRBundle, ABDMPushReceipt } from '../../utils/fhirConverter';

interface FHIRExportModalProps {
  patientInfo: PatientInfo;
  soapNote: SOAPNote;
  isApproved?: boolean;
  hasHospitalSharingConsent?: boolean;
  onClose: () => void;
}

export const FHIRExportModal: React.FC<FHIRExportModalProps> = ({
  patientInfo,
  soapNote,
  isApproved = true,
  hasHospitalSharingConsent = false,
  onClose,
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [fhirBundle, setFhirBundle] = useState<FHIRBundle | null>(null);
  const [isPushing, setIsPushing] = useState<boolean>(false);
  const [abdmReceipt, setAbdmReceipt] = useState<ABDMPushReceipt | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Generate bundle on mount and push only when approved AND consent given
  useEffect(() => {
    const bundle = exportToFHIRBundle(patientInfo, soapNote);
    setFhirBundle(bundle);

    // Gated ABDM / HIS transmission
    if (!isApproved) {
      console.warn('FHIR ABDM push blocked: Encounter is in unapproved AI draft state.');
      return;
    }
    if (!hasHospitalSharingConsent) {
      console.info('FHIR ABDM push suppressed: Patient has not granted hospital sharing consent.');
      return;
    }

    let isMounted = true;
    const performAutoPush = async () => {
      setIsPushing(true);
      try {
        const receipt = await pushFHIRBundleToABDM({
          fhirBundle: bundle,
          patientInfo,
          department: patientInfo.encounterType || 'OPD General Consultation',
        });
        if (isMounted) {
          setAbdmReceipt(receipt);
        }
      } catch (err) {
        console.error('Auto ABDM push error:', err);
      } finally {
        if (isMounted) {
          setIsPushing(false);
        }
      }
    };

    performAutoPush();
    return () => {
      isMounted = false;
    };
  }, [patientInfo, soapNote, isApproved, hasHospitalSharingConsent]);

  // Keyboard trap & Escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const jsonString = fhirBundle ? JSON.stringify(fhirBundle, null, 2) : '';

  const handleCopy = async () => {
    if (!jsonString) return;
    await navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleManualRePush = async () => {
    if (!fhirBundle) return;
    if (!isApproved) {
      alert('Physician Approval Required: Unapproved clinical drafts cannot be pushed to ABDM / HIS.');
      return;
    }
    if (!hasHospitalSharingConsent) {
      alert('Patient Consent Required: Hospital sharing consent has not been granted by the patient.');
      return;
    }
    setIsPushing(true);
    try {
      const receipt = await pushFHIRBundleToABDM({
        fhirBundle,
        patientInfo,
        department: patientInfo.encounterType || 'OPD General Consultation',
      });
      setAbdmReceipt(receipt);
    } catch (err) {
      console.error('Manual re-push error:', err);
    } finally {
      setIsPushing(false);
    }
  };

  const handleDownload = () => {
    if (!jsonString) return;
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (patientInfo.name || 'patient').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    a.href = url;
    a.download = `fhir_bundle_${safeName}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="fhir-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay bg-slate-900/60 backdrop-blur-xs"
    >
      <motion.div
        ref={modalRef}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[88vh] flex flex-col overflow-hidden"
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 id="fhir-modal-title" className="text-lg font-bold text-slate-800">
                  HL7 FHIR R4 • ABDM / HIS Gateway Push
                </h2>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-full">
                  <ShieldCheck className="w-3 h-3" /> Standard R4 Bundle
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Interoperable clinical JSON bundle formatted for Ayushman Bharat Digital Mission (ABDM) and Hospital Information Systems.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ABDM Gateway Push Status Bar */}
        <div className="bg-slate-800 px-6 py-3 border-b border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-200">
          <div className="flex items-center gap-2">
            {isPushing ? (
              <Loader2 className="w-4 h-4 text-teal-400 animate-spin" />
            ) : abdmReceipt?.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-400" />
            )}
            <div>
              <span className="font-bold text-white">
                {!isApproved
                  ? 'Blocked: Physician Approval Required (AI Draft)'
                  : !hasHospitalSharingConsent
                  ? 'Blocked: Hospital Sharing Consent Not Granted'
                  : isPushing
                  ? 'Transmitting Bundle to ABDM / HIS Gateway...'
                  : abdmReceipt?.success
                  ? 'Auto-Pushed to Mock ABDM / HIS Gateway'
                  : 'ABDM Push Ready'}
              </span>
              {abdmReceipt && (
                <span className="ml-2 font-mono text-[11px] text-teal-300">
                  TX: {abdmReceipt.transactionId}
                </span>
              )}
            </div>
          </div>

          <div className="text-[10px] text-slate-400 bg-slate-900/60 px-2 py-1 rounded-md border border-slate-700">
            Simulated Sandbox Gateway (SIH 26047)
          </div>
        </div>

        {/* Modal Content - JSON Preview */}
        <div className="p-6 flex-1 overflow-y-auto bg-slate-950 text-slate-100 font-mono text-xs leading-relaxed space-y-4">
          <div className="flex items-center justify-between text-slate-400 text-[11px] border-b border-slate-800 pb-2">
            <span>resourceType: "Bundle" (collection)</span>
            <span>{fhirBundle?.entry?.length || 0} FHIR Resources</span>
          </div>
          <pre className="whitespace-pre-wrap break-words">{jsonString}</pre>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-[11px] text-slate-500 font-medium max-w-md">
            Includes Patient (with ABHA identifier), Encounter, Condition, MedicationRequest, Observations, and Composition resources.
          </p>

          <div className="flex items-center space-x-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={handleCopy}
              className="inline-flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-xs"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="inline-flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-xs"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Download JSON</span>
            </button>

            <button
              id="btn-push-abdm"
              onClick={handleManualRePush}
              disabled={!isApproved || !hasHospitalSharingConsent || isPushing}
              className={`inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer ${
                !isApproved || !hasHospitalSharingConsent
                  ? 'bg-slate-700 text-slate-400 opacity-50 cursor-not-allowed'
                  : abdmReceipt?.success
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-teal-600 hover:bg-teal-700 text-white'
              }`}
            >
              {isPushing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Pushing...</span>
                </>
              ) : abdmReceipt?.success ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Pushed to ABDM</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Push to ABDM Gateway</span>
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

