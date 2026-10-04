import React from 'react';
import { Objective, SectionDocumentationScore } from '../../types';
import { DocumentationConfidenceBadge } from './DocumentationConfidenceBadge';

interface ObjectiveSectionProps {
  objective: Objective;
  confidence?: SectionDocumentationScore;
  isEditing: boolean;
  onChange: (updatedObjective: Objective) => void;
}

export const ObjectiveSection: React.FC<ObjectiveSectionProps> = ({
  objective,
  confidence,
  isEditing,
  onChange,
}) => {
  return (
    <div id="soap-section-objective" className="card-base space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-6 bg-emerald-500 rounded-full shrink-0"></span>
          <h3 className="font-bold text-slate-800 uppercase tracking-wider text-xs flex items-center space-x-2">
            <span>Objective (O)</span>
          </h3>
        </div>
        <div className="flex items-center space-x-2">
          <DocumentationConfidenceBadge sectionName="Objective (O)" confidence={confidence} />
          <span className="badge-success">Clinical Findings</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-1">Vital Signs:</label>
          {isEditing ? (
            <textarea
              rows={3}
              value={objective.vital_signs}
              onChange={(e) =>
                onChange({
                  ...objective,
                  vital_signs: e.target.value,
                })
              }
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 text-xs font-semibold focus:bg-white"
            />
          ) : (
            <p className="text-slate-800 font-mono font-bold bg-slate-50 p-3 rounded-xl border border-slate-200/80 leading-relaxed text-xs">
              {objective.vital_signs || 'Not documented'}
            </p>
          )}
        </div>

        <div>
          <label className="block text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-1">Physical Examination:</label>
          {isEditing ? (
            <textarea
              rows={3}
              value={objective.physical_exam}
              onChange={(e) =>
                onChange({
                  ...objective,
                  physical_exam: e.target.value,
                })
              }
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 text-xs font-medium focus:bg-white"
            />
          ) : (
            <p className="text-slate-700 font-medium bg-slate-50 p-3 rounded-xl border border-slate-200/80 leading-relaxed">
              {objective.physical_exam || 'Not performed/documented during this visit.'}
            </p>
          )}
        </div>

        <div>
          <label className="block text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-1">Labs & Diagnostics Reviewed:</label>
          {isEditing ? (
            <textarea
              rows={3}
              value={objective.labs_and_imaging}
              onChange={(e) =>
                onChange({
                  ...objective,
                  labs_and_imaging: e.target.value,
                })
              }
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 text-xs font-medium focus:bg-white"
            />
          ) : (
            <p className="text-slate-700 font-medium bg-slate-50 p-3 rounded-xl border border-slate-200/80 leading-relaxed">
              {objective.labs_and_imaging || 'None reviewed'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
