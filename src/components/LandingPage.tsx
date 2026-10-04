import React, { useState } from 'react';
import {
  Stethoscope,
  Sparkles,
  ShieldAlert,
  Clock,
  FileCheck,
  Check,
  ArrowRight,
  Send,
  CheckCircle2,
  Lock,
  Zap,
  Activity,
  HeartPulse,
  Award,
  Users,
  Building2
} from 'lucide-react';

interface LandingPageProps {
  onLaunchWorkstation: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLaunchWorkstation }) => {
  // Request access form state
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    clinicName: '',
    role: 'Physician',
    monthlyEncounters: '100-500',
  });
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName || !formData.email || !formData.clinicName) return;
    setIsSubmitted(true);
  };

  return (
    <div id="landing-page" className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* 1. Header Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-xs font-bold">
              <Stethoscope className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg text-slate-800 tracking-tight">MedScribe <span className="text-blue-600 font-extrabold">Lite</span></span>
                <span className="badge-brand">Safety Copilot</span>
              </div>
              <p className="text-xs text-slate-500 font-medium hidden sm:block">Primary Care Clinical Safety Copilot & Scribe</p>
            </div>
          </div>

          <div className="hidden md:flex items-center space-x-6 text-xs font-semibold text-slate-600">
            <a href="#problem" className="hover:text-blue-600 transition-colors">Problem</a>
            <a href="#product" className="hover:text-blue-600 transition-colors">Product Preview</a>
            <a href="#pricing" className="hover:text-blue-600 transition-colors">Pricing</a>
            <a href="#request-access" className="hover:text-blue-600 transition-colors">Request Access</a>
          </div>

          <button
            id="btn-nav-launch-workstation"
            onClick={onLaunchWorkstation}
            className="btn-primary py-2 px-4 shadow-xs text-xs flex items-center space-x-2"
          >
            <Sparkles className="w-4 h-4 text-white fill-white" />
            <span>Launch Workstation</span>
          </button>
        </div>
      </header>

      <main className="flex-1 space-y-16 pb-16">
        {/* 2. Hero Section */}
        <section id="hero" className="relative bg-gradient-to-b from-white to-slate-50 pt-12 pb-16 border-b border-slate-200/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
            <div className="inline-flex items-center space-x-2 bg-blue-50 border border-blue-200 text-blue-700 px-3.5 py-1.5 rounded-full text-xs font-bold">
              <ShieldAlert className="w-4 h-4 text-blue-600" />
              <span>AI Clinical Safety Copilot & Documentation Assistant</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight max-w-4xl mx-auto leading-[1.15]">
              AI-Powered Clinical Documentation & Safety Assistant Built for <span className="text-blue-600">Small Independent Clinics</span> & Community Health Centers.
            </h1>

            <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed font-normal">
              Turn unstructured doctor-patient consultation dictations into verified SOAP notes, ICD-10/CPT billing codes, and real-time drug safety alerts in under 2 minutes.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <button
                id="btn-hero-launch"
                onClick={onLaunchWorkstation}
                className="btn-primary py-3.5 px-7 text-sm font-bold shadow-md flex items-center space-x-2.5 w-full sm:w-auto justify-center"
              >
                <Sparkles className="w-5 h-5 text-white fill-white" />
                <span>Launch Live Workstation</span>
                <ArrowRight className="w-4 h-4 text-white/80" />
              </button>

              <a
                href="#request-access"
                className="btn-secondary py-3.5 px-6 text-sm font-bold w-full sm:w-auto text-center"
              >
                Request Early Access
              </a>
            </div>

            {/* Micro Highlights Bar */}
            <div className="pt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500 font-medium border-t border-slate-200/60 max-w-3xl mx-auto">
              <div className="flex items-center space-x-1.5">
                <Zap className="w-4 h-4 text-amber-500" />
                <span>Sub-200ms Motion Transitions</span>
              </div>
              <span className="text-slate-300 hidden sm:inline">•</span>
              <div className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>100% Fact Accuracy Guardrails</span>
              </div>
              <span className="text-slate-300 hidden sm:inline">•</span>
              <div className="flex items-center space-x-1.5">
                <HeartPulse className="w-4 h-4 text-blue-500" />
                <span>Low-Resource Optimized</span>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Problem & Impact Section */}
        <section id="problem" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-xs font-bold text-blue-600 uppercase tracking-wider">The Rural & Small Practice Reality</h2>
            <p className="text-2xl font-bold text-slate-800 tracking-tight">Built specifically for high-volume, low-resource primary care settings</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-3 relative overflow-hidden">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center font-bold">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-slate-800">40%+ Consultation Time Lost</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Clinicians seeing 40+ patients daily spend up to 4 hours manually writing clinical notes, creating extreme burnout and delayed patient care.
              </p>
              <div className="pt-2 text-xs font-bold text-blue-600 flex items-center space-x-1">
                <span>MedScribe Impact:</span>
                <span className="text-slate-700 font-semibold">Saves 12+ min per encounter</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-3 relative overflow-hidden">
              <div className="w-10 h-10 rounded-2xl bg-red-50 border border-red-100 text-red-600 flex items-center justify-center font-bold">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-slate-800">Overlooked Drug Safety & Allergies</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                High patient load and complex drug histories lead to missed drug-drug interaction warnings and contraindication auditing in busy clinics.
              </p>
              <div className="pt-2 text-xs font-bold text-blue-600 flex items-center space-x-1">
                <span>MedScribe Impact:</span>
                <span className="text-slate-700 font-semibold">Instant clinical safety alerts</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-3 relative overflow-hidden">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                <FileCheck className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-slate-800">Uncaptured Billing Revenue</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Without dedicated billing staff, primary care providers miss standard ICD-10 diagnostic codes and CPT evaluation levels required for clinic reimbursement.
              </p>
              <div className="pt-2 text-xs font-bold text-blue-600 flex items-center space-x-1">
                <span>MedScribe Impact:</span>
                <span className="text-slate-700 font-semibold">Automated ICD-10 & CPT coding</span>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Product Preview Section */}
        <section id="product" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-xs font-bold text-blue-600 uppercase tracking-wider">Product Showcase</h2>
            <p className="text-2xl font-bold text-slate-800 tracking-tight">Clinical Workstation</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 text-xs">
              <div className="flex items-center space-x-2 text-slate-400">
                <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block"></span>
                <span className="w-3 h-3 rounded-full bg-yellow-500/80 inline-block"></span>
                <span className="w-3 h-3 rounded-full bg-green-500/80 inline-block"></span>
                <span className="font-mono text-[11px] text-slate-400 ml-2">medscribe-lite.clinic/workstation</span>
              </div>
              <span className="badge-brand bg-blue-900/50 text-blue-300 border-blue-700">Interactive Workstation View</span>
            </div>

            {/* Bento Visual Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-slate-850 bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs text-blue-400 font-bold">
                  <span>1. Patient Demographics & Dictation</span>
                  <span className="text-[10px] text-slate-400">Live Speech-to-Text</span>
                </div>
                <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl text-slate-300 font-mono text-xs space-y-2">
                  <div className="text-slate-400 text-[11px]">Patient: Kwame Mensah (28M) • Sub-District Health Center</div>
                  <p className="text-slate-200">"Doctor: Good morning. Patient: I have had high fever, chills, and headache for 3 days. Doctor: Any joint pain or vomiting?..."</p>
                </div>
              </div>

              <div className="bg-slate-850 bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs text-emerald-400 font-bold">
                  <span>2. Verified Bento SOAP Note</span>
                  <span className="text-[10px] text-slate-400">On-device Engine</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-900 border border-blue-500/30 p-2.5 rounded-xl text-xs">
                    <span className="font-bold text-blue-400 block text-[10px]">SUBJECTIVE</span>
                    <span className="text-slate-300 text-[11px]">Acute fever, chills, severe frontal headache x 3 days.</span>
                  </div>
                  <div className="bg-slate-900 border border-emerald-500/30 p-2.5 rounded-xl text-xs">
                    <span className="font-bold text-emerald-400 block text-[10px]">OBJECTIVE</span>
                    <span className="text-slate-300 text-[11px]">Temp 38.8°C, HR 98 bpm, BP 118/76, RDT Positive.</span>
                  </div>
                  <div className="bg-slate-900 border border-indigo-500/30 p-2.5 rounded-xl text-xs">
                    <span className="font-bold text-indigo-400 block text-[10px]">ASSESSMENT</span>
                    <span className="text-slate-300 text-[11px]">Acute Uncomplicated Plasmodium Falciparum Malaria.</span>
                  </div>
                  <div className="bg-slate-900 border border-teal-500/30 p-2.5 rounded-xl text-xs">
                    <span className="font-bold text-teal-400 block text-[10px]">PLAN</span>
                    <span className="text-slate-300 text-[11px]">Artemether-Lumefantrine 80/480mg PO BID x 3 days.</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 text-center">
              <button
                onClick={onLaunchWorkstation}
                className="btn-primary py-2.5 px-6 text-xs font-bold shadow-xs inline-flex items-center space-x-2"
              >
                <span>Launch Workstation to Test All 5 Scenarios</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </section>

        {/* 5. Pricing Tiers Section */}
        <section id="pricing" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-xs font-bold text-blue-600 uppercase tracking-wider">Transparent Clinic Pricing</h2>
            <p className="text-2xl font-bold text-slate-800 tracking-tight">Simple plans tailored for rural practices & health networks</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {/* Free Tier */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="font-bold text-lg text-slate-800">Community Outreach</h3>
                  <p className="text-xs text-slate-500">Solo rural health workers & outreach units</p>
                </div>

                <div className="flex items-baseline space-x-1">
                  <span className="text-3xl font-black text-slate-900">₹0</span>
                  <span className="text-xs text-slate-500 font-medium">/ month</span>
                </div>

                <ul className="space-y-2.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                  <li className="flex items-start space-x-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Ambient Speech-to-Text dictation</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>5 pre-loaded clinical scenarios</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>On-device SOAP generation, no cloud call</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>LocalStorage encounter history</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Basic drug interaction & safety flags</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={onLaunchWorkstation}
                className="btn-secondary w-full py-2.5 text-xs font-bold text-center"
              >
                Use Community Free Tier
              </button>
            </div>

            {/* Independent Clinic Tier (Highlighted) */}
            <div className="bg-white border-2 border-blue-600 rounded-3xl p-6 shadow-md flex flex-col justify-between space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">
                Most Popular
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="font-bold text-lg text-slate-900">Independent Clinic</h3>
                  <p className="text-xs text-slate-500">Small independent clinics (1-5 providers)</p>
                </div>

                <div className="flex items-baseline space-x-1">
                  <span className="text-3xl font-black text-slate-900">₹199</span>
                  <span className="text-xs text-slate-500 font-medium">/ clinic / month</span>
                </div>

                <ul className="space-y-2.5 text-xs text-slate-700 pt-2 border-t border-slate-100">
                  <li className="flex items-start space-x-2 font-semibold">
                    <Check className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <span>Everything in Free Tier</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <span>Priority API throughput & zero queue delay</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <span>Custom clinic header on prescription slips</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <span>FHIR / EHR export options</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <span>Automated Safety Copilot guardrail audits</span>
                  </li>
                </ul>
              </div>

              <a
                href="#request-access"
                className="btn-primary w-full py-3 text-xs font-bold text-center shadow-xs"
              >
                Request Clinic Access
              </a>
            </div>

            {/* Multi-Provider Tier */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="font-bold text-lg text-slate-800">Multi-Provider Network</h3>
                  <p className="text-xs text-slate-500">Regional primary care networks & centers</p>
                </div>

                <div className="flex items-baseline space-x-1">
                  <span className="text-3xl font-black text-slate-900">₹499</span>
                  <span className="text-xs text-slate-500 font-medium">/ center / month</span>
                </div>

                <ul className="space-y-2.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                  <li className="flex items-start space-x-2 font-semibold text-slate-700">
                    <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                    <span>Everything in Independent Clinic Tier</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                    <span>Multi-provider team workspace & roles</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                    <span>Localized drug interaction database overrides</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                    <span>Regional ICD-10 & CPT custom coding rules</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                    <span>Priority SLA & dedicated onboarding support</span>
                  </li>
                </ul>
              </div>

              <a
                href="#request-access"
                className="btn-secondary w-full py-2.5 text-xs font-bold text-center"
              >
                Contact Network Sales
              </a>
            </div>
          </div>
        </section>

        {/* 6. Request Access CTA Form */}
        <section id="request-access" className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center mx-auto">
                <Send className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-slate-800">Request Early Access for Your Clinic</h2>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Join our pilot program for small independent clinics and community health centers.
              </p>
            </div>

            {isSubmitted ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <h3 className="font-bold text-base text-emerald-900">Access Request Received!</h3>
                <p className="text-xs text-emerald-700 max-w-md mx-auto leading-relaxed">
                  Thank you, <strong>{formData.fullName}</strong>! Your request for <strong>{formData.clinicName}</strong> has been registered. Our onboarding clinical team will contact you within 24 hours.
                </p>
                <div className="pt-2">
                  <button
                    onClick={onLaunchWorkstation}
                    className="btn-primary py-2 px-4 text-xs font-bold shadow-xs inline-flex items-center space-x-2"
                  >
                    <span>Launch Workstation Demo Right Now</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="Dr. Sarah Mensah"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Work Email *</label>
                    <input
                      type="email"
                      required
                      placeholder="sarah@communityhealth.org"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Clinic / Health Center Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="St. Jude Sub-District Clinic"
                    value={formData.clinicName}
                    onChange={(e) => setFormData({ ...formData, clinicName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Primary Role</label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="Physician">Physician / Medical Officer</option>
                      <option value="Nurse Practitioner">Nurse Practitioner / Midwife</option>
                      <option value="Community Health Worker">Community Health Worker</option>
                      <option value="Clinic Administrator">Clinic Administrator</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Monthly Patient Encounters</label>
                    <select
                      value={formData.monthlyEncounters}
                      onChange={(e) => setFormData({ ...formData, monthlyEncounters: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="<100">&lt; 100 encounters / month</option>
                      <option value="100-500">100 - 500 encounters / month</option>
                      <option value="500-2000">500 - 2,000 encounters / month</option>
                      <option value="2000+">2,000+ encounters / month</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="btn-primary w-full py-3 text-xs font-bold shadow-xs flex items-center justify-center space-x-2"
                  >
                    <Send className="w-4 h-4 text-white" />
                    <span>Submit Request Access</span>
                  </button>
                </div>

                <div className="text-[11px] text-slate-400 text-center flex items-center justify-center space-x-1">
                  <Lock className="w-3 h-3 text-slate-400" />
                  <span>Front-end demo form — backend API endpoint integration flagged for Phase 4 follow-up.</span>
                </div>
              </form>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <Stethoscope className="w-4 h-4 text-blue-600" />
            <span className="font-bold text-slate-800">MedScribe Lite</span>
            <span>• Primary Care Clinical Safety Copilot & Scribe</span>
          </div>
          <div className="flex items-center space-x-4">
            <button onClick={onLaunchWorkstation} className="text-blue-600 font-bold hover:underline">
              Launch Workstation Demo
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
