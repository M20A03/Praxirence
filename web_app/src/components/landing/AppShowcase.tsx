import React, { useState } from 'react';
import {
  Mic,
  ShieldCheck,
  Send,
  Smartphone,
  CheckCircle2,
  Clock,
  Globe2,
  FileCheck,
  Heart,
  MessageSquare,
  Lock,
  Eye
} from 'lucide-react';

interface AppShowcaseProps {
  onOpenWhatsAppPreview?: () => void;
}

export const AppShowcase: React.FC<AppShowcaseProps> = ({ onOpenWhatsAppPreview }) => {
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

        {/* Responsive Tab Selector */}
        <div className="tab-selector">
          <button
            className={`tab-btn ${activeTab === 'doctor' ? 'active' : ''}`}
            onClick={() => setActiveTab('doctor')}
          >
            <Mic size={15} />
            <span>Doctor App</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'patient' ? 'active' : ''}`}
            onClick={() => setActiveTab('patient')}
          >
            <Heart size={15} />
            <span>Patient App</span>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                    <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>Clinician Workspace</span>
                  </div>
                  <span style={{ fontSize: '10px', color: '#0284c7', fontWeight: 700 }}>Dr. Mayank</span>
                </div>

                {/* Patient Header */}
                <div style={{ background: '#ffffff', padding: '8px 10px', borderRadius: '10px', marginBottom: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '11px' }}>Ramesh Sharma</span>
                    <span style={{ fontSize: '9px', color: '#059669', background: 'rgba(16,185,129,0.12)', padding: '2px 6px', borderRadius: '10px', fontWeight: 600 }}>OPD-204</span>
                  </div>
                  <span style={{ fontSize: '9px', color: '#64748b' }}>48 Y / Male • +91 98765-43210</span>
                </div>

                {/* Live Waveform & Listening State */}
                <div style={{ background: 'rgba(2, 132, 199, 0.06)', border: '1px solid rgba(2, 132, 199, 0.2)', borderRadius: '12px', padding: '10px', textAlign: 'center', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <Mic size={13} color="#0284c7" />
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#0284c7' }}>Ambient Voice AI Active</span>
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
                  <span style={{ fontSize: '9px', color: '#64748b', fontWeight: 500 }}>Bilingual Recognition (Hindi + English)</span>
                </div>

                {/* Extracted Diagnosis */}
                <div style={{ background: '#ffffff', padding: '8px 10px', borderRadius: '10px', marginBottom: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                  <span style={{ fontSize: '9px', color: '#0284c7', fontWeight: 700, textTransform: 'uppercase' }}>Extracted Diagnosis</span>
                  <p style={{ fontSize: '10px', color: '#0f172a', fontWeight: 600, marginTop: '2px', lineHeight: 1.3 }}>
                    Type 2 Diabetes Mellitus with Essential Hypertension
                  </p>
                  <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                    <span style={{ fontSize: '8.5px', background: 'rgba(2,132,199,0.1)', color: '#0284c7', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>ICD-10: E11.9</span>
                    <span style={{ fontSize: '8.5px', background: 'rgba(16,185,129,0.1)', color: '#059669', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>Rx: 2 Drugs</span>
                  </div>
                </div>

                {/* Prescribed Medications */}
                <div style={{ background: '#ffffff', padding: '8px 10px', borderRadius: '10px', marginBottom: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                  <span style={{ fontSize: '8.5px', color: '#64748b', fontWeight: 700 }}>Structured Prescriptions</span>
                  <div style={{ marginTop: '3px', fontSize: '9.5px', color: '#334155', lineHeight: 1.35 }}>
                    • Metformin 500mg (1-0-1 after meals)<br />
                    • Telmisartan 40mg (1-0-0 morning)
                  </div>
                </div>

                {/* Mandatory Doctor Verification Gate */}
                <div style={{ marginTop: 'auto', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '10px', padding: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={doctorVerified}
                      onChange={(e) => setDoctorVerified(e.target.checked)}
                      style={{ accentColor: '#059669', marginTop: '2px' }}
                    />
                    <span style={{ fontSize: '8.5px', color: '#334155', lineHeight: 1.3, fontWeight: 500 }}>
                      I have reviewed and verified this care plan for patient dispatch.
                    </span>
                  </label>

                  <button
                    onClick={onOpenWhatsAppPreview}
                    style={{
                      width: '100%',
                      marginTop: '6px',
                      padding: '7px',
                      borderRadius: '8px',
                      background: doctorVerified ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#94a3b8',
                      color: '#fff',
                      fontSize: '10px',
                      fontWeight: 700,
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      cursor: doctorVerified ? 'pointer' : 'not-allowed',
                      boxShadow: doctorVerified ? '0 3px 8px rgba(16,185,129,0.3)' : 'none'
                    }}
                  >
                    <Send size={11} />
                    <span>Verify & Dispatch WhatsApp</span>
                  </button>
                </div>
              </div>
            )}

            {/* Screen Content: Patient App */}
            {activeTab === 'patient' && (
              <div className="phone-screen">
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                  <span style={{ fontSize: '11px', color: '#0f172a', fontWeight: 700 }}>नमस्ते रमेश जी</span>
                  <div style={{ background: 'rgba(2,132,199,0.1)', color: '#0284c7', padding: '2px 6px', borderRadius: '6px', fontSize: '8.5px', fontWeight: 700 }}>
                    हिंदी / ENG
                  </div>
                </div>

                {/* WhatsApp Care Plan Status */}
                <div
                  onClick={onOpenWhatsAppPreview}
                  style={{
                    background: 'rgba(37, 211, 102, 0.1)',
                    border: '1px solid rgba(37, 211, 102, 0.3)',
                    borderRadius: '10px',
                    padding: '8px 10px',
                    marginBottom: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer'
                  }}
                  title="Click to preview WhatsApp Message"
                >
                  <MessageSquare size={15} color="#059669" />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '9.5px', color: '#059669', fontWeight: 700, display: 'block' }}>WhatsApp पर भेजा गया</span>
                    <span style={{ fontSize: '8.5px', color: '#64748b' }}>PDF केयर प्लान उपलब्ध है (क्लिक करें)</span>
                  </div>
                  <Eye size={12} color="#059669" />
                </div>

                {/* Plain-Language Instructions */}
                <div style={{ background: '#ffffff', padding: '8px 10px', borderRadius: '10px', marginBottom: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                  <span style={{ fontSize: '8.5px', color: '#0284c7', fontWeight: 700, textTransform: 'uppercase' }}>डॉक्टर की सलाह (सरल भाषा में)</span>
                  <p style={{ fontSize: '9.5px', color: '#334155', marginTop: '3px', lineHeight: 1.35 }}>
                    शुगर को नियंत्रित रखने के लिए दवा समय पर लें और सुबह 30 मिनट तेज चलें। मीठे पेय से परहेज करें।
                  </p>
                </div>

                {/* Daily Medicine Schedule */}
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ fontSize: '8.5px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>आज की दवाएं (Today's Doses)</span>
                  
                  {/* Morning Dose */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ffffff', padding: '7px 9px', borderRadius: '8px', marginTop: '5px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={11} color="#0284c7" />
                      <div>
                        <span style={{ fontSize: '9.5px', color: '#0f172a', fontWeight: 600, display: 'block' }}>नाश्ते के बाद (सुबह 8:30)</span>
                        <span style={{ fontSize: '8.5px', color: '#64748b' }}>Metformin 500mg • 1 गोली</span>
                      </div>
                    </div>
                    <CheckCircle2 size={13} color="#059669" />
                  </div>

                  {/* Evening Dose */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ffffff', padding: '7px 9px', borderRadius: '8px', marginTop: '5px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={11} color="#d97706" />
                      <div>
                        <span style={{ fontSize: '9.5px', color: '#0f172a', fontWeight: 600, display: 'block' }}>रात के खाने के बाद (रात 9:00)</span>
                        <span style={{ fontSize: '8.5px', color: '#64748b' }}>Metformin 500mg • 1 गोली</span>
                      </div>
                    </div>
                    <span style={{ fontSize: '8.5px', color: '#d97706', fontWeight: 600 }}>बाकी है</span>
                  </div>
                </div>

                {/* DPDP Consent Status */}
                <div style={{ marginTop: 'auto', background: 'rgba(2, 132, 199, 0.08)', border: '1px solid rgba(2, 132, 199, 0.2)', borderRadius: '8px', padding: '7px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Lock size={11} color="#0284c7" />
                  <span style={{ fontSize: '8.5px', color: '#475569', fontWeight: 500 }}>
                    DPDP Act 2023: आपकी सहमति सुरक्षित है।
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Features Breakdown & Action Buttons */}
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
                    Transcribes naturally spoken doctor-patient consultations in English and Hindi without disrupting the clinical workflow.
                  </p>
                </div>
              </div>

              <div className="feature-item">
                <div className="feature-icon-box" style={{ background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.25)', color: '#059669' }}>
                  <FileCheck size={22} />
                </div>
                <div>
                  <h4>Mandatory Physician Verification Gate</h4>
                  <p>
                    Strictly enforces doctor review and clinical sign-off, ensuring absolute accuracy and patient safety before dispatch.
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
                    Delivers cryptographic, tamper-proof care plan summaries and medication schedules directly to the patient's WhatsApp within 1.2s.
                  </p>
                </div>
              </div>

              {/* Action Buttons: WhatsApp Preview & Contact */}
              <div style={{ marginTop: '16px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {onOpenWhatsAppPreview && (
                  <button
                    onClick={onOpenWhatsAppPreview}
                    className="btn-secondary"
                    style={{ padding: '10px 18px', fontSize: '0.85rem' }}
                  >
                    <MessageSquare size={16} color="#059669" />
                    <span>Preview WhatsApp Dispatch</span>
                  </button>
                )}

                <a href="#contact" className="btn-primary" style={{ padding: '10px 18px', fontSize: '0.85rem' }}>
                  <span>Request Platform Access</span>
                </a>
              </div>
            </div>
          ) : (
            <div className="feature-points">
              <div className="feature-item">
                <div className="feature-icon-box" style={{ background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.25)', color: '#059669' }}>
                  <Globe2 size={22} />
                </div>
                <div>
                  <h4>Vernacular Plain-Language Translation</h4>
                  <p>
                    Complex clinical terminology is automatically distilled into friendly, actionable instructions in Hindi and regional dialects.
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
                <div className="feature-icon-box" style={{ background: 'rgba(2,132,199,0.1)', borderColor: 'rgba(2,132,199,0.25)', color: '#0284c7' }}>
                  <Lock size={22} />
                </div>
                <div>
                  <h4>DPDP Act 2023 Consent Vault</h4>
                  <p>
                    Complete control over health records with granular consent logs, data revocation rights, and ABDM FHIR M2 health locker sync.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ marginTop: '16px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {onOpenWhatsAppPreview && (
                  <button
                    onClick={onOpenWhatsAppPreview}
                    className="btn-secondary"
                    style={{ padding: '10px 18px', fontSize: '0.85rem' }}
                  >
                    <MessageSquare size={16} color="#059669" />
                    <span>View Patient WhatsApp</span>
                  </button>
                )}

                <a href="#contact" className="btn-primary" style={{ padding: '10px 18px', fontSize: '0.85rem' }}>
                  <span>Inquire for Patients</span>
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
