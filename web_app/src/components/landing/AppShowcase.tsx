import React, { useState } from 'react';
import {
  Mic,
  ShieldCheck,
  Send,
  Download,
  Smartphone,
  CheckCircle2,
  Clock,
  Globe2,
  FileCheck,
  Heart,
  MessageSquare,
  Lock
} from 'lucide-react';

export const AppShowcase: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'doctor' | 'patient'>('doctor');
  const [doctorVerified, setDoctorVerified] = useState<boolean>(true);

  return (
    <section id="apps" className="landing-section">
      <div className="showcase-header">
        <div className="section-tag">
          <Smartphone size={14} />
          <span>Dual Native Mobile Suite</span>
        </div>
        <h2 className="section-title">One Clinical Engine. Two Tailored Apps.</h2>
        <p className="section-subtitle" style={{ margin: '0 auto' }}>
          Engineered for high-velocity OPD clinics and patient adherence across urban and rural India.
        </p>

        {/* Tab Selector */}
        <div className="tab-selector">
          <button
            className={`tab-btn ${activeTab === 'doctor' ? 'active' : ''}`}
            onClick={() => setActiveTab('doctor')}
          >
            <Mic size={16} />
            <span>Doctor Consultation App</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'patient' ? 'active' : ''}`}
            onClick={() => setActiveTab('patient')}
          >
            <Heart size={16} />
            <span>Patient Companion App</span>
          </button>
        </div>
      </div>

      <div className="showcase-content">
        {/* Left Side: Smartphone Mockup */}
        <div className="device-wrapper">
          <div className="phone-mockup">
            {/* Dynamic Island / Notch */}
            <div className="phone-notch">
              <div className="phone-camera"></div>
              <span style={{ fontSize: '9px', color: '#10b981', fontWeight: 700 }}>● REC</span>
            </div>

            {/* Screen Content: Doctor App */}
            {activeTab === 'doctor' && (
              <div className="phone-screen">
                {/* Status bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                    <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>NMC ID: 84920-A</span>
                  </div>
                  <span style={{ fontSize: '10px', color: '#06b6d4', fontWeight: 600 }}>Dr. Mayank</span>
                </div>

                {/* Patient Header */}
                <div style={{ background: 'rgba(255,255,255,0.04)', padding: '10px 12px', borderRadius: '12px', marginBottom: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: '#fff', fontSize: '12px' }}>Ramesh Sharma</span>
                    <span style={{ fontSize: '10px', color: '#10b981', background: 'rgba(16,185,129,0.15)', padding: '2px 8px', borderRadius: '10px' }}>OPD-204</span>
                  </div>
                  <span style={{ fontSize: '10px', color: '#94a3b8' }}>48 Y / Male • +91 98765-43210</span>
                </div>

                {/* Live Waveform & Listening State */}
                <div style={{ background: 'rgba(6, 182, 212, 0.08)', border: '1px solid rgba(6, 182, 212, 0.25)', borderRadius: '14px', padding: '12px', textAlign: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <Mic size={14} color="#06b6d4" />
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#06b6d4' }}>Ambient Voice AI Active</span>
                  </div>
                  <div className="waveform-bars">
                    <div className="wave-bar"></div>
                    <div className="wave-bar"></div>
                    <div className="wave-bar"></div>
                    <div className="wave-bar"></div>
                    <div className="wave-bar"></div>
                    <div className="wave-bar"></div>
                    <div className="wave-bar"></div>
                  </div>
                  <span style={{ fontSize: '9px', color: '#94a3b8' }}>Bilingual Recognition (Hindi + English)</span>
                </div>

                {/* Extracted Diagnosis */}
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '12px', marginBottom: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: '9px', color: '#06b6d4', fontWeight: 700, textTransform: 'uppercase' }}>Extracted Diagnosis</span>
                  <p style={{ fontSize: '11px', color: '#fff', fontWeight: 600, marginTop: '2px' }}>
                    Type 2 Diabetes Mellitus with Essential Hypertension
                  </p>
                  <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                    <span style={{ fontSize: '9px', background: 'rgba(6,182,212,0.15)', color: '#06b6d4', padding: '2px 6px', borderRadius: '4px' }}>ICD-10: E11.9</span>
                    <span style={{ fontSize: '9px', background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '2px 6px', borderRadius: '4px' }}>Rx: 2 Drugs</span>
                  </div>
                </div>

                {/* Prescribed Medications */}
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '12px', marginBottom: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 700 }}>Structured Prescriptions</span>
                  <div style={{ marginTop: '4px', fontSize: '10px', color: '#e2e8f0' }}>
                    • Metformin 500mg (1-0-1 after meals)<br />
                    • Telmisartan 40mg (1-0-0 morning)
                  </div>
                </div>

                {/* Mandatory Doctor Verification Gate */}
                <div style={{ marginTop: 'auto', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '12px', padding: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={doctorVerified}
                      onChange={(e) => setDoctorVerified(e.target.checked)}
                      style={{ accentColor: '#10b981', marginTop: '2px' }}
                    />
                    <span style={{ fontSize: '9px', color: '#cbd5e1', lineHeight: 1.3 }}>
                      I have reviewed and legally verified this care plan under NMC Guidelines.
                    </span>
                  </label>

                  <button
                    style={{
                      width: '100%',
                      marginTop: '8px',
                      padding: '8px',
                      borderRadius: '8px',
                      background: doctorVerified ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#334155',
                      color: '#fff',
                      fontSize: '11px',
                      fontWeight: 700,
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      cursor: doctorVerified ? 'pointer' : 'not-allowed',
                      boxShadow: doctorVerified ? '0 4px 12px rgba(16,185,129,0.3)' : 'none'
                    }}
                  >
                    <Send size={12} />
                    <span>Verify & Dispatch WhatsApp</span>
                  </button>
                </div>
              </div>
            )}

            {/* Screen Content: Patient App */}
            {activeTab === 'patient' && (
              <div className="phone-screen">
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px' }}>
                  <span style={{ fontSize: '11px', color: '#fff', fontWeight: 700 }}>नमस्ते रमेश जी</span>
                  <div style={{ background: 'rgba(6,182,212,0.15)', color: '#06b6d4', padding: '2px 8px', borderRadius: '8px', fontSize: '9px', fontWeight: 600 }}>
                    हिंदी / ENG
                  </div>
                </div>

                {/* WhatsApp Care Plan Status */}
                <div style={{ background: 'rgba(37, 211, 102, 0.1)', border: '1px solid rgba(37, 211, 102, 0.3)', borderRadius: '12px', padding: '10px 12px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MessageSquare size={16} color="#25D366" />
                  <div>
                    <span style={{ fontSize: '10px', color: '#25D366', fontWeight: 700, display: 'block' }}>WhatsApp पर भेजा गया</span>
                    <span style={{ fontSize: '9px', color: '#94a3b8' }}>PDF केयर प्लान उपलब्ध है</span>
                  </div>
                </div>

                {/* Plain-Language Instructions */}
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '12px', marginBottom: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: '9px', color: '#06b6d4', fontWeight: 700, textTransform: 'uppercase' }}>डॉक्टर की सलाह (सरल भाषा में)</span>
                  <p style={{ fontSize: '10px', color: '#cbd5e1', marginTop: '4px', lineHeight: 1.4 }}>
                    शुगर को नियंत्रित रखने के लिए दवा समय पर लें और सुबह 30 मिनट तेज चलें। मीठे पेय से परहेज करें।
                  </p>
                </div>

                {/* Daily Medicine Schedule */}
                <div style={{ marginBottom: '10px' }}>
                  <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>आज की दवाएं (Today's Doses)</span>
                  
                  {/* Morning Dose */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.04)', padding: '8px 10px', borderRadius: '10px', marginTop: '6px', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Clock size={12} color="#06b6d4" />
                      <div>
                        <span style={{ fontSize: '10px', color: '#fff', fontWeight: 600, display: 'block' }}>नाश्ते के बाद (सुबह 8:30)</span>
                        <span style={{ fontSize: '9px', color: '#94a3b8' }}>Metformin 500mg • 1 गोली</span>
                      </div>
                    </div>
                    <CheckCircle2 size={14} color="#10b981" />
                  </div>

                  {/* Evening Dose */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.04)', padding: '8px 10px', borderRadius: '10px', marginTop: '6px', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Clock size={12} color="#f59e0b" />
                      <div>
                        <span style={{ fontSize: '10px', color: '#fff', fontWeight: 600, display: 'block' }}>रात के खाने के बाद (रात 9:00)</span>
                        <span style={{ fontSize: '9px', color: '#94a3b8' }}>Metformin 500mg • 1 गोली</span>
                      </div>
                    </div>
                    <span style={{ fontSize: '9px', color: '#f59e0b', fontWeight: 600 }}>बाकी है</span>
                  </div>
                </div>

                {/* DPDP Consent Status */}
                <div style={{ marginTop: 'auto', background: 'rgba(6, 182, 212, 0.08)', border: '1px solid rgba(6, 182, 212, 0.2)', borderRadius: '10px', padding: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Lock size={12} color="#06b6d4" />
                  <span style={{ fontSize: '9px', color: '#94a3b8' }}>
                    DPDP Act 2023: आपकी सहमति सुरक्षित है। कभी भी वापस ले सकते हैं।
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Features Breakdown & Actions */}
        <div>
          {activeTab === 'doctor' ? (
            <div className="feature-points">
              <div className="feature-item">
                <div className="feature-icon-box">
                  <Mic size={22} />
                </div>
                <div>
                  <h4>Ambient Bilingual Audio Capture</h4>
                  <p>
                    Transcribes naturally spoken doctor-patient consultations in English and Hindi without disrupting the natural clinical conversation.
                  </p>
                </div>
              </div>

              <div className="feature-item">
                <div className="feature-icon-box" style={{ background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.25)', color: '#10b981' }}>
                  <FileCheck size={22} />
                </div>
                <div>
                  <h4>Mandatory Physician Verification Gate</h4>
                  <p>
                    Strictly enforces doctor review and legal sign-off in compliance with NMC Telemedicine Practice Guidelines before any plan can be dispatched.
                  </p>
                </div>
              </div>

              <div className="feature-item">
                <div className="feature-icon-box">
                  <Send size={22} />
                </div>
                <div>
                  <h4>Instant Verified WhatsApp Dispatch</h4>
                  <p>
                    Delivers cryptographic, tamper-proof care plan summaries and medication schedules directly to the patient's WhatsApp within 1.2 seconds.
                  </p>
                </div>
              </div>

              {/* Download Trigger */}
              <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                <a href="#download" className="btn-primary">
                  <Download size={16} />
                  <span>Download Doctor App (APK)</span>
                </a>
                <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                  Android 8.0+ • Release v1.0.4
                </span>
              </div>
            </div>
          ) : (
            <div className="feature-points">
              <div className="feature-item">
                <div className="feature-icon-box" style={{ background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.25)', color: '#10b981' }}>
                  <Globe2 size={22} />
                </div>
                <div>
                  <h4>Vernacular Plain-Language Translation</h4>
                  <p>
                    Complex clinical terminology is automatically distilled into friendly, actionable instructions in Hindi and regional languages.
                  </p>
                </div>
              </div>

              <div className="feature-item">
                <div className="feature-icon-box">
                  <Clock size={22} />
                </div>
                <div>
                  <h4>Medication Timelines & Reminders</h4>
                  <p>
                    Clear morning, afternoon, and evening dosage schedules with visual indicators to ensure high therapy adherence and zero missed pills.
                  </p>
                </div>
              </div>

              <div className="feature-item">
                <div className="feature-icon-box" style={{ background: 'rgba(6,182,212,0.1)', borderColor: 'rgba(6,182,212,0.25)', color: '#06b6d4' }}>
                  <Lock size={22} />
                </div>
                <div>
                  <h4>DPDP Act 2023 Consent Vault</h4>
                  <p>
                    Complete control over health records with granular consent logs, data revocation rights, and ABDM FHIR M2 health locker sync.
                  </p>
                </div>
              </div>

              {/* Download Trigger */}
              <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                <a href="#download" className="btn-primary">
                  <Download size={16} />
                  <span>Download Patient App (APK)</span>
                </a>
                <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                  Universal Android APK • v1.0.4
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
