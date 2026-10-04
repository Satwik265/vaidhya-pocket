import React, { useState, useEffect, useRef } from 'react';
import { EmergencyTriageAlert } from '../../types';
import {
  AlertTriangle,
  BellRing,
  Volume2,
  VolumeX,
  RefreshCw,
  CheckCircle2,
  Clock,
  User,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  Activity,
  HeartPulse,
  Radio,
  PlusCircle,
  Trash2,
  ArrowLeft,
  Building2,
} from 'lucide-react';
import {
  getLocalTriageAlerts,
  saveLocalTriageAlert,
  publishEmergencyAlert,
  playEmergencyAlertChime,
} from '../../utils/emergencyTriageDetector';

export interface TriageQueueProps {
  onNavigateToWorkstation?: () => void;
  onNavigateToKiosk?: () => void;
  onSelectPatientForConsultation?: (alert: EmergencyTriageAlert) => void;
}

export const TriageQueue: React.FC<TriageQueueProps> = ({
  onNavigateToWorkstation,
  onNavigateToKiosk,
  onSelectPatientForConsultation,
}) => {
  const [alerts, setAlerts] = useState<EmergencyTriageAlert[]>(() => {
    const local = getLocalTriageAlerts();
    if (local.length > 0) return local;
    return [
      {
        id: 'TRG-SYNTH-001',
        timestamp: new Date().toISOString(),
        patientName: 'SYNTHETIC DEMO PATIENT',
        age: 48,
        gender: 'Male',
        abhaId: '91-2345-6789-0123 (DEMO)',
        kioskStationId: 'Kiosk #01 (OPD Lobby)',
        emergencyCategory: 'Acute Cardiovascular Crisis (ACS / Myocardial Infarction)',
        detectedPattern: 'Chest pain combined with shortness of breath, diaphoresis, or radiating pain',
        matchedKeywords: ['crushing chest pain', 'shortness of breath', 'left arm'],
        severity: 'CRITICAL_EMERGENCY',
        triageColor: 'Red',
        triggerInputText: 'Patient reports severe retrosternal crushing chest pain radiating to left arm and acute shortness of breath.',
        status: 'active',
        actionDirectives: [
          'IMMEDIATE ACTION: Dispatch emergency response nurse with crash cart',
          'Keep patient seated upright and resting at kiosk terminal #01',
          'Prepare emergency 12-lead ECG and continuous cardiac monitoring',
        ],
      },
    ];
  });
  const [isPolling, setIsPolling] = useState<boolean>(true);
  const [lastPollTime, setLastPollTime] = useState<string>(new Date().toLocaleTimeString());
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'attended' | 'resolved'>('all');
  const [activeStaffNote, setActiveStaffNote] = useState<{ [alertId: string]: string }>({});

  const previousActiveCountRef = useRef<number>(alerts.filter((a) => a.status === 'active').length);

  // Fetch alerts from backend API and combine with local cache
  const fetchAlerts = async () => {
    try {
      const res = await fetch('/api/triage/alerts');
      if (res.ok) {
        const data = await res.json();
        const serverAlerts: EmergencyTriageAlert[] = data.alerts || [];

        // Merge server and local alerts (server wins on status updates)
        const local = getLocalTriageAlerts();
        const mergedMap = new Map<string, EmergencyTriageAlert>();

        local.forEach((a) => mergedMap.set(a.id, a));
        serverAlerts.forEach((a) => mergedMap.set(a.id, a));

        const combined = Array.from(mergedMap.values()).sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        if (combined.length > 0) {
          setAlerts(combined);
        }
        setLastPollTime(new Date().toLocaleTimeString());

        // Play chime if new active alert appeared
        const currentActive = combined.filter((a) => a.status === 'active').length;
        if (currentActive > previousActiveCountRef.current && soundEnabled) {
          playEmergencyAlertChime();
        }
        previousActiveCountRef.current = currentActive;
      } else {
        const local = getLocalTriageAlerts();
        if (local.length > 0) {
          setAlerts(local);
        }
        setLastPollTime(new Date().toLocaleTimeString());
      }
    } catch {
      // Fall back to local store
      const local = getLocalTriageAlerts();
      if (local.length > 0) {
        setAlerts(local);
      }
      setLastPollTime(new Date().toLocaleTimeString());
    }
  };

  // Real-time Polling every 2 seconds
  useEffect(() => {
    fetchAlerts();

    let intervalId: any = null;
    if (isPolling) {
      intervalId = setInterval(fetchAlerts, 2000);
    }

    // Also listen for cross-tab or in-tab local events for zero-latency response
    const handleStorageEvent = () => fetchAlerts();
    const handleCustomEvent = () => fetchAlerts();

    window.addEventListener('storage', handleStorageEvent);
    window.addEventListener('triage-alert-updated', handleCustomEvent);

    return () => {
      if (intervalId) clearInterval(intervalId);
      window.removeEventListener('storage', handleStorageEvent);
      window.removeEventListener('triage-alert-updated', handleCustomEvent);
    };
  }, [isPolling, soundEnabled]);

  // Update alert status (e.g. staff en route, attended, resolved)
  const handleUpdateStatus = async (alertId: string, newStatus: 'staff_en_route' | 'attended' | 'resolved') => {
    const existing = alerts.find((a) => a.id === alertId);
    if (!existing) return;

    const note = activeStaffNote[alertId] || existing.staffNotes;
    const updated: EmergencyTriageAlert = {
      ...existing,
      status: newStatus,
      staffNotes: note,
      acknowledgedAt: new Date().toISOString(),
    };

    saveLocalTriageAlert(updated);
    setAlerts((prev) => prev.map((a) => (a.id === alertId ? updated : a)));

    // Send to backend
    try {
      await fetch(`/api/triage/alerts/${alertId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
    } catch (e) {
      console.warn('Could not patch server alert:', e);
    }
  };

  // Clear all alerts
  const handleClearAlerts = async () => {
    if (!confirm('Clear all triage alert history?')) return;
    localStorage.removeItem('medscribe_triage_alerts_v1');
    setAlerts([]);
    try {
      await fetch('/api/triage/alerts', { method: 'DELETE' });
    } catch {
      // ignore
    }
  };

  // Inject a simulated emergency alert for easy testing
  const handleSimulateAlert = async (type: 'chest_pain' | 'stroke' | 'headache') => {
    let mockText = '';
    let mockPattern = '';
    let mockCategory = '';
    let mockKeywords: string[] = [];

    if (type === 'chest_pain') {
      mockText = 'I have crushing chest pain and severe shortness of breath radiating to my left arm.';
      mockPattern = 'Chest pain combined with shortness of breath, diaphoresis, or radiating pain';
      mockCategory = 'Acute Cardiovascular Crisis (ACS / Myocardial Infarction)';
      mockKeywords = ['crushing chest pain', 'shortness of breath', 'left arm'];
    } else if (type === 'stroke') {
      mockText = 'Sudden facial droop and right arm weakness since 20 minutes ago, speech is slurred.';
      mockPattern = 'Stroke-pattern symptoms: facial droop, unilateral weakness, or sudden speech disturbance';
      mockCategory = 'Acute Neurological Emergency (Stroke / CVA)';
      mockKeywords = ['facial droop', 'arm weakness', 'speech is slurred'];
    } else {
      mockText = 'Sudden severe thunderclap headache with blurry double vision and stiff neck.';
      mockPattern = 'Sudden severe headache accompanied by vision changes, diplopia, or neck stiffness';
      mockCategory = 'Intracranial Emergency (Subarachnoid Hemorrhage / Meningitis)';
      mockKeywords = ['sudden severe headache', 'blurry double vision', 'stiff neck'];
    }

    const testAlert: EmergencyTriageAlert = {
      id: `TRG-SIM-${Date.now()}`,
      timestamp: new Date().toISOString(),
      patientName: 'SYNTHETIC DEMO PATIENT',
      age: type === 'chest_pain' ? 48 : type === 'stroke' ? 68 : 41,
      gender: type === 'stroke' ? 'Female' : 'Male',
      abhaId: '91-2345-6789-0123 (DEMO)',
      kioskStationId: 'Kiosk #01 (OPD Lobby)',
      emergencyCategory: mockCategory,
      detectedPattern: mockPattern,
      matchedKeywords: mockKeywords,
      severity: 'CRITICAL_EMERGENCY',
      triageColor: 'Red',
      triggerInputText: mockText,
      status: 'active',
      actionDirectives: [
        'IMMEDIATE ACTION: Dispatch emergency response nurse with crash cart',
        'Keep patient seated upright and resting at kiosk terminal #01',
        'Prepare emergency 12-lead ECG and continuous cardiac monitoring',
      ],
    };

    if (soundEnabled) {
      playEmergencyAlertChime();
    }

    await publishEmergencyAlert(testAlert);
    await fetchAlerts();
  };

  const activeAlerts = alerts.filter((a) => a.status === 'active');
  const enRouteAlerts = alerts.filter((a) => a.status === 'staff_en_route');
  const attendedAlerts = alerts.filter((a) => a.status === 'attended');
  const resolvedAlerts = alerts.filter((a) => a.status === 'resolved');

  const filteredAlerts =
    filterStatus === 'all'
      ? alerts
      : filterStatus === 'active'
      ? alerts.filter((a) => a.status === 'active' || a.status === 'staff_en_route')
      : filterStatus === 'attended'
      ? attendedAlerts
      : resolvedAlerts;

  return (
    <div id="triage-queue-screen" className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-40 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-red-600/20 border border-red-500/40 text-red-400">
            <Radio className="w-6 h-6 animate-pulse text-red-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-red-600 text-white font-black text-[11px] uppercase tracking-wider">
                Live Emergency Triage
              </span>
              <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>Active Terminal Polling</span>
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">
              Hospital Triage Queue & Kiosk Safety Monitor
            </h1>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Sound Toggle */}
          <button
            id="triage-sound-toggle-btn"
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              soundEnabled
                ? 'bg-slate-800 text-teal-300 border-slate-700 hover:bg-slate-750'
                : 'bg-slate-900 text-slate-500 border-slate-800'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-teal-400" /> : <VolumeX className="w-4 h-4" />}
            <span>{soundEnabled ? 'Chime ON' : 'Muted'}</span>
          </button>

          {/* Manual Refresh */}
          <button
            id="triage-refresh-btn"
            type="button"
            onClick={fetchAlerts}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all cursor-pointer"
            title="Refresh alerts now"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Navigation to Workstation */}
          {onNavigateToWorkstation && (
            <button
              id="triage-nav-workstation-btn"
              type="button"
              onClick={onNavigateToWorkstation}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Doctor Workstation</span>
            </button>
          )}

          {/* Navigation to Kiosk */}
          {onNavigateToKiosk && (
            <button
              id="triage-nav-kiosk-btn"
              type="button"
              onClick={onNavigateToKiosk}
              className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow"
            >
              <span>Kiosk Terminal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Critical Active Alert Banner (If Any Active Red Flags) */}
        {activeAlerts.length > 0 && (
          <div
            id="triage-critical-active-banner"
            className="w-full bg-gradient-to-r from-red-700 via-red-600 to-rose-700 rounded-3xl p-5 sm:p-6 text-white shadow-[0_0_50px_rgba(220,38,38,0.4)] border-2 border-red-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-pulse"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white text-red-600 rounded-2xl shadow-lg">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div>
                <span className="px-2.5 py-0.5 rounded-full bg-black/40 text-yellow-300 font-mono font-black text-xs uppercase tracking-wider">
                  ACTION REQUIRED • {activeAlerts.length} PATIENT(S) IN EMERGENCY DISTRESS
                </span>
                <h2 className="text-xl sm:text-2xl font-black mt-1">
                  Active Red Flag Alert at MediKiosk Terminal
                </h2>
                <p className="text-xs sm:text-sm text-red-100 mt-0.5">
                  Live interview interrupted. Emergency nursing team dispatched to station.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-4 py-2 rounded-2xl bg-black/50 text-white font-mono font-bold text-xs border border-white/20">
                Latest: {activeAlerts[0]?.detectedPattern.slice(0, 45)}...
              </span>
            </div>
          </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-1">
            <span className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
              Active Critical Red
            </span>
            <span className="text-3xl font-black text-white font-mono">{activeAlerts.length}</span>
            <span className="text-[11px] text-slate-500">Requires immediate bedside dispatch</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-1">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
              Staff En Route
            </span>
            <span className="text-3xl font-black text-white font-mono">{enRouteAlerts.length}</span>
            <span className="text-[11px] text-slate-500">Clinical nurse on the way</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-1">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
              Attended / In Care
            </span>
            <span className="text-3xl font-black text-white font-mono">{attendedAlerts.length}</span>
            <span className="text-[11px] text-slate-500">Under nurse/doctor care</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Resolved Today
            </span>
            <span className="text-3xl font-black text-white font-mono">{resolvedAlerts.length}</span>
            <span className="text-[11px] text-slate-500">Cleared or admitted to casualty</span>
          </div>
        </div>

        {/* Action & Filter Toolbar */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'all', label: `All Alerts (${alerts.length})` },
              { id: 'active', label: `Active / En Route (${activeAlerts.length + enRouteAlerts.length})` },
              { id: 'attended', label: `Attended (${attendedAlerts.length})` },
              { id: 'resolved', label: `Resolved (${resolvedAlerts.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterStatus(tab.id as any)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filterStatus === tab.id
                    ? 'bg-red-600 text-white shadow'
                    : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-750'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Testing Simulator Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider hidden md:inline">
              Test Red Flags:
            </span>
            <button
              id="simulate-chest-pain-btn"
              type="button"
              onClick={() => handleSimulateAlert('chest_pain')}
              className="px-3 py-1.5 rounded-xl bg-red-950/70 border border-red-700/60 hover:border-red-500 text-red-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:bg-red-900/50 transition-all"
            >
              <HeartPulse className="w-3.5 h-3.5 text-red-400" />
              <span>+ Chest Pain (ACS)</span>
            </button>
            <button
              id="simulate-stroke-btn"
              type="button"
              onClick={() => handleSimulateAlert('stroke')}
              className="px-3 py-1.5 rounded-xl bg-red-950/70 border border-red-700/60 hover:border-red-500 text-red-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:bg-red-900/50 transition-all"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
              <span>+ Stroke (FAST)</span>
            </button>
            <button
              id="simulate-headache-btn"
              type="button"
              onClick={() => handleSimulateAlert('headache')}
              className="px-3 py-1.5 rounded-xl bg-red-950/70 border border-red-700/60 hover:border-red-500 text-red-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:bg-red-900/50 transition-all"
            >
              <Activity className="w-3.5 h-3.5 text-orange-400" />
              <span>+ Thunderclap</span>
            </button>

            {alerts.length > 0 && (
              <button
                type="button"
                onClick={handleClearAlerts}
                className="p-1.5 rounded-xl text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-all cursor-pointer ml-1"
                title="Clear all alerts"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Alerts List */}
        <div className="space-y-4">
          {filteredAlerts.length === 0 ? (
            <div className="py-16 rounded-3xl bg-slate-900/50 border border-slate-800 flex flex-col items-center justify-center text-center p-6">
              <div className="p-4 rounded-3xl bg-emerald-500/10 text-emerald-400 mb-3">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <h3 className="text-lg font-black text-white">All Kiosks Clear</h3>
              <p className="text-xs sm:text-sm text-slate-400 max-w-sm mt-1">
                No active emergency red-flags currently flagged by patients during self-intake. Live polling continues in background.
              </p>
            </div>
          ) : (
            filteredAlerts.map((alert) => {
              const isCrit = alert.severity === 'CRITICAL_EMERGENCY';
              const isActive = alert.status === 'active';
              const isEnRoute = alert.status === 'staff_en_route';

              return (
                <div
                  key={alert.id}
                  id={`triage-card-${alert.id}`}
                  className={`rounded-3xl border-2 p-5 sm:p-6 transition-all relative shadow-xl flex flex-col gap-4 ${
                    isActive
                      ? 'bg-red-950/40 border-red-500 shadow-[0_0_35px_rgba(239,68,68,0.25)]'
                      : isEnRoute
                      ? 'bg-amber-950/30 border-amber-500'
                      : alert.status === 'attended'
                      ? 'bg-blue-950/20 border-blue-600/60'
                      : 'bg-slate-900/70 border-slate-800 opacity-75'
                  }`}
                >
                  {/* Alert Card Header */}
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800/80 pb-4">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span
                        className={`px-3 py-1 rounded-full font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow ${
                          isActive
                            ? 'bg-red-600 text-white animate-pulse'
                            : isEnRoute
                            ? 'bg-amber-500 text-slate-950'
                            : alert.status === 'attended'
                            ? 'bg-blue-500 text-white'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>
                          {isActive
                            ? 'LEVEL 1 RED ALERT • ACTIVE'
                            : isEnRoute
                            ? 'STAFF EN ROUTE'
                            : alert.status === 'attended'
                            ? 'ATTENDED'
                            : 'RESOLVED'}
                        </span>
                      </span>

                      <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-teal-300 font-mono text-xs font-bold">
                        {alert.kioskStationId}
                      </span>

                      <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{new Date(alert.timestamp).toLocaleTimeString()}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 font-medium">ABHA ID:</span>
                      <span className="font-mono text-xs font-bold text-teal-400 bg-slate-800/80 px-2 py-0.5 rounded">
                        {alert.abhaId || '91-8765-4321-0987'}
                      </span>
                    </div>
                  </div>

                  {/* Patient & Clinical Emergency Body */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Col 1: Patient Context */}
                    <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col gap-2">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Patient Demographic Context
                      </span>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-teal-300 font-black text-sm">
                          {alert.patientName[0]}
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-base">{alert.patientName}</h4>
                          <span className="text-xs text-slate-400">
                            {alert.age} yrs • {alert.gender}
                          </span>
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 border-t border-slate-800/80 pt-2">
                        <span>Intake Status: </span>
                        <span className="text-red-300 font-bold">Interrupted for Emergency Triage</span>
                      </div>
                    </div>

                    {/* Col 2: Detected Emergency Pattern */}
                    <div className="lg:col-span-2 p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-red-400 uppercase tracking-wider">
                          {alert.emergencyCategory}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 font-bold text-[11px]">
                          Real-time Intake Match
                        </span>
                      </div>

                      <h3 className="text-base sm:text-lg font-black text-white">
                        {alert.detectedPattern}
                      </h3>

                      {/* Exact patient trigger words */}
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs">
                        <span className="text-slate-500 block mb-1 font-mono">
                          Patient Exact Words (Captured live during input):
                        </span>
                        <p className="text-yellow-200 font-semibold italic">
                          "{alert.triggerInputText}"
                        </p>
                      </div>

                      {/* Clinical Directives */}
                      <div className="space-y-1 mt-1">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                          Triage Directives:
                        </span>
                        {alert.actionDirectives.map((d, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs text-slate-300">
                            <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                            <span>{d}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Staff Response Actions Footer */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(alert.id, 'staff_en_route')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          alert.status === 'staff_en_route'
                            ? 'bg-amber-500 text-slate-950 font-black shadow'
                            : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700'
                        }`}
                      >
                        <BellRing className="w-3.5 h-3.5" />
                        <span>Staff En Route</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(alert.id, 'attended')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          alert.status === 'attended'
                            ? 'bg-blue-600 text-white font-black shadow'
                            : 'bg-slate-800 hover:bg-slate-700 text-blue-300 border border-slate-700'
                        }`}
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>Mark Attended</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(alert.id, 'resolved')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          alert.status === 'resolved'
                            ? 'bg-emerald-600 text-white font-black shadow'
                            : 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Resolve Alert</span>
                      </button>
                    </div>

                    {onSelectPatientForConsultation && (
                      <button
                        type="button"
                        onClick={() => onSelectPatientForConsultation(alert)}
                        className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer shadow transition-all"
                      >
                        <span>Open in Doctor Workstation</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
};
