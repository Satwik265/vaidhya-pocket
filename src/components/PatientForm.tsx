import React, { useState } from 'react';
import { PatientInfo } from '../types';
import { Activity, AlertCircle, Pill, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { useTranslation } from '../i18n';

interface PatientFormProps {
  patientInfo: PatientInfo;
  onChange: (info: PatientInfo) => void;
  onReset: () => void;
}

export const PatientForm: React.FC<PatientFormProps> = ({
  patientInfo,
  onChange,
  onReset,
}) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const handleInputChange = (field: keyof PatientInfo, value: any) => {
    onChange({
      ...patientInfo,
      [field]: value,
    });
  };

  return (
    <div id="patient-info-card" className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-xs">
      <div
        id="patient-info-header"
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-5 py-4 bg-white hover:bg-slate-50 flex items-center justify-between cursor-pointer border-b border-slate-100 transition-colors"
      >
        <div className="flex items-center space-x-3">
          <span className="w-2 h-6 bg-blue-600 rounded-full shrink-0"></span>
          <h2 id="patient-info-title" className="font-bold text-sm text-slate-800">
            {t.patientForm.title}
          </h2>
          {patientInfo.name && (
            <span id="patient-summary-tag" className="badge-brand ml-2">
              {patientInfo.name} ({patientInfo.age}y {patientInfo.sex})
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <button
            id="btn-reset-patient"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onReset();
            }}
            className="btn-secondary py-1 px-3 text-xs"
            title={t.patientForm.resetForm}
          >
            <RotateCcw className="w-3 h-3" />
            <span>{t.patientForm.resetForm}</span>
          </button>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </div>

      {isExpanded && (
        <div id="patient-info-body" className="p-5 space-y-4 bg-white text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Patient Name */}
            <div>
              <label htmlFor="input-patient-name" className="block text-slate-500 font-bold mb-1 uppercase text-[10px] tracking-wider">
                {t.patientForm.name} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="input-patient-name"
                  type="text"
                  placeholder={t.patientForm.namePlaceholder}
                  value={patientInfo.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 font-semibold focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-xs transition-all"
                />
              </div>
            </div>

            {/* Age */}
            <div>
              <label htmlFor="input-patient-age" className="block text-slate-500 font-bold mb-1 uppercase text-[10px] tracking-wider">
                {t.patientForm.age} <span className="text-red-500">*</span>
              </label>
              <input
                id="input-patient-age"
                type="number"
                min="0"
                max="120"
                placeholder={t.patientForm.agePlaceholder}
                value={patientInfo.age}
                onChange={(e) => handleInputChange('age', e.target.value ? Number(e.target.value) : '')}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 font-semibold focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-xs transition-all"
              />
            </div>

            {/* Sex */}
            <div>
              <label htmlFor="select-patient-sex" className="block text-slate-500 font-bold mb-1 uppercase text-[10px] tracking-wider">
                {t.patientForm.sex} <span className="text-red-500">*</span>
              </label>
              <select
                id="select-patient-sex"
                value={patientInfo.sex}
                onChange={(e) => handleInputChange('sex', e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 font-semibold focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-xs transition-all"
              >
                <option value="Male">{t.patientForm.sexMale}</option>
                <option value="Female">{t.patientForm.sexFemale}</option>
                <option value="Other">{t.patientForm.sexOther}</option>
              </select>
            </div>

            {/* Location */}
            <div>
              <label htmlFor="input-location" className="block text-slate-500 font-bold mb-1 uppercase text-[10px] tracking-wider">
                {t.patientForm.location}
              </label>
              <input
                id="input-location"
                type="text"
                placeholder={t.patientForm.locationPlaceholder}
                value={patientInfo.clinicLocation || ''}
                onChange={(e) => handleInputChange('clinicLocation', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 font-semibold focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-xs transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            {/* Known Medical History */}
            <div>
              <label htmlFor="input-medical-history" className="block text-slate-500 font-bold mb-1 text-[10px] uppercase tracking-wider flex items-center space-x-1">
                <Activity className="w-3 h-3 text-blue-600" />
                <span>{t.patientForm.medicalHistory}</span>
              </label>
              <textarea
                id="input-medical-history"
                rows={2}
                placeholder={t.patientForm.medicalHistoryPlaceholder}
                value={patientInfo.medicalHistory || ''}
                onChange={(e) => handleInputChange('medicalHistory', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 font-medium focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-xs transition-all"
              />
            </div>

            {/* Known Current Medications */}
            <div>
              <label htmlFor="input-current-medications" className="block text-slate-500 font-bold mb-1 text-[10px] uppercase tracking-wider flex items-center space-x-1">
                <Pill className="w-3 h-3 text-amber-600" />
                <span>{t.patientForm.currentMedications}</span>
              </label>
              <textarea
                id="input-current-medications"
                rows={2}
                placeholder={t.patientForm.currentMedicationsPlaceholder}
                value={patientInfo.currentMedications || ''}
                onChange={(e) => handleInputChange('currentMedications', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 font-medium focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-xs transition-all"
              />
            </div>

            {/* Known Allergies */}
            <div>
              <label htmlFor="input-allergies" className="block text-slate-500 font-bold mb-1 text-[10px] uppercase tracking-wider flex items-center space-x-1">
                <AlertCircle className="w-3 h-3 text-red-500" />
                <span>{t.patientForm.knownAllergies}</span>
              </label>
              <textarea
                id="input-allergies"
                rows={2}
                placeholder={t.patientForm.knownAllergiesPlaceholder}
                value={patientInfo.knownAllergies || ''}
                onChange={(e) => handleInputChange('knownAllergies', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 font-medium focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-xs transition-all"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

