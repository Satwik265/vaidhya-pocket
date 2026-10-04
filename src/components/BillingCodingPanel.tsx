import React, { useState } from 'react';
import { BillingSuggestions } from '../types';
import { Receipt, Copy, Check } from 'lucide-react';

interface BillingCodingPanelProps {
  billingSuggestions: BillingSuggestions;
}

export const BillingCodingPanel: React.FC<BillingCodingPanelProps> = ({ billingSuggestions }) => {
  const [copiedCodes, setCopiedCodes] = useState<boolean>(false);

  const icd10List = billingSuggestions?.icd_10_codes || [];
  const cptList = billingSuggestions?.cpt_codes || [];

  const handleCopyCodes = () => {
    const text = `MEDICAL BILLING & CODING SUGGESTIONS
ICD-10 CODES:
${icd10List.map((c) => `- ${c.code}: ${c.description} (Confidence: ${c.confidence})`).join('\n')}

CPT EVALUATION & MANAGEMENT CODES:
${cptList.map((c) => `- ${c.code}: ${c.description}\n  Rationale: ${c.rationale}`).join('\n')}`;

    navigator.clipboard.writeText(text);
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 2000);
  };

  return (
    <div id="billing-coding-card" className="bg-white border border-slate-200/80 rounded-3xl p-5 overflow-hidden shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
        <div className="flex items-center space-x-3">
          <span className="w-2 h-6 bg-slate-800 rounded-full shrink-0"></span>
          <div className="flex items-center space-x-2">
            <Receipt className="w-5 h-5 text-slate-800" />
            <h3 className="font-bold text-sm text-slate-800 flex items-center space-x-2">
              <span>Automated Billing & Coding Suggestions</span>
              <span className="text-[10px] bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-lg border border-slate-200 font-bold">
                ICD-10 & CPT
              </span>
            </h3>
          </div>
        </div>

        <button
          onClick={handleCopyCodes}
          className="btn-secondary py-1.5 px-3 text-xs"
          title="Copy billing codes to clipboard"
        >
          {copiedCodes ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
          <span>{copiedCodes ? 'Copied!' : 'Copy Codes'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
        {/* ICD-10 Section */}
        <div className="space-y-2.5">
          <h4 className="font-bold text-slate-700 text-xs flex items-center justify-between uppercase tracking-wider">
            <span>Suggested ICD-10 Diagnostic Codes</span>
            <span className="text-slate-400 font-medium">({icd10List.length})</span>
          </h4>

          {icd10List.length > 0 ? (
            <div className="space-y-2">
              {icd10List.map((item, idx) => {
                const conf = item.confidence?.toLowerCase();
                return (
                  <div key={idx} className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 flex items-start justify-between gap-2 shadow-2xs">
                    <div className="space-y-1">
                      <span className="font-extrabold font-mono text-blue-700 text-sm bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">{item.code}</span>
                      <p className="text-slate-800 font-semibold">{item.description}</p>
                    </div>
                    <span
                      className={`shrink-0 ${
                        conf === 'high'
                          ? 'badge-success'
                          : conf === 'medium'
                          ? 'badge-warning'
                          : 'badge-brand text-slate-600 bg-slate-100 border-slate-200'
                      }`}
                    >
                      {item.confidence}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-slate-400 italic bg-slate-50 p-3.5 rounded-2xl border border-slate-200">No ICD-10 codes suggested.</p>
          )}
        </div>

        {/* CPT Section */}
        <div className="space-y-2.5">
          <h4 className="font-bold text-slate-700 text-xs flex items-center justify-between uppercase tracking-wider">
            <span>CPT Evaluation & Management (E/M) Codes</span>
            <span className="text-slate-400 font-medium">({cptList.length})</span>
          </h4>

          {cptList.length > 0 ? (
            <div className="space-y-2">
              {cptList.map((item, idx) => (
                <div key={idx} className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold font-mono text-indigo-700 text-sm bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">{item.code}</span>
                    <span className="text-[10px] text-slate-600 bg-slate-200/70 font-bold px-2 py-0.5 rounded-md">E&M Level</span>
                  </div>
                  <p className="text-slate-800 font-semibold">{item.description}</p>
                  {item.rationale && (
                    <p className="text-slate-600 text-[11px] font-medium italic bg-white p-2.5 rounded-xl border border-slate-200/60 leading-relaxed">
                      Rationale: {item.rationale}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 italic bg-slate-50 p-3.5 rounded-2xl border border-slate-200">No CPT codes suggested.</p>
          )}
        </div>
      </div>
    </div>
  );
};
