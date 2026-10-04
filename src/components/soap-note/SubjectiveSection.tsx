import React from 'react';
import { Subjective, SectionDocumentationScore } from '../../types';
import { DocumentationConfidenceBadge } from './DocumentationConfidenceBadge';

interface SubjectiveSectionProps {
  subjective: Subjective;
  confidence?: SectionDocumentationScore;
  isEditing: boolean;
  onChange: (updatedSubjective: Subjective) => void;
}

export const SubjectiveSection: React.FC<SubjectiveSectionProps> = ({
  subjective,
  confidence,
  isEditing,
  onChange,
}) => {
  return (
    <div id="soap-section-subjective" className="card-base space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-6 bg-blue-500 rounded-full shrink-0"></span>
          <h3 className="font-bold text-slate-800 uppercase tracking-wider text-xs flex items-center space-x-2">
            <span>Subjective (S)</span>
          </h3>
        </div>
        <div className="flex items-center space-x-2">
          <DocumentationConfidenceBadge sectionName="Subjective (S)" confidence={confidence} />
          <span className="badge-brand">Patient Reported</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-1">Chief Complaint (CC):</label>
          {isEditing ? (
            <textarea
              rows={2}
              value={subjective.chief_complaint}
              onChange={(e) =>
                onChange({
                  ...subjective,
                  chief_complaint: e.target.value,
                })
              }
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 text-xs font-semibold focus:bg-white"
            />
          ) : (
            <p className="text-slate-800 font-bold bg-slate-50 p-3 rounded-xl border border-slate-200/80">
              {subjective.chief_complaint || 'Not documented'}
            </p>
          )}
        </div>

        <div>
          <label className="block text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-1">Review of Systems (ROS):</label>
          {isEditing ? (
            <textarea
              rows={2}
              value={subjective.review_of_systems}
              onChange={(e) =>
                onChange({
                  ...subjective,
                  review_of_systems: e.target.value,
                })
              }
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 text-xs font-medium focus:bg-white"
            />
          ) : (
            <p className="text-slate-700 font-medium bg-slate-50 p-3 rounded-xl border border-slate-200/80">
              {subjective.review_of_systems || 'Not documented'}
            </p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-1">History of Present Illness (HPI):</label>
        {isEditing ? (
          <textarea
            rows={4}
            value={subjective.history_of_present_illness}
            onChange={(e) =>
              onChange({
                ...subjective,
                history_of_present_illness: e.target.value,
              })
            }
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 text-xs font-medium focus:bg-white"
          />
        ) : (
          <p className="text-slate-700 font-medium leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
            {subjective.history_of_present_illness || 'Not documented'}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
        <div>
          <span className="text-slate-500 font-bold uppercase text-[10px] tracking-wider block mb-1">Current Medications Mentioned:</span>
          <div className="flex flex-wrap gap-1.5">
            {subjective.current_medications?.length > 0 ? (
              subjective.current_medications.map((m, idx) => (
                <span key={idx} className="bg-slate-100 text-slate-700 font-bold px-2.5 py-1 rounded-lg border border-slate-200">
                  {m}
                </span>
              ))
            ) : (
              <span className="text-slate-400 italic font-medium">None mentioned</span>
            )}
          </div>
        </div>

        <div>
          <span className="text-slate-500 font-bold uppercase text-[10px] tracking-wider block mb-1">Allergies:</span>
          <div className="flex flex-wrap gap-1.5">
            {subjective.allergies?.length > 0 ? (
              subjective.allergies.map((a, idx) => (
                <span
                  key={idx}
                  className={`px-2.5 py-1 rounded-lg border font-bold ${
                    a.toLowerCase().includes('nkda') || a.toLowerCase().includes('none')
                      ? 'badge-success'
                      : 'badge-danger'
                  }`}
                >
                  {a}
                </span>
              ))
            ) : (
              <span className="text-slate-400 italic font-medium">NKDA</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
