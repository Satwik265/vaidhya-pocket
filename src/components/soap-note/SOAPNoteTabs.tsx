import React from 'react';

export type SOAPTabType = 'all' | 'subjective' | 'objective' | 'assessment' | 'plan';

interface SOAPNoteTabsProps {
  activeTab: SOAPTabType;
  onSelectTab: (tab: SOAPTabType) => void;
}

export const SOAPNoteTabs: React.FC<SOAPNoteTabsProps> = ({ activeTab, onSelectTab }) => {
  return (
    <div id="soap-tabs-bar" className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center space-x-2 text-xs overflow-x-auto">
      <button
        onClick={() => onSelectTab('all')}
        className={`px-3.5 py-1.5 rounded-xl font-bold cursor-pointer transition-all border ${
          activeTab === 'all'
            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
            : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-200'
        }`}
      >
        Full SOAP Note
      </button>
      <button
        onClick={() => onSelectTab('subjective')}
        className={`px-3.5 py-1.5 rounded-xl font-bold cursor-pointer transition-all border ${
          activeTab === 'subjective'
            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
            : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-200'
        }`}
      >
        S - Subjective
      </button>
      <button
        onClick={() => onSelectTab('objective')}
        className={`px-3.5 py-1.5 rounded-xl font-bold cursor-pointer transition-all border ${
          activeTab === 'objective'
            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
            : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-200'
        }`}
      >
        O - Objective
      </button>
      <button
        onClick={() => onSelectTab('assessment')}
        className={`px-3.5 py-1.5 rounded-xl font-bold cursor-pointer transition-all border ${
          activeTab === 'assessment'
            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
            : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-200'
        }`}
      >
        A - Assessment
      </button>
      <button
        onClick={() => onSelectTab('plan')}
        className={`px-3.5 py-1.5 rounded-xl font-bold cursor-pointer transition-all border ${
          activeTab === 'plan'
            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
            : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-200'
        }`}
      >
        P - Plan
      </button>
    </div>
  );
};
