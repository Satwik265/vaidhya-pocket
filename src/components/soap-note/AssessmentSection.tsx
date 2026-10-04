import React from 'react';
import { Assessment, SectionDocumentationScore } from '../../types';
import { ChevronRight } from 'lucide-react';
import { DocumentationConfidenceBadge } from './DocumentationConfidenceBadge';

interface AssessmentSectionProps {
  assessment: Assessment;
  confidence?: SectionDocumentationScore;
  isEditing: boolean;
  onChange: (updatedAssessment: Assessment) => void;
}

export const AssessmentSection: React.FC<AssessmentSectionProps> = ({
  assessment,
  confidence,
  isEditing,
  onChange,
}) => {
  return (
    <div id="soap-section-assessment" className="card-base space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-6 bg-indigo-500 rounded-full shrink-0"></span>
          <h3 className="font-bold text-slate-800 uppercase tracking-wider text-xs flex items-center space-x-2">
            <span>Assessment (A)</span>
          </h3>
        </div>
        <div className="flex items-center space-x-2">
          <DocumentationConfidenceBadge sectionName="Assessment (A)" confidence={confidence} />
          <span className="text-[10px] text-indigo-800 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-200 font-bold">Diagnosis & Evaluation</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-3">
          <div>
            <label className="block text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-1">Primary Diagnosis:</label>
            {isEditing ? (
              <input
                type="text"
                value={assessment.primary_diagnosis}
                onChange={(e) =>
                  onChange({
                    ...assessment,
                    primary_diagnosis: e.target.value,
                  })
                }
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 text-xs font-bold focus:bg-white"
              />
            ) : (
              <div className="bg-indigo-50/70 border border-indigo-200 text-indigo-950 font-bold p-3.5 rounded-xl text-sm flex items-center justify-between">
                <span className="text-base">{assessment.primary_diagnosis || 'Unspecified'}</span>
                <span className="text-xs font-extrabold px-2.5 py-1 bg-indigo-600 text-white rounded-lg">
                  Working Impression
                </span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-1">Clinical Synthesis Summary:</label>
            {isEditing ? (
              <textarea
                rows={3}
                value={assessment.clinical_summary}
                onChange={(e) =>
                  onChange({
                    ...assessment,
                    clinical_summary: e.target.value,
                  })
                }
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 text-xs font-medium focus:bg-white"
              />
            ) : (
              <p className="text-slate-700 font-medium bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 leading-relaxed">
                {assessment.clinical_summary || 'No clinical summary provided.'}
              </p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-1">Differential Diagnoses:</label>
          {assessment.differential_diagnoses?.length > 0 ? (
            <ul className="space-y-2">
              {assessment.differential_diagnoses.map((diff, idx) => (
                <li key={idx} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-slate-800 font-semibold text-xs flex items-center space-x-2">
                  <ChevronRight className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>{diff}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-400 italic bg-slate-50 p-3 rounded-xl border border-slate-200">No secondary differentials noted.</p>
          )}
        </div>
      </div>
    </div>
  );
};
