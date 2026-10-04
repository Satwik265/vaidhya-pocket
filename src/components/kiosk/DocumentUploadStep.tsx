import { browserOcr } from '../../ocr/browserOcr';
import { ocrTextToExtractedData } from '../../pocket/ocrToDocument';
import React, { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  UploadCloud,
  Camera,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Trash2,
  Calendar,
  ArrowUpDown,
  Volume2,
  VolumeX,
  Plus,
  RefreshCw,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Pill,
  Activity,
  Eye,
  Info,
} from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext';
import {
  UploadedDocumentRecord,
  ExtractedDocumentData,
  ExtractedLabResult,
} from '../../types';

export interface DocumentUploadStepProps {
  documents: UploadedDocumentRecord[];
  onUpdateDocuments: (documents: UploadedDocumentRecord[]) => void;
  onNext: () => void;
  onBack: () => void;
  patientContext?: {
    name?: string;
    age?: number | string;
    gender?: string;
  };
}

/**
 * Creates a lightweight realistic synthetic prescription/lab canvas image
 * so users can test multimodal vision extraction immediately without a physical camera.
 */
function createSyntheticDocumentDataUrl(
  title: string,
  docType: 'lab' | 'rx' | 'discharge',
  dateStr: string
): string {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 1000;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 800, 1000);

  // Header banner
  ctx.fillStyle = docType === 'lab' ? '#0f766e' : docType === 'rx' ? '#1e40af' : '#047857';
  ctx.fillRect(0, 0, 800, 110);

  // Header text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(
    docType === 'lab'
      ? 'APEX CLINICAL REFERENCE DIAGNOSTICS'
      : docType === 'rx'
      ? 'CITY GENERAL HOSPITAL & OPD CLINIC'
      : 'ALL INDIA INSTITUTE OF AYURVEDA (AIIA)',
    40,
    55
  );

  ctx.font = '16px sans-serif';
  ctx.fillText(
    docType === 'lab'
      ? 'Accredited Pathology • Automated Bio-Chemistry Panel'
      : docType === 'rx'
      ? 'Department of Internal & Family Medicine • Rx Order'
      : 'Inpatient Clinical Care Wing • Formal Discharge Summary',
    40,
    85
  );

  // Patient info bar
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(40, 130, 720, 60);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('Patient: Aarav Sharma   |   Age/Sex: 38Y / M   |   ABHA: 91-8765-4321-0987', 55, 165);

  ctx.font = 'bold 15px sans-serif';
  ctx.fillStyle = '#334155';
  ctx.fillText(`Document Date: ${dateStr}`, 55, 220);

  // Document body content
  if (docType === 'lab') {
    ctx.font = 'bold 20px sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('INVESTIGATION REPORT — METABOLIC & LIPID PROFILE', 40, 260);

    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = '#475569';
    ctx.fillText('TEST NAME                   RESULT       UNIT       NORMAL REFERENCE', 40, 300);
    ctx.fillRect(40, 310, 720, 2);

    const rows = [
      ['HbA1c (Glycated Hb)', '8.4 *HIGH*', '%', '< 5.7 (Normal)'],
      ['Fasting Blood Sugar', '162 *HIGH*', 'mg/dL', '70 - 99 mg/dL'],
      ['Total Cholesterol', '228 *HIGH*', 'mg/dL', '< 200 mg/dL'],
      ['Serum Triglycerides', '194 *HIGH*', 'mg/dL', '< 150 mg/dL'],
      ['Serum Creatinine', '0.9 (Normal)', 'mg/dL', '0.7 - 1.3 mg/dL'],
      ['Hemoglobin (Hb)', '13.8 (Normal)', 'g/dL', '13.0 - 17.0 g/dL'],
    ];

    rows.forEach((row, i) => {
      const y = 345 + i * 40;
      ctx.fillStyle = row[1].includes('HIGH') ? '#b91c1c' : '#1e293b';
      ctx.font = row[1].includes('HIGH') ? 'bold 15px monospace' : '14px monospace';
      ctx.fillText(`${row[0].padEnd(28)} ${row[1].padEnd(12)} ${row[2].padEnd(10)} ${row[3]}`, 40, y);
    });

    ctx.fillStyle = '#fee2e2';
    ctx.fillRect(40, 620, 720, 80);
    ctx.strokeStyle = '#ef4444';
    ctx.strokeRect(40, 620, 720, 80);
    ctx.fillStyle = '#991b1b';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('PATHOLOGIST REMARKS / CRITICAL FLAG:', 55, 650);
    ctx.font = '14px sans-serif';
    ctx.fillText('Elevated HbA1c (8.4%) and fasting glucose indicate poorly controlled diabetes.', 55, 675);
  } else if (docType === 'rx') {
    ctx.font = 'bold 20px sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('PHYSICIAN PRESCRIPTION (Rx)', 40, 260);

    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.fillText('Diagnosis: Essential Hypertension (Stage 1), Type 2 Diabetes Mellitus', 40, 300);
    ctx.fillText('Clinical Vitals: BP 148/92 mmHg, Pulse 76 bpm, Weight 78 kg', 40, 330);

    ctx.font = 'bold 18px serif';
    ctx.fillText('Rx:', 40, 380);

    const meds = [
      '1. Tab. Telmisartan 40mg — 1 tab OD (Morning after breakfast) x 30 days',
      '2. Tab. Metformin 500mg — 1 tab BD (After lunch & dinner) x 30 days',
      '3. Tab. Paracetamol 650mg — 1 tab SOS for headache/bodyache',
    ];

    ctx.font = '15px sans-serif';
    meds.forEach((med, i) => {
      ctx.fillText(med, 55, 420 + i * 40);
    });

    ctx.fillStyle = '#eff6ff';
    ctx.fillRect(40, 570, 720, 70);
    ctx.fillStyle = '#1e40af';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('ADVICE: Low salt diet, 30 mins brisk walk daily. Review after 1 month.', 55, 610);
  } else {
    ctx.font = 'bold 20px sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('AYUSH INPATIENT DISCHARGE SUMMARY', 40, 260);

    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.fillText('Admitted: 2023-11-05   |   Discharged: 2023-11-10', 40, 300);
    ctx.fillText('Diagnosis: Atisara (Acute Gastroenteritis) with Pitta-Vata aggravation', 40, 330);

    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('Discharge Medications & Ahara Recommendations:', 40, 380);

    const ayushMeds = [
      '1. Kutajaghan Vati — 2 tablets TDS with warm water x 7 days',
      '2. Bilvadi Leha — 1 teaspoon BD before food x 14 days',
      '3. Takra (Buttermilk processed with ginger and cumin) — twice daily',
    ];

    ctx.font = '15px sans-serif';
    ayushMeds.forEach((m, i) => {
      ctx.fillText(m, 55, 420 + i * 40);
    });
  }

  // Footer stamp
  ctx.fillStyle = '#64748b';
  ctx.font = 'italic 13px sans-serif';
  ctx.fillText('Digitally signed and generated for verified ABDM Health Locker storage.', 40, 950);

  return canvas.toDataURL('image/jpeg', 0.85);
}

export const DocumentUploadStep: React.FC<DocumentUploadStepProps> = ({
  documents,
  onUpdateDocuments,
  onNext,
  onBack,
  patientContext,
}) => {
  const { language } = useTranslation();
  const isHindi = language === 'hi';

  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingFilename, setProcessingFilename] = useState<string>('');
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(
    documents.length > 0 ? documents[0].id : null
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  // Audio Guidance
  const handleToggleSpeech = () => {
    if (!('speechSynthesis' in window)) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const textToRead = isHindi
      ? 'दस्तावेज़ एवं पर्चा अपलोड चरण। आप अपने पुराने पर्चे, लैब टेस्ट रिपोर्ट या डिस्चार्ज सारांश की फोटो खींच सकते हैं या अपलोड कर सकते हैं। हमारा क्लिनिकल AI आपकी दवाएं, पिछले निदान और असामान्य लैब मान निकालेगा।'
      : 'Document and prescription upload step. You can photograph or upload prior physical prescriptions, lab reports, or discharge summaries. Our clinical AI will extract your medications, past diagnoses, and highlight any lab values outside the normal reference range.';

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.lang = isHindi ? 'hi-IN' : 'en-IN';
    utterance.rate = 0.95;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  // Call server extraction API
  const processImageExtraction = async (
    fileOrBase64: File | string,
    fileName: string,
    docHint?: string
  ) => {
    setIsProcessing(true);
    setProcessingFilename(fileName);

    let base64Data = '';
    let mimeType = 'image/jpeg';
    let fileSize = 150000;

    if (typeof fileOrBase64 === 'string') {
      base64Data = fileOrBase64;
    } else {
      fileSize = fileOrBase64.size;
      mimeType = fileOrBase64.type || 'image/jpeg';
      base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(fileOrBase64);
      });
    }

    const newDocId = 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const nowIso = new Date().toISOString();

    // Initial placeholder record in analyzing state
    const pendingDoc: UploadedDocumentRecord = {
      id: newDocId,
      fileName,
      fileType: mimeType,
      fileSize,
      previewUrl: base64Data,
      uploadedAt: nowIso,
      effectiveDate: nowIso.split('T')[0],
      status: 'analyzing',
    };

    onUpdateDocuments([...documents, pendingDoc]);
    setSelectedDocId(newDocId);

    try {
      // On-device OCR (Tesseract.js WASM). No cloud call. Fails closed to the manual-review path below.
      const ocr = await browserOcr.extractText({
        kind: 'document',
        fileBase64: base64Data,
        fileName,
        mimeType,
        documentHint: 'unspecified',
      });
      const extracted: ExtractedDocumentData = ocrTextToExtractedData(ocr.text, ocr.documentType, nowIso.split('T')[0]);

      // Normalize effective date for chronological sorting
      let effectiveDate = nowIso.split('T')[0];
      if (extracted.documentDate && /^\d{4}-\d{2}-\d{2}$/.test(extracted.documentDate)) {
        effectiveDate = extracted.documentDate;
      } else if (extracted.documentDate) {
        const parsedDate = new Date(extracted.documentDate);
        if (!isNaN(parsedDate.getTime())) {
          effectiveDate = parsedDate.toISOString().split('T')[0];
        }
      }

      const completedDoc: UploadedDocumentRecord = {
        ...pendingDoc,
        status: 'completed',
        effectiveDate,
        extractedData: extracted,
      };

      onUpdateDocuments(
        [...documents.filter((d) => d.id !== newDocId), completedDoc]
      );
    } catch (err: any) {
      console.error('Failed to extract document vision:', err);
      // Zero-fabrication enforcement: Never invent synthetic diagnoses or medications on extraction failure!
      const failedDoc: UploadedDocumentRecord = {
        ...pendingDoc,
        status: 'error',
        errorMessage: 'EXTRACTION_FAILED: Automated OCR/vision analysis failed. Document will be reviewed manually by attending physician.',
        effectiveDate: nowIso.split('T')[0],
        extractedData: {
          documentType: 'other',
          documentDate: nowIso.split('T')[0],
          extractedDateConfidence: 'low',
          facilityOrDoctor: 'Not documented',
          diagnoses: [],
          medications: [],
          investigations: [],
          clinicalSummary: 'Automated vision extraction failed. Retained for manual clinician evaluation.',
          criticalFlags: ['Automated extraction failed — manual physician review required.'],
        },
      };

      onUpdateDocuments(
        [...documents.filter((d) => d.id !== newDocId), failedDoc]
      );
    } finally {
      setIsProcessing(false);
      setProcessingFilename('');
    }
  };

  // Handle direct file input
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    processImageExtraction(file, file.name);
    e.target.value = '';
  };

  // Delete document
  const handleDeleteDoc = (idToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = documents.filter((d) => d.id !== idToDelete);
    onUpdateDocuments(updated);
    if (selectedDocId === idToDelete) {
      setSelectedDocId(updated.length > 0 ? updated[0].id : null);
    }
  };

  // Quick load sample documents for seamless testing
  const handleQuickLoadSample = (sampleType: 'lab' | 'rx' | 'discharge') => {
    let title = 'Sample Lab Report';
    let dateStr = '2024-02-14';
    if (sampleType === 'rx') {
      title = 'Sample Doctor Prescription';
      dateStr = '2024-01-20';
    } else if (sampleType === 'discharge') {
      title = 'Sample Discharge Summary';
      dateStr = '2023-11-10';
    }

    const dataUrl = createSyntheticDocumentDataUrl(title, sampleType, dateStr);
    processImageExtraction(dataUrl, `${title}.jpg`, sampleType);
  };

  // Chronological sorting of uploaded documents
  const sortedDocuments = useMemo(() => {
    return [...documents].sort((a, b) => {
      const dateA = new Date(a.effectiveDate || a.uploadedAt).getTime();
      const dateB = new Date(b.effectiveDate || b.uploadedAt).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });
  }, [documents, sortOrder]);

  const activeDoc = useMemo(() => {
    if (!selectedDocId) return sortedDocuments[0] || null;
    return sortedDocuments.find((d) => d.id === selectedDocId) || sortedDocuments[0] || null;
  }, [sortedDocuments, selectedDocId]);

  // Aggregate all out-of-range lab results across all completed documents
  const allOutOfRangeResults = useMemo(() => {
    const results: { doc: UploadedDocumentRecord; lab: ExtractedLabResult }[] = [];
    documents.forEach((doc) => {
      if (doc.extractedData?.investigations) {
        doc.extractedData.investigations.forEach((lab) => {
          if (lab.isOutOfRange) {
            results.push({ doc, lab });
          }
        });
      }
    });
    return results;
  }, [documents]);

  return (
    <div
      id="kiosk-document-upload-step"
      className="w-full max-w-4xl mx-auto bg-slate-900/90 border-2 border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-md"
    >
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-teal-500/10 border border-teal-400/30 text-teal-300 text-xs font-bold uppercase tracking-wider mb-2">
            <UploadCloud className="w-3.5 h-3.5" />
            {isHindi ? 'चरण 5 • दस्तावेज़ अपलोड एवं विज़न AI' : 'Step 5 of 6 • Document Upload & Vision AI'}
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            {isHindi ? 'पुरानी मेडिकल पर्चियां एवं रिपोर्ट अपलोड करें' : 'Upload Past Medical Records'}
          </h1>
          <p className="text-slate-400 text-sm sm:text-base mt-1">
            {isHindi
              ? 'पर्चे की फोटो लें या PDF/छवि अपलोड करें। AI डॉक्टर के लिए दवाएं एवं लैब परिणाम निकालेगा।'
              : 'Scan prior prescriptions, diagnostic labs, or discharge summaries for multimodal clinical extraction'}
          </p>
        </div>

        {/* Audio Guide Button */}
        <button
          type="button"
          onClick={handleToggleSpeech}
          aria-label={isHindi ? 'निर्देश सुनें' : 'Listen to instructions'}
          className={`flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold transition-all border shrink-0 ${
            isSpeaking
              ? 'bg-amber-500/20 text-amber-300 border-amber-400/40 animate-pulse'
              : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700/80 hover:text-white'
          }`}
        >
          {isSpeaking ? <VolumeX className="w-4 h-4 text-amber-400" /> : <Volume2 className="w-4 h-4 text-teal-400" />}
          <span>{isSpeaking ? (isHindi ? 'आवाज रोकें' : 'Stop Audio') : (isHindi ? 'ऑडियो गाइड' : 'Audio Guide')}</span>
        </button>
      </div>

      {/* Quick Action Upload Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
        {/* Camera capture button */}
        <button
          type="button"
          disabled={isProcessing}
          onClick={() => cameraInputRef.current?.click()}
          className="flex items-center justify-center gap-3 p-5 rounded-2xl bg-gradient-to-r from-teal-500/20 to-teal-600/10 border-2 border-teal-500/40 hover:border-teal-400 text-teal-200 hover:text-white transition-all cursor-pointer font-bold text-base shadow-lg shadow-teal-950/40 group active:scale-98 disabled:opacity-50"
        >
          <div className="w-11 h-11 rounded-xl bg-teal-500/30 flex items-center justify-center text-teal-300 group-hover:scale-110 transition-transform">
            <Camera className="w-6 h-6" />
          </div>
          <div className="text-left">
            <div className="font-black text-white text-base">
              {isHindi ? 'कैमरे से फोटो लें' : 'Take Photo with Camera'}
            </div>
            <div className="text-xs text-teal-300/80 font-normal">
              {isHindi ? 'कागज़ी पर्चे की फोटो खींचें' : 'Photograph paper prescription or lab sheet'}
            </div>
          </div>
        </button>

        {/* File upload button */}
        <button
          type="button"
          disabled={isProcessing}
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center justify-center gap-3 p-5 rounded-2xl bg-slate-800/60 border-2 border-slate-700 hover:border-slate-500 text-slate-200 hover:text-white transition-all cursor-pointer font-bold text-base group active:scale-98 disabled:opacity-50"
        >
          <div className="w-11 h-11 rounded-xl bg-slate-700/60 flex items-center justify-center text-slate-300 group-hover:scale-110 transition-transform">
            <UploadCloud className="w-6 h-6" />
          </div>
          <div className="text-left">
            <div className="font-black text-white text-base">
              {isHindi ? 'फ़ाइल या PDF अपलोड करें' : 'Upload Image or File'}
            </div>
            <div className="text-xs text-slate-400 font-normal">
              {isHindi ? 'JPG, PNG, WEBP प्रारूप' : 'Supports JPG, PNG, WEBP formats'}
            </div>
          </div>
        </button>

        {/* Hidden inputs */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Quick Test Sample Loaders Bar */}
      <div className="mt-4 p-4 rounded-2xl bg-slate-800/40 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>{isHindi ? 'नमूना दस्तावेज़ से परीक्षण करें:' : 'Instant Kiosk Test Samples:'}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => handleQuickLoadSample('lab')}
            className="px-3 py-1.5 rounded-xl bg-teal-950/60 hover:bg-teal-900/80 border border-teal-500/40 text-teal-300 text-xs font-bold transition-all cursor-pointer hover:border-teal-400 disabled:opacity-50"
          >
            + Sample Lab (HbA1c 8.4%)
          </button>
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => handleQuickLoadSample('rx')}
            className="px-3 py-1.5 rounded-xl bg-blue-950/60 hover:bg-blue-900/80 border border-blue-500/40 text-blue-300 text-xs font-bold transition-all cursor-pointer hover:border-blue-400 disabled:opacity-50"
          >
            + Sample Rx (Telmisartan)
          </button>
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => handleQuickLoadSample('discharge')}
            className="px-3 py-1.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition-all cursor-pointer hover:border-emerald-400 disabled:opacity-50"
          >
            + Sample AIIA Discharge
          </button>
        </div>
      </div>

      {/* Processing indicator banner */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mt-5 p-4 rounded-2xl bg-gradient-to-r from-teal-950/80 to-slate-900 border-2 border-teal-400/60 flex items-center gap-3 text-teal-200"
          >
            <RefreshCw className="w-5 h-5 text-teal-400 animate-spin shrink-0" />
            <div>
              <div className="font-bold text-sm text-white flex items-center gap-2">
                <span>Reading document on-device (OCR)...</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400/30">
                  {processingFilename || 'Image'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Extracting diagnoses, medication dosages, and checking laboratory values against normal reference ranges.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* OUT-OF-RANGE LAB ALERTS PANEL (Reusing SafetyAlertsPanel visual pattern) */}
      {allOutOfRangeResults.length > 0 && (
        <div id="out-of-range-labs-banner" className="mt-6 space-y-3">
          <div className="border-2 rounded-3xl p-5 overflow-hidden shadow-xl bg-orange-950/30 border-orange-500/50 shadow-orange-950/20">
            <div className="flex items-center justify-between pb-3.5 border-b border-orange-500/30">
              <div className="flex items-center space-x-3">
                <span className="w-2.5 h-6 rounded-full shrink-0 bg-orange-500 animate-pulse" />
                <div className="flex items-center space-x-2">
                  <ShieldAlert className="w-5 h-5 text-orange-400 animate-bounce" />
                  <h3 className="font-extrabold text-sm sm:text-base text-white flex items-center space-x-2">
                    <span>
                      {isHindi
                        ? 'असामान्य लैब टेस्ट परिणाम पाए गए'
                        : 'Abnormal Laboratory Values Detected'}
                    </span>
                    <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-orange-500 text-slate-950 shadow-md">
                      {allOutOfRangeResults.length} Abnormal
                    </span>
                  </h3>
                </div>
              </div>
              <span className="text-xs text-orange-300 font-semibold hidden sm:inline">
                Highlighted for Doctor Review
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {allOutOfRangeResults.map(({ doc, lab }, idx) => {
                const isHigh = lab.flagSeverity === 'high';
                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-2xl border flex items-start space-x-3.5 transition-all shadow-sm ${
                      isHigh
                        ? 'bg-orange-950/50 border-orange-500/60 text-orange-100 shadow-orange-950/30'
                        : 'bg-amber-950/50 border-amber-500/50 text-amber-100'
                    }`}
                  >
                    <AlertTriangle
                      className={`w-5 h-5 shrink-0 mt-0.5 ${
                        isHigh ? 'text-orange-400 animate-pulse' : 'text-amber-400'
                      }`}
                    />
                    <div className="flex-1 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-black text-sm tracking-wide text-white">
                          {lab.testName}:{' '}
                          <span className="text-orange-300 font-mono text-base">
                            {lab.value} {lab.unit || ''}
                          </span>
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">
                            Ref: {lab.referenceRange || 'Standard normal'}
                          </span>
                          <span
                            className={`text-[11px] font-black uppercase px-2.5 py-0.5 rounded-lg ${
                              isHigh
                                ? 'bg-orange-500 text-slate-950'
                                : 'bg-amber-400 text-slate-950'
                            }`}
                          >
                            {isHigh ? 'High Severity' : 'Elevated'}
                          </span>
                        </div>
                      </div>
                      <p className="leading-relaxed text-xs sm:text-sm text-slate-200 font-medium">
                        {lab.interpretation ||
                          `Measured value ${lab.value} falls outside the normal clinical reference range.`}
                      </p>
                      <div className="text-[11px] text-slate-400 pt-1 flex items-center gap-1.5">
                        <FileText className="w-3 h-3 text-slate-400" />
                        <span>Extracted from: {doc.fileName} ({doc.effectiveDate})</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Uploaded Documents List & Timeline Sorting */}
      <div className="mt-8">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-teal-400" />
            <h2 className="text-base sm:text-lg font-black text-white">
              {isHindi ? 'अपलोड किए गए क्लिनिकल दस्तावेज़' : 'Uploaded Clinical Documents'}
            </h2>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-800 text-teal-300 border border-slate-700">
              {documents.length}
            </span>
          </div>

          {/* Chronological Sort Toggle Button */}
          {documents.length > 1 && (
            <button
              type="button"
              onClick={() =>
                setSortOrder((prev) => (prev === 'newest' ? 'oldest' : 'newest'))
              }
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 transition-all cursor-pointer"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-teal-400" />
              <span>
                {sortOrder === 'newest'
                  ? (isHindi ? 'क्रम: नवीनतम पहले' : 'Sorted: Newest First')
                  : (isHindi ? 'क्रम: पुरातन पहले' : 'Sorted: Oldest First')}
              </span>
            </button>
          )}
        </div>

        {/* Empty state */}
        {documents.length === 0 && (
          <div className="py-12 px-4 rounded-3xl border-2 border-dashed border-slate-800 text-center my-6 bg-slate-900/40">
            <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 mx-auto mb-3">
              <FileText className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-200">
              {isHindi ? 'अभी तक कोई दस्तावेज़ अपलोड नहीं हुआ' : 'No prior records uploaded yet'}
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
              {isHindi
                ? 'दस्तावेज़ अपलोड करना वैकल्पिक है। यदि आपके पास पुराने पर्चे या रिपोर्ट हैं, तो ऊपर फोटो लें अथवा "आगे बढ़ें" पर क्लिक करें।'
                : 'Uploading past records is optional. If you have previous medical papers, take a photo above or click Proceed to continue.'}
            </p>
          </div>
        )}

        {/* Document Cards Grid */}
        {sortedDocuments.length > 0 && (
          <div className="space-y-4 my-6">
            {sortedDocuments.map((doc) => {
              const isSelected = doc.id === activeDoc?.id;
              const extracted = doc.extractedData;
              const outOfRangeCount =
                extracted?.investigations?.filter((i) => i.isOutOfRange).length || 0;

              return (
                <div
                  key={doc.id}
                  onClick={() => setSelectedDocId(doc.id)}
                  className={`p-5 rounded-3xl border-2 transition-all cursor-pointer text-left ${
                    isSelected
                      ? 'bg-slate-800/90 border-teal-400 shadow-xl shadow-teal-950/40 ring-1 ring-teal-400/40'
                      : 'bg-slate-800/40 border-slate-700/80 hover:bg-slate-800/60 hover:border-slate-600'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex items-start gap-3.5">
                      {doc.previewUrl ? (
                        <img
                          src={doc.previewUrl}
                          alt="Thumbnail"
                          className="w-14 h-18 object-cover rounded-xl border border-slate-700 shrink-0 bg-slate-950"
                        />
                      ) : (
                        <div className="w-14 h-18 rounded-xl bg-slate-700/60 border border-slate-600 flex items-center justify-center text-slate-300 shrink-0">
                          <FileText className="w-7 h-7" />
                        </div>
                      )}

                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded-lg bg-teal-500/20 border border-teal-400/30 text-teal-300">
                            {extracted?.documentType === 'prescription'
                              ? 'Prescription (Rx)'
                              : extracted?.documentType === 'lab_report'
                              ? 'Diagnostic Lab Report'
                              : extracted?.documentType === 'discharge_summary'
                              ? 'Discharge Summary'
                              : 'Medical Document'}
                          </span>

                          <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-lg bg-slate-900 text-slate-300 border border-slate-700">
                            <Calendar className="w-3 h-3 text-teal-400" />
                            <span>Date: {doc.effectiveDate}</span>
                          </span>

                          {outOfRangeCount > 0 && (
                            <span className="text-xs font-extrabold px-2 py-0.5 rounded-lg bg-orange-500/20 border border-orange-400/40 text-orange-300 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-orange-400" />
                              <span>{outOfRangeCount} Lab Flag{outOfRangeCount > 1 ? 's' : ''}</span>
                            </span>
                          )}
                        </div>

                        <h3 className="font-black text-base text-white truncate max-w-md">
                          {doc.fileName}
                        </h3>

                        {extracted?.facilityOrDoctor && (
                          <p className="text-xs text-slate-400 mt-0.5">
                            {extracted.facilityOrDoctor}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-start">
                      <button
                        type="button"
                        aria-label="Delete document"
                        onClick={(e) => handleDeleteDoc(doc.id, e)}
                        className="p-2 rounded-xl bg-slate-700/50 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-600 transition-all cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Extracted Details Sub-Panel */}
                  {isSelected && extracted && (
                    <div className="mt-5 pt-4 border-t border-slate-700/80 space-y-4">
                      {/* Diagnoses chips */}
                      {extracted.diagnoses && extracted.diagnoses.length > 0 && (
                        <div>
                          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Activity className="w-3.5 h-3.5 text-teal-400" />
                            <span>Extracted Conditions / Diagnoses:</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {extracted.diagnoses.map((diag, i) => (
                              <span
                                key={i}
                                className="px-3 py-1 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs font-semibold"
                              >
                                {diag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Extracted Medications */}
                      {extracted.medications && extracted.medications.length > 0 && (
                        <div>
                          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Pill className="w-3.5 h-3.5 text-blue-400" />
                            <span>Extracted Medications with Dosages:</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {extracted.medications.map((med, i) => (
                              <div
                                key={i}
                                className="p-3 rounded-2xl bg-slate-900/80 border border-slate-700/80 text-xs space-y-1"
                              >
                                <div className="font-extrabold text-white text-sm">
                                  {med.name}
                                </div>
                                <div className="text-teal-300 font-semibold">
                                  Dosage: {med.dosage}
                                </div>
                                {med.frequency && (
                                  <div className="text-slate-400">
                                    Frequency: {med.frequency}
                                  </div>
                                )}
                                {med.instructions && (
                                  <div className="text-slate-400 italic">
                                    {med.instructions}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Extracted Investigations table */}
                      {extracted.investigations && extracted.investigations.length > 0 && (
                        <div>
                          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <ShieldAlert className="w-3.5 h-3.5 text-teal-400" />
                            <span>Laboratory Test Results & Reference Checks:</span>
                          </div>
                          <div className="rounded-2xl border border-slate-700 overflow-hidden text-xs">
                            <table className="w-full text-left">
                              <thead className="bg-slate-900/90 text-slate-400 font-bold border-b border-slate-700">
                                <tr>
                                  <th className="p-2.5">Test Name</th>
                                  <th className="p-2.5">Value</th>
                                  <th className="p-2.5 hidden sm:table-cell">Reference Range</th>
                                  <th className="p-2.5">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800 bg-slate-900/40">
                                {extracted.investigations.map((inv, idx) => (
                                  <tr
                                    key={idx}
                                    className={
                                      inv.isOutOfRange
                                        ? 'bg-orange-950/20 font-medium'
                                        : 'hover:bg-slate-800/30'
                                    }
                                  >
                                    <td className="p-2.5 font-bold text-white">
                                      {inv.testName}
                                    </td>
                                    <td className="p-2.5 font-mono">
                                      <span
                                        className={
                                          inv.isOutOfRange
                                            ? 'text-orange-300 font-bold'
                                            : 'text-slate-200'
                                        }
                                      >
                                        {inv.value} {inv.unit || ''}
                                      </span>
                                    </td>
                                    <td className="p-2.5 text-slate-400 hidden sm:table-cell">
                                      {inv.referenceRange || '—'}
                                    </td>
                                    <td className="p-2.5">
                                      {inv.isOutOfRange ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-500/20 border border-orange-400/30 text-orange-300 font-bold text-[10px] uppercase">
                                          <AlertTriangle className="w-3 h-3" />
                                          <span>Out of range</span>
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-400/30 text-emerald-400 font-bold text-[10px] uppercase">
                                          <CheckCircle2 className="w-3 h-3" />
                                          <span>Normal</span>
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Clinical summary text */}
                      {extracted.clinicalSummary && (
                        <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-700/60 text-xs text-slate-300 leading-relaxed">
                          <span className="font-bold text-teal-300">Summary: </span>
                          {extracted.clinicalSummary}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-4 pt-6 border-t border-slate-800">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 hover:text-white transition-all border border-slate-700"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>{isHindi ? 'इंटरव्यू पर वापस जाएं' : 'Back to Interview'}</span>
        </button>

        <button
          type="button"
          onClick={onNext}
          className="flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-black text-base sm:text-lg bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-400 hover:to-blue-500 text-slate-950 transition-all shadow-xl shadow-teal-950/60 cursor-pointer transform hover:-translate-y-0.5"
        >
          <span>
            {documents.length > 0
              ? isHindi
                ? `${documents.length} दस्तावेज़ों के साथ आगे बढ़ें`
                : `Proceed to Summary (${documents.length} Document${documents.length > 1 ? 's' : ''})`
              : isHindi
              ? 'बिना दस्तावेज़ आगे बढ़ें'
              : 'Proceed to Intake Summary'}
          </span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
