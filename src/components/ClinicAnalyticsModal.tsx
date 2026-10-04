import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { EncounterRecord } from '../types';
import { BarChart3, X, Clock, ShieldAlert, FileCheck, Award } from 'lucide-react';

interface ClinicAnalyticsModalProps {
  encounters: EncounterRecord[];
  onClose: () => void;
}

export const ClinicAnalyticsModal: React.FC<ClinicAnalyticsModalProps> = ({ encounters, onClose }) => {
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
      const closeBtn = modalRef.current?.querySelector<HTMLButtonElement>('button');
      if (closeBtn) closeBtn.focus();
    }, 50);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
    };
  }, [onClose]);

  const totalEncounters = encounters.length;

  // Calculate total minutes saved (averaging 12 mins per SOAP note if meta not available)
  const totalMinutesSaved = encounters.reduce((acc, curr) => {
    return acc + (curr.soapNote?.meta?.time_saved_estimate_minutes || 12);
  }, 0);

  const hoursSaved = (totalMinutesSaved / 60).toFixed(1);

  // Count safety alerts caught
  const totalAlertsIntercepted = encounters.reduce((acc, curr) => {
    return acc + (curr.soapNote?.safety_alerts?.length || 0);
  }, 0);

  // Frequency map of primary diagnoses
  const diagnosisMap: Record<string, number> = {};
  encounters.forEach((enc) => {
    const diag = enc.soapNote?.assessment?.primary_diagnosis || 'Unspecified';
    diagnosisMap[diag] = (diagnosisMap[diag] || 0) + 1;
  });

  const diagnosisList = Object.entries(diagnosisMap).sort((a, b) => b[1] - a[1]);

  return (
    <motion.div
      id="analytics-modal-overlay"
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
        id="analytics-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="analytics-modal-title"
        tabIndex={-1}
        className="modal-container max-w-2xl max-h-[85vh] focus:outline-none focus:ring-2 focus:ring-teal-400/50"
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.15 }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/80">
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-teal-400" />
            <h3 id="analytics-modal-title" className="font-bold text-base text-slate-100">
              Clinic Documentation & Impact Analytics
            </h3>
          </div>

          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2 focus:ring-offset-slate-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs sm:text-sm bg-slate-950">
          {/* Top Key Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-teal-950 border border-teal-800 text-teal-400 flex items-center justify-center font-bold">
                <FileCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-slate-400 text-xs font-semibold">Total Encounters</p>
                <p className="text-xl font-bold text-slate-100">{totalEncounters}</p>
              </div>
            </div>

            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-950 border border-emerald-800 text-emerald-400 flex items-center justify-center font-bold">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-slate-400 text-xs font-semibold">Clinician Time Saved</p>
                <p className="text-xl font-bold text-emerald-400">{hoursSaved} <span className="text-xs font-medium text-slate-400">hrs</span></p>
              </div>
            </div>

            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-amber-950 border border-amber-800 text-amber-400 flex items-center justify-center font-bold">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <p className="text-slate-400 text-xs font-semibold">Safety Flags Audited</p>
                <p className="text-xl font-bold text-amber-300">{totalAlertsIntercepted}</p>
              </div>
            </div>
          </div>

          {/* Primary Diagnoses Breakdown */}
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3">
            <h4 className="font-bold text-sm text-slate-200 flex items-center justify-between">
              <span>Top Clinical Conditions Documented</span>
              <span className="text-slate-500 text-xs font-normal">Primary Care Volume</span>
            </h4>

            {diagnosisList.length > 0 ? (
              <div className="space-y-2">
                {diagnosisList.slice(0, 6).map(([diag, count], idx) => {
                  const percentage = Math.round((count / Math.max(totalEncounters, 1)) * 100);
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-slate-300 truncate max-w-[280px]">{diag}</span>
                        <span className="text-teal-400 font-bold">{count} patient{count > 1 ? 's' : ''} ({percentage}%)</span>
                      </div>
                      <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full"
                          style={{ width: `${Math.max(percentage, 5)}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-slate-500 italic">No encounter records saved yet to calculate diagnosis distribution.</p>
            )}
          </div>

          {/* Low-Resource Primary Care Impact Summary */}
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
            <h4 className="font-bold text-sm text-teal-300 flex items-center space-x-1.5">
              <Award className="w-4 h-4 text-teal-400" />
              <span>Low-Resource Clinic Impact Statement</span>
            </h4>
            <p className="text-slate-300 leading-relaxed">
              In low-resource primary care clinics where clinicians handle up to 40+ consultations per day, administrative burden consumes up to 40% of consultation time. By reducing SOAP note creation from 15 minutes to under 2 minutes, MedScribe Lite empowers rural healthcare workers to dedicate maximum time to patient care.
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

