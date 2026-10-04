import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { EncounterRecord } from '../types';
import { History, X, Search, Trash2, ExternalLink, Calendar, FileText } from 'lucide-react';

interface EncounterHistoryModalProps {
  encounters: EncounterRecord[];
  onLoadEncounter: (encounter: EncounterRecord) => void;
  onDeleteEncounter: (id: string) => void;
  onClearAll: () => void;
  onClose: () => void;
}

export const EncounterHistoryModal: React.FC<EncounterHistoryModalProps> = ({
  encounters,
  onLoadEncounter,
  onDeleteEncounter,
  onClearAll,
  onClose,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const modalRef = useRef<HTMLDivElement>(null);

  // Focus trap & Escape key listener
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
    // Auto-focus first input or modal on mount
    const timer = setTimeout(() => {
      const searchInput = modalRef.current?.querySelector<HTMLInputElement>('input');
      if (searchInput) searchInput.focus();
    }, 50);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
    };
  }, [onClose]);

  const filtered = encounters.filter((enc) => {
    const term = searchTerm.toLowerCase();
    const nameMatch = enc.patientInfo?.name?.toLowerCase().includes(term);
    const diagMatch = enc.soapNote?.assessment?.primary_diagnosis?.toLowerCase().includes(term);
    const dateMatch = new Date(enc.timestamp).toLocaleDateString().includes(term);
    return nameMatch || diagMatch || dateMatch;
  });

  return (
    <motion.div
      id="encounter-history-overlay"
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
        id="encounter-history-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="encounter-history-title"
        tabIndex={-1}
        className="modal-container max-w-3xl max-h-[85vh] focus:outline-none focus:ring-2 focus:ring-teal-400/50"
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.15 }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/80">
          <div className="flex items-center space-x-2">
            <History className="w-5 h-5 text-teal-400" />
            <h3 id="encounter-history-title" className="font-bold text-base text-slate-100">
              Saved Clinical Encounters History
            </h3>
            <span className="text-xs bg-teal-950 text-teal-300 px-2 py-0.5 rounded border border-teal-800 font-bold">
              {encounters.length} Saved
            </span>
          </div>

          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2 focus:ring-offset-slate-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by patient name, diagnosis, or date..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-slate-100 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 transition-all"
            />
          </div>

          {encounters.length > 0 && (
            <button
              onClick={onClearAll}
              className="text-xs text-rose-400 hover:text-rose-300 bg-rose-950/40 border border-rose-800/50 px-3 py-2 rounded-lg transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-500/50"
            >
              Clear All Encounters
            </button>
          )}
        </div>

        {/* Encounters List */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1 bg-slate-950/50">
          {filtered.length > 0 ? (
            filtered.map((enc) => {
              const formattedDate = new Date(enc.timestamp).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={enc.id}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs transition-colors shadow-sm"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-sm text-slate-100">{enc.patientInfo?.name || 'Unspecified Patient'}</span>
                      <span className="text-[11px] text-teal-300 bg-teal-950 px-2 py-0.5 rounded border border-teal-800/60 font-semibold">
                        {enc.patientInfo?.age}y {enc.patientInfo?.sex}
                      </span>
                    </div>

                    <p className="text-amber-300 font-semibold">
                      Diagnosis: {enc.soapNote?.assessment?.primary_diagnosis || 'Unspecified'}
                    </p>

                    <div className="flex items-center space-x-3 text-slate-400 text-[11px]">
                      <span className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        <span>{formattedDate}</span>
                      </span>
                      <span>•</span>
                      <span>{enc.soapNote?.plan?.prescriptions?.length || 0} Rx</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 self-end sm:self-auto">
                    <button
                      onClick={() => onLoadEncounter(enc)}
                      className="btn-teal focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2 focus:ring-offset-slate-900"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Load Note</span>
                    </button>

                    <button
                      onClick={() => onDeleteEncounter(enc.id)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 border border-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-400"
                      title="Delete saved encounter"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 text-slate-500 space-y-2">
              <FileText className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-slate-400 font-medium">No clinical encounters match your search.</p>
              <p className="text-xs text-slate-600">Generated SOAP notes saved to your clinic device will appear here.</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

