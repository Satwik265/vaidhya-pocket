import React, { useState } from 'react';
import { motion } from 'motion/react';
import { SOAPNote, Prescription } from '../types';
import { Sparkles, RefreshCw } from 'lucide-react';
import {
  SOAPNoteHeader,
  SOAPNoteTabs,
  SOAPTabType,
  SubjectiveSection,
  ObjectiveSection,
  AssessmentSection,
  PlanSection,
} from './soap-note';

interface SOAPNoteViewProps {
  soapNote?: SOAPNote | null;
  isGenerating?: boolean;
  isOfflineMode?: boolean;
  approvalState?: 'AI_DRAFT' | 'REVIEWING' | 'APPROVED';
  onApprove?: () => void;
  onUpdateSOAP: (updatedNote: SOAPNote) => void;
  onOpenPrintPrescription: () => void;
  onOpenFHIR?: () => void;
  onSaveEncounter: () => void;
}

export const SOAPNoteView: React.FC<SOAPNoteViewProps> = ({
  soapNote,
  isGenerating = false,
  isOfflineMode = false,
  approvalState = 'AI_DRAFT',
  onApprove,
  onUpdateSOAP,
  onOpenPrintPrescription,
  onOpenFHIR,
  onSaveEncounter,
}) => {
  const [activeTab, setActiveTab] = useState<SOAPTabType>('all');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [copiedEHR, setCopiedEHR] = useState<boolean>(false);
  const [isReadingAloud, setIsReadingAloud] = useState<boolean>(false);

  // Editable local state
  const [editedNote, setEditedNote] = useState<SOAPNote | null>(soapNote || null);

  // Sync edited note when prop soapNote changes
  React.useEffect(() => {
    if (soapNote) {
      setEditedNote(soapNote);
    }
  }, [soapNote]);

  if (isGenerating) {
    return (
      <div id="soap-note-skeleton-card" className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-3">
            <span className="w-2.5 h-6 bg-blue-600 rounded-full shrink-0"></span>
            <div className="flex items-center space-x-2">
              <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
              <h3 className="font-bold text-sm text-slate-800">Generating Clinical Bento SOAP Note...</h3>
            </div>
          </div>
          <span className="badge-brand animate-pulse">On-device Engine</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Skeleton Card 1: Subjective */}
          <motion.div
            className="p-5 rounded-2xl bg-blue-50/50 border border-blue-100 space-y-3"
            animate={{ opacity: [0.4, 0.9, 0.4] }}
            transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
          >
            <div className="h-4 w-32 bg-blue-200/70 rounded-md"></div>
            <div className="h-3 w-full bg-slate-200/80 rounded-md"></div>
            <div className="h-3 w-4/5 bg-slate-200/80 rounded-md"></div>
            <div className="h-3 w-3/5 bg-slate-200/80 rounded-md"></div>
          </motion.div>

          {/* Skeleton Card 2: Objective */}
          <motion.div
            className="p-5 rounded-2xl bg-emerald-50/50 border border-emerald-100 space-y-3"
            animate={{ opacity: [0.4, 0.9, 0.4] }}
            transition={{ repeat: Infinity, duration: 1.4, delay: 0.2, ease: 'easeInOut' }}
          >
            <div className="h-4 w-32 bg-emerald-200/70 rounded-md"></div>
            <div className="h-3 w-full bg-slate-200/80 rounded-md"></div>
            <div className="h-3 w-3/4 bg-slate-200/80 rounded-md"></div>
            <div className="h-3 w-5/6 bg-slate-200/80 rounded-md"></div>
          </motion.div>

          {/* Skeleton Card 3: Assessment */}
          <motion.div
            className="p-5 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-3"
            animate={{ opacity: [0.4, 0.9, 0.4] }}
            transition={{ repeat: Infinity, duration: 1.4, delay: 0.4, ease: 'easeInOut' }}
          >
            <div className="h-4 w-36 bg-indigo-200/70 rounded-md"></div>
            <div className="h-3 w-full bg-slate-200/80 rounded-md"></div>
            <div className="h-3 w-2/3 bg-slate-200/80 rounded-md"></div>
          </motion.div>

          {/* Skeleton Card 4: Plan */}
          <motion.div
            className="p-5 rounded-2xl bg-teal-50/50 border border-teal-100 space-y-3"
            animate={{ opacity: [0.4, 0.9, 0.4] }}
            transition={{ repeat: Infinity, duration: 1.4, delay: 0.6, ease: 'easeInOut' }}
          >
            <div className="h-4 w-28 bg-teal-200/70 rounded-md"></div>
            <div className="h-3 w-full bg-slate-200/80 rounded-md"></div>
            <div className="h-3 w-4/5 bg-slate-200/80 rounded-md"></div>
            <div className="h-3 w-1/2 bg-slate-200/80 rounded-md"></div>
          </motion.div>
        </div>
      </div>
    );
  }

  if (!editedNote) return null;

  const handleSaveEdits = () => {
    onUpdateSOAP(editedNote);
    setIsEditing(false);
  };

  const handleCancelEdits = () => {
    if (soapNote) setEditedNote(soapNote);
    setIsEditing(false);
  };

  // Generate plain-text EHR export
  const getEHRFormattedText = (): string => {
    const s = editedNote.subjective;
    const o = editedNote.objective;
    const a = editedNote.assessment;
    const p = editedNote.plan;

    return `CLINICAL SOAP NOTE
==================================================
SUBJECTIVE (S):
- Chief Complaint: ${s.chief_complaint}
- History of Present Illness: ${s.history_of_present_illness}
- Review of Systems: ${s.review_of_systems}
- Current Medications: ${s.current_medications?.join(', ') || 'None documented'}
- Allergies: ${s.allergies?.length ? s.allergies.join(', ') : 'None documented / Not elicited'}

OBJECTIVE (O):
- Vital Signs: ${o.vital_signs}
- Physical Exam: ${o.physical_exam}
- Labs & Imaging: ${o.labs_and_imaging}

ASSESSMENT (A):
- Primary Diagnosis: ${a.primary_diagnosis}
- Differential Diagnoses: ${a.differential_diagnoses?.join(', ') || 'None listed'}
- Clinical Summary: ${a.clinical_summary}

PLAN (P):
- Prescriptions:
${p.prescriptions?.map((rx) => `  * ${rx.medication} ${rx.dosage} - ${rx.frequency} (${rx.instructions})`).join('\n') || '  None prescribed'}
- Diagnostic Tests Ordered: ${p.diagnostic_tests_ordered?.join(', ') || 'None'}
- Patient Education: ${p.patient_education}
- Follow-up: ${p.follow_up}

BILLING CODES:
- ICD-10: ${editedNote.billing_suggestions?.icd_10_codes?.map((c) => `${c.code} (${c.description})`).join('; ') || 'N/A'}
- CPT: ${editedNote.billing_suggestions?.cpt_codes?.map((c) => `${c.code} (${c.description})`).join('; ') || 'N/A'}
==================================================`;
  };

  const handleCopyEHR = () => {
    const text = getEHRFormattedText();
    navigator.clipboard.writeText(text);
    setCopiedEHR(true);
    setTimeout(() => setCopiedEHR(false), 2500);
  };

  const handleReadAloud = () => {
    if (!('speechSynthesis' in window)) {
      alert('Text-to-speech is not supported in this browser.');
      return;
    }

    if (isReadingAloud) {
      window.speechSynthesis.cancel();
      setIsReadingAloud(false);
      return;
    }

    const textToRead = `Primary Diagnosis: ${editedNote.assessment.primary_diagnosis}. Clinical Summary: ${editedNote.assessment.clinical_summary}. Treatment Plan: ${editedNote.plan.prescriptions.map((p) => p.medication).join(', ')}.`;

    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.onend = () => setIsReadingAloud(false);
    utterance.onerror = () => setIsReadingAloud(false);

    window.speechSynthesis.speak(utterance);
    setIsReadingAloud(true);
  };

  // Helper functions for prescription array edits
  const handlePrescriptionChange = (index: number, field: keyof Prescription, value: string) => {
    const updatedPrescriptions = [...(editedNote.plan.prescriptions || [])];
    updatedPrescriptions[index] = {
      ...updatedPrescriptions[index],
      [field]: value,
    };
    setEditedNote({
      ...editedNote,
      plan: {
        ...editedNote.plan,
        prescriptions: updatedPrescriptions,
      },
    });
  };

  const addPrescriptionRow = () => {
    setEditedNote({
      ...editedNote,
      plan: {
        ...editedNote.plan,
        prescriptions: [
          ...(editedNote.plan.prescriptions || []),
          { medication: '', dosage: '', frequency: '', instructions: '' },
        ],
      },
    });
  };

  const removePrescriptionRow = (index: number) => {
    const updated = [...(editedNote.plan.prescriptions || [])];
    updated.splice(index, 1);
    setEditedNote({
      ...editedNote,
      plan: {
        ...editedNote.plan,
        prescriptions: updated,
      },
    });
  };

  return (
    <div id="soap-note-card" className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs space-y-0">
      {/* Top Header & Actions Bar */}
      <SOAPNoteHeader
        isEditing={isEditing}
        copiedEHR={copiedEHR}
        isReadingAloud={isReadingAloud}
        documentationConfidence={editedNote.documentation_confidence}
        isOfflineMode={isOfflineMode}
        approvalState={approvalState}
        onApprove={onApprove}
        onEdit={() => setIsEditing(true)}
        onSaveEdits={handleSaveEdits}
        onCancelEdits={handleCancelEdits}
        onCopyEHR={handleCopyEHR}
        onReadAloud={handleReadAloud}
        onOpenPrintPrescription={onOpenPrintPrescription}
        onOpenFHIR={onOpenFHIR}
        onSaveEncounter={onSaveEncounter}
      />

      {/* Navigation Filter Tabs */}
      <SOAPNoteTabs activeTab={activeTab} onSelectTab={setActiveTab} />

      {/* Main SOAP Content Grid */}
      <div id="soap-content-container" className="p-5 space-y-5 text-xs sm:text-sm">
        {/* SUBJECTIVE (S) */}
        {(activeTab === 'all' || activeTab === 'subjective') && (
          <SubjectiveSection
            subjective={editedNote.subjective}
            confidence={editedNote.documentation_confidence?.subjective}
            isEditing={isEditing}
            onChange={(updatedSubjective) =>
              setEditedNote({ ...editedNote, subjective: updatedSubjective })
            }
          />
        )}

        {/* OBJECTIVE (O) */}
        {(activeTab === 'all' || activeTab === 'objective') && (
          <ObjectiveSection
            objective={editedNote.objective}
            confidence={editedNote.documentation_confidence?.objective}
            isEditing={isEditing}
            onChange={(updatedObjective) =>
              setEditedNote({ ...editedNote, objective: updatedObjective })
            }
          />
        )}

        {/* ASSESSMENT (A) */}
        {(activeTab === 'all' || activeTab === 'assessment') && (
          <AssessmentSection
            assessment={editedNote.assessment}
            confidence={editedNote.documentation_confidence?.assessment}
            isEditing={isEditing}
            onChange={(updatedAssessment) =>
              setEditedNote({ ...editedNote, assessment: updatedAssessment })
            }
          />
        )}

        {/* PLAN (P) */}
        {(activeTab === 'all' || activeTab === 'plan') && (
          <PlanSection
            plan={editedNote.plan}
            confidence={editedNote.documentation_confidence?.plan}
            isEditing={isEditing}
            onChange={(updatedPlan) =>
              setEditedNote({ ...editedNote, plan: updatedPlan })
            }
            onPrescriptionChange={handlePrescriptionChange}
            onAddPrescription={addPrescriptionRow}
            onRemovePrescription={removePrescriptionRow}
          />
        )}
      </div>
    </div>
  );
};

