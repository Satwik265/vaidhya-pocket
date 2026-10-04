import React from 'react';
import { Stethoscope, History, BarChart3, Wifi, Sparkles, Cpu, Globe, Radio } from 'lucide-react';
import { useTranslation } from '../i18n';

interface HeaderProps {
  onOpenHistory: () => void;
  onOpenAnalytics: () => void;
  onSelectSampleScenario: () => void;
  onNavigateToLanding?: () => void;
  onNavigateToTriage?: () => void;
  activeTriageAlertsCount?: number;
  totalEncountersCount: number;
  safetyAlertsCount: number;
  isOfflineMode?: boolean;
  onToggleOfflineMode?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenHistory,
  onOpenAnalytics,
  onSelectSampleScenario,
  onNavigateToLanding,
  onNavigateToTriage,
  activeTriageAlertsCount = 0,
  totalEncountersCount,
  isOfflineMode = false,
  onToggleOfflineMode,
}) => {
  const { language, setLanguage, t } = useTranslation();

  return (
    <header id="header-container" className="bg-white text-slate-900 border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      <div id="header-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Branding */}
        <div id="branding-section" className="flex items-center space-x-3 cursor-pointer" onClick={onNavigateToLanding}>
          <div id="brand-logo" className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-xs font-bold">
            <Stethoscope className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 id="app-title" className="font-bold text-lg text-slate-800 tracking-tight">{t.header.title} <span className="text-blue-600 font-extrabold">Lite</span></h1>
              <span id="badge-primary-care" className="badge-brand">
                {t.header.badge}
              </span>
            </div>
            <p id="app-subtitle" className="text-xs text-slate-500 font-medium hidden sm:block">{t.header.subtitle}</p>
          </div>
        </div>

        {/* Center - Status Indicators & Offline Toggle */}
        <div id="status-section" className="hidden md:flex items-center space-x-3 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
          <button
            id="btn-toggle-offline-mode"
            onClick={onToggleOfflineMode}
            className={`flex items-center space-x-1.5 px-2 py-0.5 rounded-md font-semibold text-[11px] transition-colors ${
              isOfflineMode
                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
            }`}
            title={isOfflineMode ? t.header.switchToCloud : t.header.switchToOffline}
          >
            {isOfflineMode ? (
              <>
                <Cpu className="w-3.5 h-3.5 text-amber-700 animate-pulse" />
                <span>{t.header.offlineActive}</span>
              </>
            ) : (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-700" />
                <span>{t.header.cloudActive}</span>
              </>
            )}
          </button>
          <span className="text-slate-300">|</span>
          <div className="flex items-center space-x-1 text-slate-600 font-medium">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
            <span>{t.header.guardrailsActive}</span>
          </div>
        </div>

        {/* Action Controls & Language Switcher */}
        <div id="header-actions" className="flex items-center space-x-2 sm:space-x-3">
          {/* Language Switcher Pill */}
          <div id="language-switcher" className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-semibold">
            <Globe className="w-3.5 h-3.5 text-slate-500 ml-1.5 mr-1" />
            <button
              id="btn-lang-en"
              onClick={() => setLanguage('en')}
              className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-colors ${
                language === 'en'
                  ? 'bg-white text-blue-600 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title={t.header.langEnglish}
            >
              EN
            </button>
            <button
              id="btn-lang-hi"
              onClick={() => setLanguage('hi')}
              className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-colors ${
                language === 'hi'
                  ? 'bg-white text-blue-600 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title={t.header.langHindi}
            >
              HI
            </button>
          </div>

          {onNavigateToLanding && (
            <button
              id="btn-goto-landing"
              onClick={onNavigateToLanding}
              className="btn-outline text-slate-700 border-slate-300 py-1.5 px-3 text-xs"
              title={t.header.returnToLanding}
            >
              <span className="hidden sm:inline">{t.header.productInfo}</span>
              <span className="sm:hidden">{t.header.infoShort}</span>
            </button>
          )}

          {onNavigateToTriage && (
            <button
              id="btn-goto-triage-queue"
              onClick={onNavigateToTriage}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTriageAlertsCount > 0
                  ? 'bg-red-600 text-white border-red-500 shadow-md animate-pulse'
                  : 'bg-red-50 text-red-700 hover:bg-red-100 border-red-200'
              }`}
              title="Hospital Staff Emergency Triage Queue"
            >
              <Radio className={`w-3.5 h-3.5 ${activeTriageAlertsCount > 0 ? 'text-white' : 'text-red-600'}`} />
              <span className="hidden sm:inline">Triage Queue</span>
              {activeTriageAlertsCount > 0 && (
                <span className="bg-white text-red-600 font-black px-1.5 py-0.2 text-[10px] rounded-full shadow-xs">
                  {activeTriageAlertsCount}
                </span>
              )}
            </button>
          )}

          <button
            id="btn-sample-scenarios"
            onClick={onSelectSampleScenario}
            className="btn-outline text-blue-700 bg-blue-50 hover:bg-blue-100 border-blue-200"
            title={t.header.loadSampleTitle}
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">{t.header.loadSampleCase}</span>
          </button>

          <button
            id="btn-open-history"
            onClick={onOpenHistory}
            className="btn-secondary py-1.5 px-3.5"
            title={t.header.historyTitle}
          >
            <History className="w-4 h-4 text-slate-600" />
            <span className="hidden md:inline">{t.header.encounters}</span>
            {totalEncountersCount > 0 && (
              <span className="bg-blue-600 text-white font-bold px-1.5 py-0.2 text-[11px] rounded-full">
                {totalEncountersCount}
              </span>
            )}
          </button>

          <button
            id="btn-open-analytics"
            onClick={onOpenAnalytics}
            className="btn-primary py-2 px-3.5 shadow-xs"
            title={t.header.analyticsTitle}
          >
            <BarChart3 className="w-4 h-4 text-white" />
            <span className="hidden md:inline">{t.header.analytics}</span>
          </button>
        </div>
      </div>
    </header>
  );
};

