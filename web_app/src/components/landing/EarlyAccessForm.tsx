import React, { useState } from 'react';
import { Send, CheckCircle2, Mail, Building2, User, Phone } from 'lucide-react';

export const EarlyAccessForm: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    role: 'Doctor / Healthcare Provider',
    contact: '',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.contact) return;
    setSubmitted(true);
  };

  return (
    <section id="contact" className="landing-section">
      <div className="landing-card cta-card">
        <div className="section-tag" style={{ marginBottom: '14px' }}>
          <Mail size={14} />
          <span>Connect With Praxirence</span>
        </div>

        <h2 className="section-title" style={{ fontSize: '2.25rem' }}>
          Get in Touch with Our Team
        </h2>

        <p className="section-subtitle" style={{ margin: '0 auto', fontSize: '1rem' }}>
          Whether you are a healthcare practitioner, hospital administrator, patient, or technology partner, we are here to support your clinical communication needs.
        </p>

        {submitted ? (
          <div style={{
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: '16px',
            padding: '32px',
            margin: '32px 0',
            textAlign: 'center'
          }}>
            <CheckCircle2 size={40} color="#059669" style={{ margin: '0 auto 12px auto' }} />
            <h4 style={{ color: '#0f172a', fontSize: '1.25rem', marginBottom: '8px', fontWeight: 700 }}>
              Thank you, {formData.name}!
            </h4>
            <p style={{ color: '#475569', fontSize: '0.95rem' }}>
              Your message has been received. Our clinical partnership team will reach out to you at {formData.contact} promptly.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ marginTop: '28px' }}>
            <div className="form-grid">
              <input
                type="text"
                placeholder="Full Name"
                className="form-input"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />

              <select
                className="form-input"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                style={{ cursor: 'pointer' }}
              >
                <option value="Doctor / Healthcare Provider">Doctor / Healthcare Provider</option>
                <option value="Hospital / Clinic Administrator">Hospital / Clinic Administrator</option>
                <option value="Patient / Family Caregiver">Patient / Family Caregiver</option>
                <option value="Healthtech Partner / Researcher">Healthtech Partner / Researcher</option>
                <option value="Other">Other Inquiry</option>
              </select>

              <input
                type="text"
                placeholder="Email or Phone / WhatsApp"
                className="form-input"
                required
                value={formData.contact}
                onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
              />

              <input
                type="text"
                placeholder="City / Institution (Optional)"
                className="form-input"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              />
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '16px' }}>
              <Send size={16} />
              <span>Submit Inquiry</span>
            </button>
          </form>
        )}
      </div>
    </section>
  );
};
