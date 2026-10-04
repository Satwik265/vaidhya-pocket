import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { SOAPNote, PatientInfo } from '../types';
import { Printer, X } from 'lucide-react';

interface PrintPrescriptionModalProps {
  patientInfo: PatientInfo;
  soapNote: SOAPNote;
  isApproved?: boolean;
  onClose: () => void;
}

export const PrintPrescriptionModal: React.FC<PrintPrescriptionModalProps> = ({
  patientInfo,
  soapNote,
  isApproved = true,
  onClose,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Tab' && modalRef.current) {
        const focusables = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const timer = setTimeout(() => {
      const printBtn = modalRef.current?.querySelector<HTMLButtonElement>('button');
      if (printBtn) printBtn.focus();
    }, 50);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
    };
  }, [onClose]);

  const handlePrint = () => {
    window.print();
  };

  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <motion.div
      id="print-prescription-overlay"
      className="modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        ref={modalRef}
        id="print-prescription-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="print-prescription-title"
        tabIndex={-1}
        className="modal-container focus:outline-none focus:ring-2 focus:ring-teal-400/50"
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.15 }}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/80">
          <div className="flex items-center space-x-2">
            <Printer className="w-5 h-5 text-teal-400" />
            <h3 id="print-prescription-title" className="font-bold text-base text-slate-100">
              Print Patient Prescription & Advice Slip
            </h3>
          </div>
          <div className="flex items-center space-x-2">
            <button
              id="btn-print-now"
              onClick={() => {
                if (!isApproved) {
                  alert('Physician Approval Required: Unapproved draft prescriptions cannot be printed.');
                  return;
                }
                handlePrint();
              }}
              disabled={!isApproved}
              className={`btn-teal focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2 focus:ring-offset-slate-900 ${!isApproved ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Now</span>
            </button>
            <button
              onClick={onClose}
              aria-label="Close modal"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2 focus:ring-offset-slate-900 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Approval Warning if unapproved */}
        {!isApproved && (
          <div id="print-approval-gate-warning" className="mx-6 mt-4 p-3 bg-amber-500/20 border border-amber-500/40 rounded-xl text-amber-200 text-xs font-semibold flex items-center space-x-2">
            <span>Physician Approval Gate Active: This prescription slip is an unapproved AI draft. Official printing and dispensing are restricted until physician sign-off.</span>
          </div>
        )}

        {/* Printable Document Sheet Container */}
        <div className="p-6 overflow-y-auto bg-slate-950 text-slate-100 space-y-6 print-container text-xs sm:text-sm">
          {/* Printable Sheet Header */}
          <div className="border-b-2 border-teal-500 pb-4 text-center sm:text-left flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <h2 className="text-lg font-bold text-teal-400 tracking-tight">COMMUNITY HEALTH OUTREACH CLINIC</h2>
              <p className="text-slate-400 text-xs">Primary Care & Maternal-Child Health Department</p>
              <p className="text-slate-500 text-[11px]">{patientInfo.clinicLocation || 'Central Primary Care Facility'}</p>
            </div>
            <div className="text-right text-xs text-slate-400">
              <p className="font-semibold text-slate-200">Date: {currentDate}</p>
              <p>Rx #: RX-{Math.floor(100000 + Math.random() * 900000)}</p>
            </div>
          </div>

          {/* Patient Details */}
          <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block font-semibold">Patient Name:</span>
              <span className="font-bold text-slate-100">{patientInfo.name || 'Unspecified'}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-semibold">Age / Sex:</span>
              <span className="text-slate-200">{patientInfo.age} yrs ({patientInfo.sex})</span>
            </div>
            <div>
              <span className="text-slate-400 block font-semibold">Known Allergies:</span>
              <span className="text-rose-300 font-semibold">{patientInfo.knownAllergies || 'None documented'}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-semibold">Diagnosis:</span>
              <span className="text-amber-300 font-bold">{soapNote.assessment.primary_diagnosis || 'Primary Care Consultation'}</span>
            </div>
          </div>

          {/* Prescriptions Section */}
          <div className="space-y-2">
            <h4 className="font-bold text-sm text-teal-300 uppercase tracking-wider flex items-center space-x-2 border-b border-slate-800 pb-1">
              <span className="text-lg font-serif">Rx</span>
              <span>Prescribed Medications</span>
            </h4>

            {soapNote.plan.prescriptions?.length > 0 ? (
              <div className="space-y-2">
                {soapNote.plan.prescriptions.map((rx, idx) => (
                  <div key={idx} className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 flex items-start justify-between">
                    <div>
                      <p className="font-bold text-teal-300 text-sm">
                        {idx + 1}. {rx.medication} <span className="text-slate-200 font-normal">({rx.dosage})</span>
                      </p>
                      <p className="text-slate-300 mt-0.5">Take {rx.frequency}</p>
                      {rx.instructions && (
                        <p className="text-slate-400 italic text-xs mt-1">Note: {rx.instructions}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 italic p-3 bg-slate-900 rounded border border-slate-800">No oral or topical prescriptions ordered.</p>
            )}
          </div>

          {/* Patient Instructions */}
          <div className="space-y-2">
            <h4 className="font-bold text-xs text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-1">
              Patient Care & Home Advice
            </h4>
            <p className="text-slate-200 bg-slate-900/80 p-3 rounded-lg border border-slate-800 leading-relaxed">
              {soapNote.plan.patient_education || 'Please take medications as instructed and stay well hydrated.'}
            </p>
          </div>

          {/* Follow-up & Doctor Signature Box */}
          <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-end gap-6 text-xs">
            <div>
              <span className="text-slate-400 font-semibold block">Follow-up Schedule:</span>
              <span className="text-amber-300 font-bold">{soapNote.plan.follow_up || 'Return as needed'}</span>
            </div>

            <div className="text-right space-y-1">
              <div className="w-48 h-10 border-b border-slate-600 border-dashed"></div>
              <p className="font-semibold text-slate-300">Attending Clinician Signature</p>
              <p className="text-slate-500 text-[10px]">
                {isApproved ? 'MedScribe Lite Generated & Physician Approved' : 'AI DRAFT - NOT SIGNED OR APPROVED'}
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

