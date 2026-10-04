import React, { useState } from 'react';
import { SectionDocumentationScore } from '../../types';
import { ShieldCheck, AlertCircle, Info, HelpCircle } from 'lucide-react';

interface DocumentationConfidenceBadgeProps {
  sectionName: string;
  confidence?: SectionDocumentationScore;
}

export const DocumentationConfidenceBadge: React.FC<DocumentationConfidenceBadgeProps> = ({
  sectionName,
  confidence,
}) => {
  const [showTooltip, setShowTooltip] = useState<boolean>(false);

  if (!confidence) return null;

  const score = confidence.score;
  let badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  let badgeText = `${score}% Documentation Support`;
  let Icon = ShieldCheck;

  if (score < 70) {
    badgeStyle = 'bg-red-50 text-red-700 border-red-200';
    Icon = AlertCircle;
  } else if (score < 85) {
    badgeStyle = 'bg-amber-50 text-amber-700 border-amber-200';
    Icon = Info;
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip(!showTooltip)}
        className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer ${badgeStyle}`}
        aria-label={`Documentation Confidence for ${sectionName}: ${score}%`}
      >
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <span>Doc Support: {score}%</span>
        <HelpCircle className="w-3 h-3 opacity-60 ml-0.5" />
      </button>

      {/* Hover/Click Tooltip Popover */}
      {showTooltip && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-slate-900 text-white text-xs rounded-2xl p-3.5 shadow-xl z-50 space-y-2 border border-slate-700 leading-relaxed">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-bold text-slate-200">{sectionName} Completeness</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${score >= 85 ? 'bg-emerald-900/80 text-emerald-300' : score >= 70 ? 'bg-amber-900/80 text-amber-300' : 'bg-red-900/80 text-red-300'}`}>
              {score}% Score
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Evidence & Reasoning:</span>
            <p className="text-slate-300 text-[11px]">{confidence.reasoning || 'Sufficient transcript detail provided.'}</p>
          </div>

          {confidence.missing_information && confidence.missing_information.length > 0 && (
            <div className="pt-1 border-t border-slate-800">
              <span className="text-[10px] uppercase font-bold text-amber-400 block mb-1">Identified Missing Details:</span>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-300">
                {confidence.missing_information.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          
          <p className="text-[9px] text-slate-400 italic pt-1 border-t border-slate-800/80">
            *Measures documentation evidence completeness, not diagnostic certainty.
          </p>
        </div>
      )}
    </div>
  );
};
