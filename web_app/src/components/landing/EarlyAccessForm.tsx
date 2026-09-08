import React, { useState } from 'react';
import { Download, Send, CheckCircle2, Shield, Smartphone, Sparkles } from 'lucide-react';

export const EarlyAccessForm: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    clinic: '',
    phone: '',
    specialty: 'General Medicine'
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) return;
    setSubmitted(true);
  };

  return (
    <section id="download" className="landing-section">
      <div className="landing-card cta-card">
        <div className="section-tag" style={{ marginBottom: '14px' }}>
          <Sparkles size={14} />
          <span>Deploy Praxirence in Your Clinic</span>
        </div>

        <h2 className="section-title" style={{ fontSize: '2.25rem' }}>
          Join the Pilot Network of Modern Physicians
        </h2>

        <p className="section-subtitle" style={{ margin: '0 auto', fontSize: '1rem' }}>
          Cut documentation time by 80% and elevate patient compliance. Request clinic deployment or download the APKs immediately.
        </p>

        {submitted ? (
          <div style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '16px',
            padding: '32px',
            margin: '32px 0',
            textAlign: 'center'
          }}>
            <CheckCircle2 size={40} color="#10b981" style={{ margin: '0 auto 12px auto' }} />
            <h4 style={{ color: '#fff', fontSize: '1.25rem', marginBottom: '8px' }}>Thank you, Dr. {formData.name}!</h4>
            <p style={{ color: '#94a3b8', fontSize: '0.95rem' }}>
              Our clinical implementation team will contact you on WhatsApp ({formData.phone}) within 2 hours to activate your clinic's ambient AI gateway.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <input
                type="text"
                placeholder="Doctor Name (e.g. Dr. Rajesh Verma)"
                className="form-input"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />

              <input
                type="text"
                placeholder="Clinic / Hospital Name"
                className="form-input"
                value={formData.clinic}
                onChange={(e) => setFormData({ ...formData, clinic: e.target.value })}
              />

              <input
                type="tel"
                placeholder="WhatsApp Number (e.g. +91 98765 43210)"
                className="form-input"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />

              <select
                className="form-input"
                value={formData.specialty}
                onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                style={{ cursor: 'pointer' }}
              >
                <option value="General Medicine" style={{ background: '#0f172a' }}>General Medicine</option>
                <option value="Diabetology & Endocrinology" style={{ background: '#0f172a' }}>Diabetology & Endocrinology</option>
                <option value="Cardiology" style={{ background: '#0f172a' }}>Cardiology</option>
                <option value="Pediatrics" style={{ background: '#0f172a' }}>Pediatrics</option>
                <option value="Orthopedics" style={{ background: '#0f172a' }}>Orthopedics</option>
                <option value="Other" style={{ background: '#0f172a' }}>Other Specialization</option>
              </select>
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
              <Send size={16} />
              <span>Request Priority Clinic Onboarding</span>
            </button>
          </form>
        )}

        {/* Direct APK Download Strip */}
        <div style={{
          marginTop: '40px',
          paddingTop: '32px',
          borderTop: '1px solid var(--landing-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '20px',
          flexWrap: 'wrap'
        }}>
          <div style={{ textAlign: 'left' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, display: 'block' }}>
              Direct Mobile Downloads
            </span>
            <span style={{ fontSize: '0.9rem', color: '#fff' }}>
              Signed Production APKs (v1.0.4)
            </span>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <a
              href="https://github.com/M20A03/Praxirence/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
              style={{ padding: '10px 18px', fontSize: '0.85rem' }}
            >
              <Smartphone size={15} color="#06b6d4" />
              <span>Doctor APK (Android)</span>
              <Download size={14} />
            </a>

            <a
              href="https://github.com/M20A03/Praxirence/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
              style={{ padding: '10px 18px', fontSize: '0.85rem' }}
            >
              <Smartphone size={15} color="#10b981" />
              <span>Patient APK (Android)</span>
              <Download size={14} />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};
