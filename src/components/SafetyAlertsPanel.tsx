import React from 'react';
import { motion } from 'motion/react';
import { SafetyAlert, MetaInfo } from '../types';
import { ShieldAlert, AlertTriangle, Clock, CheckCircle2, HelpCircle } from 'lucide-react';

interface SafetyAlertsPanelProps {
  safetyAlerts: SafetyAlert[];
  meta: MetaInfo;
}

export const SafetyAlertsPanel: React.FC<SafetyAlertsPanelProps> = ({ safetyAlerts, meta }) => {
  const hasHighSeverity = safetyAlerts?.some((a) => a.severity?.toLowerCase() === 'high');

  return (
    <div id="safety-alerts-container" className="space-y-4">
      {/* Meta Indicators Header Bar */}
      <div id="meta-indicators-bar" className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
        <div className="flex items-center space-x-3">
          {/* Time Saved Badge */}
          <div className="badge-brand px-3 py-1.5 rounded-xl font-bold">
            <Clock className="w-4 h-4 text-blue-600" />
            <span>~{meta?.time_saved_estimate_minutes || 12} mins</span>
            <span className="text-slate-500 font-normal">documentation time saved</span>
          </div>

          {/* Uncertainty Flag */}
          {meta?.uncertainty_flagged ? (
            <div className="badge-warning px-3 py-1.5 rounded-xl font-bold">
              <HelpCircle className="w-4 h-4 text-amber-600" />
              <span>Clinical Uncertainty Flagged</span>
            </div>
          ) : (
            <div className="badge-success px-3 py-1.5 rounded-xl font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Full Clinical Confidence</span>
            </div>
          )}
        </div>

        <div className="text-slate-500 font-semibold text-xs flex items-center space-x-1">
          <ShieldAlert className="w-4 h-4 text-slate-400" />
          <span>Clinical Guardrails Audit Active</span>
        </div>
      </div>

      {/* Safety Alerts Card */}
      <div
        id="safety-alerts-card"
        className={`border rounded-3xl p-5 overflow-hidden shadow-xs transition-all ${
          hasHighSeverity
            ? 'bg-orange-50/80 border-orange-200 shadow-orange-100/50'
            : safetyAlerts?.length > 0
            ? 'bg-amber-50/70 border-amber-200 shadow-amber-100/50'
            : 'bg-white border-slate-200/80'
        }`}
      >
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-200/80">
          <div className="flex items-center space-x-3">
            <span className={`w-2 h-6 rounded-full shrink-0 ${hasHighSeverity ? 'bg-orange-500 animate-pulse' : 'bg-blue-600'}`}></span>
            <div className="flex items-center space-x-2">
              <ShieldAlert className={`w-5 h-5 ${hasHighSeverity ? 'text-orange-600 animate-bounce' : 'text-blue-600'}`} />
              <h3 className="font-bold text-sm text-slate-800 flex items-center space-x-2">
                <span>Clinical Safety & Interaction Alerts</span>
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                    safetyAlerts?.length > 0
                      ? hasHighSeverity
                        ? 'bg-orange-600 text-white shadow-xs'
                        : 'bg-amber-500 text-slate-950'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  {safetyAlerts?.length || 0} Alerts
                </span>
              </h3>
            </div>
          </div>
          <span className="text-xs text-slate-500 font-medium hidden sm:inline">Requires Doctor Verification</span>
        </div>

        <div className="mt-4 space-y-3 text-xs">
          {safetyAlerts?.length > 0 ? (
            safetyAlerts.map((alert, idx) => {
              const severity = alert.severity?.toLowerCase();
              return (
                <motion.div
                  key={idx}
                  tabIndex={0}
                  whileHover={{ scale: 1.015, y: -2 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className={`p-4 rounded-2xl border flex items-start space-x-3 bg-white shadow-xs transition-all outline-none focus:ring-2 cursor-pointer ${
                    severity === 'high'
                      ? 'border-orange-300 hover:border-orange-500 focus:ring-orange-400/60 shadow-orange-100 hover:shadow-orange-200/80 text-orange-950'
                      : severity === 'medium'
                      ? 'border-amber-300 hover:border-amber-500 focus:ring-amber-400/60 text-amber-950'
                      : 'border-slate-200 hover:border-blue-400 focus:ring-blue-400/60 text-slate-800'
                  }`}
                >
                  <AlertTriangle
                    className={`w-4 h-4 shrink-0 mt-0.5 ${
                      severity === 'high'
                        ? 'text-orange-600 animate-pulse'
                        : severity === 'medium'
                        ? 'text-amber-600'
                        : 'text-blue-600'
                    }`}
                  />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs tracking-wide uppercase text-slate-800">
                        {alert.type || 'Safety Flag'}
                      </span>
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-lg transition-transform ${
                          severity === 'high'
                            ? 'bg-orange-600 text-white shadow-xs tracking-wider'
                            : severity === 'medium'
                            ? 'bg-amber-100 text-amber-900 border border-amber-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {alert.severity} Severity
                      </span>
                    </div>
                    <p className="leading-relaxed text-slate-700 font-medium">{alert.message}</p>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <div className="badge-success w-full p-4 rounded-2xl flex items-center space-x-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>No drug interaction or documentation red flags detected in this encounter.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

