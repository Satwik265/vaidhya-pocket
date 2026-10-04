import React from 'react';
import {
  FileCheck,
  Edit2,
  Copy,
  Check,
  Volume2,
  VolumeX,
  Printer,
  Save,
  FileCode,
  ShieldCheck,
} from 'lucide-react';

import { DocumentationConfidence } from '../../types';
import { useTranslation } from '../../i18n';

interface SOAPNoteHeaderProps {
  isEditing: boolean;
  copiedEHR: boolean;
  isReadingAloud: boolean;
  documentationConfidence?: DocumentationConfidence;
  isOfflineMode?: boolean;
  approvalState?: 'AI_DRAFT' | 'REVIEWING' | 'APPROVED';
  onApprove?: () => void;
  onEdit: () => void;
  onSaveEdits: () => void;
  onCancelEdits: () => void;
  onCopyEHR: () => void;
  onReadAloud: () => void;
  onOpenPrintPrescription: () => void;
  onOpenFHIR?: () => void;
  onSaveEncounter: () => void;
}

export const SOAPNoteHeader: React.FC<SOAPNoteHeaderProps> = ({
  isEditing,
  copiedEHR,
  isReadingAloud,
  documentationConfidence,
  isOfflineMode = false,
  approvalState = 'AI_DRAFT',
  onApprove,
  onEdit,
  onSaveEdits,
  onCancelEdits,
  onCopyEHR,
  onReadAloud,
  onOpenPrintPrescription,
  onOpenFHIR,
  onSaveEncounter,
}) => {
  const { t } = useTranslation();
  const overallScore = documentationConfidence?.overall_score;

  return (
    <div id="soap-note-header" className="px-5 py-4 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center space-x-3">
        <span className="w-2 h-6 bg-blue-600 rounded-full shrink-0"></span>
        <div className="flex items-center space-x-2">
          <FileCheck className="w-5 h-5 text-blue-600" />
          <h2 id="soap-note-title" className="font-bold text-sm text-slate-800 flex items-center space-x-2">
            <span>{t.soapView.headerTitle}</span>
            <span className="badge-success">
              {t.soapView.verifiedBadge}
            </span>
            {approvalState === 'APPROVED' ? (
              <span id="badge-approval-status" className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                <ShieldCheck className="w-3 h-3 mr-1 text-emerald-600" /> Physician Approved
              </span>
            ) : approvalState === 'REVIEWING' ? (
              <span id="badge-approval-status" className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                Reviewing (Unapproved)
              </span>
            ) : (
              <span id="badge-approval-status" className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                AI Draft (Unapproved)
              </span>
            )}
            {isOfflineMode && (
              <span id="badge-offline-engine" className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                {t.soapView.offlineBadge}
              </span>
            )}
            {overallScore !== undefined && (
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${
                overallScore >= 85
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : overallScore >= 70
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-red-50 text-red-700 border-red-200'
              }`}>
                {t.soapView.overallSupport}: {overallScore}%
              </span>
            )}
          </h2>
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center space-x-2 text-xs">
        {!isEditing ? (
          <>
            {onApprove && approvalState !== 'APPROVED' && (
              <button
                id="btn-approve-note"
                onClick={onApprove}
                className="py-2 px-3 text-xs rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center space-x-1 shadow-xs cursor-pointer"
                title="Physician Approval: Sign off on verified clinical documentation"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Approve Note</span>
              </button>
            )}

            <button
              id="btn-edit-soap"
              onClick={onEdit}
              className="btn-secondary py-2 px-3 text-xs"
              title={t.soapView.editNote}
            >
              <Edit2 className="w-3.5 h-3.5 text-blue-600" />
              <span>{t.soapView.editNote}</span>
            </button>

            <button
              id="btn-copy-ehr"
              onClick={onCopyEHR}
              className="btn-secondary py-2 px-3 text-xs"
              title={t.soapView.copyEhr}
            >
              {copiedEHR ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span>{copiedEHR ? t.soapView.copied : t.soapView.copyEhr}</span>
            </button>

            <button
              id="btn-read-aloud"
              onClick={onReadAloud}
              className="btn-secondary py-2 px-3 text-xs"
              title={t.soapView.readAloud}
            >
              {isReadingAloud ? <VolumeX className="w-3.5 h-3.5 text-amber-600" /> : <Volume2 className="w-3.5 h-3.5 text-slate-500" />}
              <span>{isReadingAloud ? t.soapView.stopSpeech : t.soapView.readAloud}</span>
            </button>

            <button
              id="btn-print-rx"
              onClick={() => {
                if (approvalState !== 'APPROVED') {
                  alert('Physician Approval Required: Prescriptions can only be printed after physician review and approval.');
                  return;
                }
                onOpenPrintPrescription();
              }}
              className={`btn-secondary py-2 px-3 text-xs ${approvalState !== 'APPROVED' ? 'opacity-60 cursor-not-allowed' : ''}`}
              title={approvalState !== 'APPROVED' ? 'Physician Approval Required before Printing Prescription' : t.soapView.printRx}
            >
              <Printer className="w-3.5 h-3.5 text-indigo-600" />
              <span>{t.soapView.printRx}</span>
            </button>

            {onOpenFHIR && (
              <button
                id="btn-export-fhir"
                onClick={() => {
                  if (approvalState !== 'APPROVED') {
                    alert('Physician Approval Required: FHIR bundle export is restricted until clinical review is approved.');
                    return;
                  }
                  onOpenFHIR();
                }}
                className={`btn-secondary py-2 px-3 text-xs ${approvalState !== 'APPROVED' ? 'opacity-60 cursor-not-allowed' : ''}`}
                title={approvalState !== 'APPROVED' ? 'Physician Approval Required before FHIR Export' : t.soapView.exportFhir}
              >
                <FileCode className="w-3.5 h-3.5 text-teal-600" />
                <span>{t.soapView.exportFhir}</span>
              </button>
            )}

            <button
              id="btn-save-encounter"
              onClick={onSaveEncounter}
              className="btn-primary py-2 px-4 text-xs shadow-xs"
              title={t.soapView.saveRecord}
            >
              <Save className="w-3.5 h-3.5" />
              <span>{t.soapView.saveRecord}</span>
            </button>
          </>
        ) : (
          <>
            <button
              id="btn-save-edits"
              onClick={onSaveEdits}
              className="flex items-center space-x-1 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer shadow-xs"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{t.soapView.doneEditing}</span>
            </button>
            <button
              id="btn-cancel-edits"
              onClick={onCancelEdits}
              className="btn-secondary py-2 px-3 text-xs"
            >
              <span>{t.soapView.cancel}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};

