import React from 'react';
import { Plan, Prescription, SectionDocumentationScore } from '../../types';
import { Plus, Trash2 } from 'lucide-react';
import { DocumentationConfidenceBadge } from './DocumentationConfidenceBadge';

interface PlanSectionProps {
  plan: Plan;
  confidence?: SectionDocumentationScore;
  isEditing: boolean;
  onChange: (updatedPlan: Plan) => void;
  onPrescriptionChange: (index: number, field: keyof Prescription, value: string) => void;
  onAddPrescription: () => void;
  onRemovePrescription: (index: number) => void;
}

export const PlanSection: React.FC<PlanSectionProps> = ({
  plan,
  confidence,
  isEditing,
  onChange,
  onPrescriptionChange,
  onAddPrescription,
  onRemovePrescription,
}) => {
  return (
    <div id="soap-section-plan" className="bg-slate-900 text-white border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-6 bg-emerald-400 rounded-full shrink-0"></span>
          <h3 className="font-bold text-white uppercase tracking-wider text-xs flex items-center space-x-2">
            <span>Plan (P) & Treatment Prescriptions</span>
          </h3>
        </div>
        <div className="flex items-center space-x-2">
          <DocumentationConfidenceBadge sectionName="Plan (P)" confidence={confidence} />
          <span className="text-[10px] text-emerald-300 bg-emerald-950/80 px-2.5 py-0.5 rounded-lg border border-emerald-800/80 font-bold">Actionable Orders</span>
        </div>
      </div>

      {/* Prescriptions Table */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-slate-200 font-bold text-xs flex items-center space-x-2">
            <span>Prescribed Medications</span>
            <span className="text-slate-400 font-semibold text-[11px]">({plan.prescriptions?.length || 0})</span>
          </span>
          {isEditing && (
            <button
              onClick={onAddPrescription}
              className="text-xs text-emerald-300 hover:text-white bg-emerald-950 px-2.5 py-1 rounded-lg border border-emerald-800 flex items-center space-x-1 font-bold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Drug</span>
            </button>
          )}
        </div>

        {plan.prescriptions?.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-bold uppercase text-[10px]">
                  <th className="p-2.5">Medication</th>
                  <th className="p-2.5">Dosage</th>
                  <th className="p-2.5">Frequency</th>
                  <th className="p-2.5">Instructions</th>
                  {isEditing && <th className="p-2.5 w-10">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 bg-slate-900/80">
                {plan.prescriptions.map((rx, idx) => (
                  <tr key={idx} className="hover:bg-slate-800">
                    <td className="p-2.5 font-bold text-emerald-300">
                      {isEditing ? (
                        <input
                          type="text"
                          value={rx.medication}
                          onChange={(e) => onPrescriptionChange(idx, 'medication', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded p-1 text-slate-100 font-semibold"
                        />
                      ) : (
                        rx.medication
                      )}
                    </td>
                    <td className="p-2.5 text-slate-200 font-medium">
                      {isEditing ? (
                        <input
                          type="text"
                          value={rx.dosage}
                          onChange={(e) => onPrescriptionChange(idx, 'dosage', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded p-1 text-slate-100"
                        />
                      ) : (
                        rx.dosage
                      )}
                    </td>
                    <td className="p-2.5 text-slate-300 font-medium">
                      {isEditing ? (
                        <input
                          type="text"
                          value={rx.frequency}
                          onChange={(e) => onPrescriptionChange(idx, 'frequency', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded p-1 text-slate-100"
                        />
                      ) : (
                        rx.frequency
                      )}
                    </td>
                    <td className="p-2.5 text-slate-400 italic">
                      {isEditing ? (
                        <input
                          type="text"
                          value={rx.instructions}
                          onChange={(e) => onPrescriptionChange(idx, 'instructions', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded p-1 text-slate-100"
                        />
                      ) : (
                        rx.instructions
                      )}
                    </td>
                    {isEditing && (
                      <td className="p-2.5 text-center">
                        <button
                          onClick={() => onRemovePrescription(idx)}
                          className="text-slate-500 hover:text-red-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-slate-500 italic bg-slate-950 p-3 rounded-xl border border-slate-800">No prescriptions recorded for this encounter.</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
        <div>
          <label className="block text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1">Diagnostic Tests Ordered:</label>
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-slate-200 font-medium">
            {plan.diagnostic_tests_ordered?.length > 0 ? (
              <ul className="list-disc list-inside space-y-1 text-xs">
                {plan.diagnostic_tests_ordered.map((t, idx) => (
                  <li key={idx}>{t}</li>
                ))}
              </ul>
            ) : (
              <span className="text-slate-500 italic">None ordered</span>
            )}
          </div>
        </div>

        <div>
          <label className="block text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1">Patient Education & Lifestyle:</label>
          {isEditing ? (
            <textarea
              rows={3}
              value={plan.patient_education}
              onChange={(e) =>
                onChange({
                  ...plan,
                  patient_education: e.target.value,
                })
              }
              className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-100 text-xs"
            />
          ) : (
            <p className="text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800 leading-relaxed font-medium">
              {plan.patient_education || 'Standard health education provided.'}
            </p>
          )}
        </div>

        <div>
          <label className="block text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1">Follow-up & Safety Netting:</label>
          {isEditing ? (
            <textarea
              rows={3}
              value={plan.follow_up}
              onChange={(e) =>
                onChange({
                  ...plan,
                  follow_up: e.target.value,
                })
              }
              className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-100 text-xs"
            />
          ) : (
            <p className="text-emerald-300 bg-slate-950 p-3 rounded-xl border border-slate-800 leading-relaxed font-bold">
              {plan.follow_up || 'Return as needed if symptoms worsen.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
